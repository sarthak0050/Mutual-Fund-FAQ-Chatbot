import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;

// --- PII Filter ---
// Regex patterns for Indian PII: PAN, Aadhaar, phone, email, account numbers
const PII_PATTERNS = [
  /[A-Z]{5}[0-9]{4}[A-Z]/, // PAN: ABCDE1234F
  /\b[0-9]{4}\s?[0-9]{4}\s?[0-9]{4}\b/, // Aadhaar: 1234 5678 9012
  /\b[6-9][0-9]{9}\b/, // Indian phone: 10 digits starting with 6-9
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
  /\b[0-9]{9,18}\b/, // Account numbers: 9-18 digits
];

function detectPII(text: string): boolean {
  return PII_PATTERNS.some((pattern) => pattern.test(text));
}

// --- Embed query text ---
async function embedText(text: string): Promise<number[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/gemini-embedding-001",
        content: { parts: [{ text }] },
        outputDimensionality: 768,
      }),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data.embedding.values;
}

// --- Call Gemini for text generation ---
async function generate(systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userPrompt }] }],
      }),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data.candidates[0].content.parts[0].text;
}

// --- Intent classification ---
async function classifyIntent(query: string): Promise<string> {
  const systemPrompt = `You are an intent classifier for a mutual fund facts app.
Classify the user's query into exactly ONE of these categories:
- factual: asks for a specific fact about one of these 4 schemes (HDFC Top 100, HDFC Flexi Cap, HDFC ELSS Tax Saver, HDFC Mid-Cap Opportunities)
- opinion_advice: asks for opinion, recommendation, comparison, "should I buy", "which is better", performance predictions
- out_of_scope: asks about a scheme not in the list above, or is completely unrelated to mutual funds

Reply with ONLY the category name, nothing else.`;

  const result = await generate(systemPrompt, query);
  return result.trim().toLowerCase();
}

// --- Extract fact_type and scheme_id from query ---
async function extractEntities(
  query: string
): Promise<{ fact_type: string | null; scheme_id: string | null }> {
  const systemPrompt = `You extract structured data from mutual fund questions.

Available schemes (respond with EXACT scheme_id):
- top100: HDFC Top 100 Fund
- flexicap: HDFC Flexi Cap Fund
- elsstaxsaver: HDFC ELSS Tax Saver
- midcap: HDFC Mid-Cap Opportunities Fund

Available fact_types:
- expense_ratio: cost/expense/TER of the fund
- exit_load: exit load/penalty for early withdrawal
- lock_in: lock-in period
- fund_manager: who manages the fund
- benchmark: benchmark index
- objective: investment objective/goal
- riskometer: risk level

Reply as JSON: {"scheme_id": "...", "fact_type": "..."}
If you cannot determine one, use null for that field.`;

  const result = await generate(systemPrompt, query);
  console.log(`[5] Raw entity extraction: ${result}`);
  try {
    // Try to extract JSON from the response (may have markdown formatting)
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return { fact_type: parsed.fact_type || null, scheme_id: parsed.scheme_id || null };
    }
    return { fact_type: null, scheme_id: null };
  } catch {
    return { fact_type: null, scheme_id: null };
  }
}

// --- Main query handler ---
export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const query = body.text;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { type: "error", message: "Please provide a text query." },
        { status: 400 }
      );
    }

    // Step 1: PII Filter
    console.log("[1] PII filter check");
    if (detectPII(query)) {
      console.log("[1] PII detected — blocking");
      return NextResponse.json({
        type: "pii_block",
        message: "Your query contains personal information and cannot be processed. Please remove any PAN, Aadhaar, phone number, email, or account details and try again.",
      });
    }

    // Step 2: Intent classification
    console.log("[2] Classifying intent");
    const intent = await classifyIntent(query);
    console.log(`[2] Intent: ${intent}`);

    // Step 3: Handle opinion_advice
    if (intent === "opinion_advice") {
      console.log("[3] Opinion/advice detected — refusing");
      return NextResponse.json({
        type: "refusal",
        message: "I can only provide factual information about mutual fund schemes. I cannot offer opinions, recommendations, or comparisons. For investor education, visit SEBI's investor portal.",
        source_url: "https://investor.sebi.gov.in/understanding_mf.html",
      });
    }

    // Step 4: Handle out_of_scope
    if (intent === "out_of_scope") {
      console.log("[4] Out of scope — listing available schemes");
      const schemes = await sql`SELECT scheme_id, name FROM schemes ORDER BY scheme_id`;
      const list = schemes.map((s) => `- ${s.name}`).join("\n");
      return NextResponse.json({
        type: "out_of_scope",
        message: `I can only answer questions about these 4 HDFC schemes:\n${list}`,
      });
    }

    // Step 5: Factual — extract entities, embed, search
    console.log("[5] Extracting entities and searching");
    const { fact_type, scheme_id } = await extractEntities(query);
    console.log(`[5] scheme_id=${scheme_id}, fact_type=${fact_type}`);

    if (!scheme_id || !fact_type) {
      return NextResponse.json({
        type: "out_of_scope",
        message: "I couldn't identify which scheme and fact type you're asking about. Please specify the scheme name and what you want to know (e.g., expense ratio, exit load, fund manager).",
      });
    }

    // Embed query
    const queryEmbedding = await embedText(query);

    // pgvector cosine similarity search — filtered by scheme_id AND fact_type
    const chunks = await sql`
      SELECT
        c.text,
        c.fact_type,
        c.scheme_id,
        s.url as source_url,
        s.source_last_updated,
        1 - (c.embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
      FROM chunks c
      JOIN sources s ON c.source_id = s.source_id
      WHERE c.scheme_id = ${scheme_id}
        AND c.fact_type = ${fact_type}
      ORDER BY c.embedding <=> ${JSON.stringify(queryEmbedding)}::vector
      LIMIT 3
    `;

    // Step 6: No chunk found
    if (chunks.length === 0) {
      console.log("[6] No chunks found");
      return NextResponse.json({
        type: "no_answer",
        message: "I don't have a sourced answer for that question. Try asking about expense ratio, exit load, fund manager, or other specific facts.",
      });
    }

    // Step 7: Generate answer using chunk text
    console.log("[7] Generating answer");
    const chunkText = chunks.map((c) => c.text).join("\n\n");
    const answerPrompt = `Answer the user's question using ONLY the information below. Be factual and concise (max 3 sentences). Do not compute returns or performance. Do not give advice.

Source text:
${chunkText}

Question: ${query}`;

    const answer = await generate(
      "You are a factual mutual fund information assistant. Answer only from the provided source text. Max 3 sentences.",
      answerPrompt
    );

    // Step 8: Log to query_logs (metadata only — no raw query text)
    console.log("[8] Logging query metadata");
    const latencyMs = Date.now() - startTime;
    await sql`
      INSERT INTO query_logs (intent_type, fact_type, scheme_id, resolved, latency_ms)
      VALUES (${intent}, ${fact_type}, ${scheme_id}, true, ${latencyMs})
    `;

    // Step 9: Return answer with citation from database
    console.log("[9] Returning answer");
    return NextResponse.json({
      type: "answer",
      answer: answer.trim(),
      source_url: chunks[0].source_url,
      last_updated: chunks[0].source_last_updated,
      fact_type,
      scheme_id,
    });
  } catch (error: any) {
    console.error("Query error:", error);
    return NextResponse.json(
      { type: "error", message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
