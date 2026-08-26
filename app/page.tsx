"use client";

import { useState } from "react";

type QueryResponse = {
  type: string;
  answer?: string;
  source_url?: string;
  last_updated?: string | null;
  fact_type?: string;
  scheme_id?: string;
  message?: string;
  scheme_name?: string;
};

const SCHEMES = [
  { id: "top100", name: "HDFC Top 100 Fund" },
  { id: "flexicap", name: "HDFC Flexi Cap Fund" },
  { id: "elsstaxsaver", name: "HDFC ELSS Tax Saver" },
  { id: "midcap", name: "HDFC Mid-Cap Opportunities Fund" },
];

const EXAMPLES = [
  "What is the expense ratio of HDFC Flexi Cap Fund?",
  "ELSS lock-in period?",
  "Who manages HDFC Mid-Cap Opportunities Fund?",
];

export default function Home() {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<QueryResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setResponse(null);

    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: query }),
      });
      const data = await res.json();
      setResponse(data);
    } catch {
      setResponse({ type: "error", message: "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  function handleExample(example: string) {
    setQuery(example);
    setResponse(null);
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1A1A1A]">
      {/* Persistent header */}
      <header className="border-b border-[#E5E5E3] bg-[#FAFAF8] px-4 py-4 sticky top-0 z-10">
        <div className="mx-auto max-w-[640px]">
          <h1 className="text-lg font-medium tracking-tight">MF-Facts</h1>
          <p className="text-sm text-[#6B6B6B]">Facts-only. No investment advice.</p>
        </div>
      </header>

      <main className="mx-auto max-w-[640px] px-4 py-8">
        {/* Welcome */}
        <section className="mb-8">
          <p className="mb-3 text-sm text-[#6B6B6B]">Covering these schemes:</p>
          <div className="flex flex-wrap gap-2">
            {SCHEMES.map((s) => (
              <span key={s.id} className="rounded-full border border-[#D4D4D2] px-3 py-1 text-xs text-[#4A4A4A]">
                {s.name}
              </span>
            ))}
          </div>
        </section>

        {/* Example questions */}
        <section className="mb-8">
          <p className="mb-3 text-sm text-[#6B6B6B]">Try asking:</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => handleExample(ex)}
                className="rounded-full border border-[#D4D4D2] px-3 py-1.5 text-xs text-[#4A4A4A] hover:border-[#1A1A1A] hover:text-[#1A1A1A] transition-colors cursor-pointer"
              >
                {ex}
              </button>
            ))}
          </div>
        </section>

        {/* Input */}
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a factual question about a scheme..."
              className="flex-1 rounded-lg border border-[#D4D4D2] bg-white px-4 py-3 text-sm outline-none focus:border-[#1A1A1A] transition-colors"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="rounded-lg bg-[#1A1A1A] px-5 py-3 text-sm font-medium text-white disabled:opacity-40 cursor-pointer hover:bg-[#333] transition-colors"
            >
              {loading ? "..." : "Ask"}
            </button>
          </div>
        </form>

        {/* Response cards */}
        {response && (
          <div className="space-y-4">
            {response.type === "answer" && <AnswerCard response={response} />}
            {response.type === "refusal" && <RefusalCard response={response} />}
            {response.type === "pii_block" && <PiiBlockCard />}
            {response.type === "out_of_scope" && <OutofScopeCard response={response} />}
            {response.type === "no_answer" && <NoAnswerCard response={response} />}
            {response.type === "error" && <ErrorCard response={response} />}
          </div>
        )}
      </main>
    </div>
  );
}

function AnswerCard({ response }: { response: QueryResponse }) {
  return (
    <div className="rounded-lg border border-[#D4D4D2] bg-white p-5">
      <p className="mb-4 text-sm leading-relaxed">{response.answer}</p>
      {response.source_url && (
        <div className="flex items-center gap-2 text-xs text-[#6B6B6B]">
          <span>Source:</span>
          <a
            href={response.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#2563EB] underline decoration-[#2563EB]/30 underline-offset-2 hover:decoration-[#2563EB] transition-colors"
          >
            {response.source_url.replace(/^https?:\/\//, "").split("/")[0]}
          </a>
          {response.last_updated && (
            <span className="ml-1">· Updated: {response.last_updated}</span>
          )}
        </div>
      )}
    </div>
  );
}

function RefusalCard({ response }: { response: QueryResponse }) {
  return (
    <div className="rounded-lg border border-[#E5D5A0] bg-[#FDF8ED] p-5">
      <p className="mb-3 text-sm leading-relaxed text-[#6B5A2E]">{response.message}</p>
      {response.source_url && (
        <a
          href={response.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[#2563EB] underline decoration-[#2563EB]/30 underline-offset-2 hover:decoration-[#2563EB] transition-colors"
        >
          Learn about mutual fund investing →
        </a>
      )}
    </div>
  );
}

function PiiBlockCard() {
  return (
    <div className="rounded-lg border border-[#E5A0A0] bg-[#FDF0F0] p-5">
      <p className="text-sm font-medium text-[#8B3A3A] mb-1">Personal information detected</p>
      <p className="text-sm text-[#6B4A4A]">
        Your query was blocked. No personal data was stored or processed.
      </p>
    </div>
  );
}

function OutofScopeCard({ response }: { response: QueryResponse }) {
  return (
    <div className="rounded-lg border border-[#D4D4D2] bg-white p-5">
      <p className="text-sm leading-relaxed whitespace-pre-line">{response.message}</p>
    </div>
  );
}

function NoAnswerCard({ response }: { response: QueryResponse }) {
  return (
    <div className="rounded-lg border border-[#D4D4D2] bg-white p-5">
      <p className="text-sm text-[#6B6B6B]">{response.message}</p>
    </div>
  );
}

function ErrorCard({ response }: { response: QueryResponse }) {
  return (
    <div className="rounded-lg border border-[#D4D4D2] bg-white p-5">
      <p className="text-sm text-[#6B6B6B]">{response.message}</p>
    </div>
  );
}
