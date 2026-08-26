import dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(__dirname, "../.env.local") });

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { join } from "path";
import { PDFParse } from "pdf-parse";
import * as cheerio from "cheerio";

const sql = neon(process.env.DATABASE_URL!);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;

// Embed text using Gemini API
async function embed(text: string): Promise<number[]> {
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

// Split text into chunks of ~500 words with overlap
function chunkText(text: string, maxWords = 500, overlap = 50): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += maxWords - overlap) {
    chunks.push(words.slice(i, i + maxWords).join(" "));
  }
  return chunks.filter((c) => c.trim().length > 0);
}

// Fetch and extract text from a URL
async function extractText(url: string, docType: string): Promise<string> {
  console.log(`  Fetching: ${url}`);
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);

  if (docType === "pdf" || url.endsWith(".pdf")) {
    const arrayBuffer = await res.arrayBuffer();
    const parser = new PDFParse(new Uint8Array(arrayBuffer));
    await parser.load();
    const result = await parser.getText();
    return result.text;
  }

  // HTML/webpage
  const html = await res.text();
  const $ = cheerio.load(html);
  $("script, style, nav, header, footer").remove();
  return $("body").text().replace(/\s+/g, " ").trim();
}

// Check if a chunk already exists (idempotency)
async function chunkExists(
  sourceId: number,
  factType: string,
  textStart: string
): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM chunks
    WHERE source_id = ${sourceId}
      AND fact_type = ${factType}
      AND text LIKE ${textStart + "%"}
    LIMIT 1
  `;
  return rows.length > 0;
}

async function main() {
  console.log("=== Ingestion Pipeline ===\n");

  // Read CSV
  const csvPath = join(__dirname, "../data/source_list.csv");
  const csv = readFileSync(csvPath, "utf-8");
  const lines = csv.trim().split("\n");
  const headers = lines[0].split(",");
  const rows = lines.slice(1).map((line) => {
    const values = line.split(",");
    return Object.fromEntries(headers.map((h, i) => [h, values[i]]));
  });

  console.log(`Found ${rows.length} source entries.\n`);

  // Track unique URLs to avoid re-fetching
  const urlMap = new Map<string, number>(); // url -> source_id
  let totalChunks = 0;

  for (const row of rows) {
    const { url, doc_type, scheme_id, fact_type, date_accessed } = row;
    console.log(`Processing: ${scheme_id} / ${fact_type}`);

    // Get or create source
    let sourceId: number;
    if (urlMap.has(url)) {
      sourceId = urlMap.get(url)!;
      console.log(`  Using existing source_id: ${sourceId}`);
    } else {
      const existing = await sql`
        SELECT source_id FROM sources WHERE url = ${url} LIMIT 1
      `;
      if (existing.length > 0) {
        sourceId = existing[0].source_id as number;
      } else {
        const inserted = await sql`
          INSERT INTO sources (url, doc_type, scheme_id, date_accessed)
          VALUES (${url}, ${doc_type}, ${scheme_id}, ${date_accessed}::date)
          RETURNING source_id
        `;
        sourceId = inserted[0].source_id as number;
      }
      urlMap.set(url, sourceId);
    }

    // Extract text
    let text: string;
    try {
      text = await extractText(url, doc_type);
    } catch (err: any) {
      console.log(`  Skipping (fetch error): ${err.message}`);
      continue;
    }

    if (!text || text.trim().length < 100) {
      console.log(`  Skipping (too little text extracted)`);
      continue;
    }

    // Chunk
    const chunks = chunkText(text);
    console.log(`  Extracted ${chunks.length} chunks`);

    // Embed and insert each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const textPreview = chunk.substring(0, 80);

      // Idempotency check
      const exists = await chunkExists(sourceId, fact_type, textPreview);
      if (exists) {
        console.log(`  Chunk ${i + 1}/${chunks.length}: already exists, skipping`);
        continue;
      }

      try {
        const embedding = await embed(chunk);
        await sql`
          INSERT INTO chunks (source_id, scheme_id, fact_type, text, embedding)
          VALUES (${sourceId}, ${scheme_id}, ${fact_type}, ${chunk}, ${JSON.stringify(embedding)})
        `;
        totalChunks++;
        console.log(`  Chunk ${i + 1}/${chunks.length}: inserted`);
      } catch (err: any) {
        console.log(`  Chunk ${i + 1}/${chunks.length}: embed error - ${err.message}`);
      }

      // Small delay to avoid rate limits
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  console.log(`\n=== Done ===`);
  console.log(`Total new chunks inserted: ${totalChunks}`);

  // Show coverage summary
  const coverage = await sql`
    SELECT scheme_id, fact_type, COUNT(*) as chunk_count
    FROM chunks
    GROUP BY scheme_id, fact_type
    ORDER BY scheme_id, fact_type
  `;
  console.log("\nCoverage:");
  console.table(coverage);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
