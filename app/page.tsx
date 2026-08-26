"use client";

import { useState, useRef, useEffect } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
  type?: string;
  source_url?: string;
  last_updated?: string | null;
};

const SCHEMES = [
  "HDFC Top 100 Fund",
  "HDFC Flexi Cap Fund",
  "HDFC ELSS Tax Saver",
  "HDFC Mid-Cap Opportunities Fund",
];

const EXAMPLES = [
  "What is the expense ratio of HDFC Flexi Cap Fund?",
  "ELSS lock-in period?",
  "Who manages HDFC Mid-Cap Opportunities Fund?",
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();

      let assistantContent = "";
      if (data.type === "answer") {
        assistantContent = data.answer;
      } else if (data.type === "refusal") {
        assistantContent = data.message;
      } else if (data.type === "pii_block") {
        assistantContent = data.message;
      } else if (data.type === "out_of_scope") {
        assistantContent = data.message;
      } else if (data.type === "no_answer") {
        assistantContent = data.message;
      } else {
        assistantContent = data.message || "Something went wrong.";
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: assistantContent,
          type: data.type,
          source_url: data.source_url,
          last_updated: data.last_updated,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong. Please try again.", type: "error" },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleExample(example: string) {
    setInput(example);
    inputRef.current?.focus();
  }

  return (
    <div className="flex h-screen flex-col bg-white text-black">
      {/* Header */}
      <header className="shrink-0 border-b border-[#E8E8E8] bg-white px-4 py-4">
        <div className="mx-auto flex max-w-[640px] items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black">
              <span className="text-xs font-bold text-white">MF</span>
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight">MF-Facts</h1>
              <p className="text-[10px] text-[#666666]">Facts-only. No advice.</p>
            </div>
          </div>
          <span className="rounded-full bg-[#F7F7F7] px-2.5 py-1 text-[10px] font-medium text-[#666666]">RAG</span>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[640px] px-4 py-6">
          {messages.length === 0 ? (
            <EmptyState onExample={handleExample} />
          ) : (
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <MessageBubble key={i} message={msg} />
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-sm bg-[#F7F7F7] px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#999]" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#999]" style={{ animationDelay: "0.15s" }} />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#999]" style={{ animationDelay: "0.3s" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </main>

      {/* Input */}
      <footer className="shrink-0 border-t border-[#E8E8E8] bg-white px-4 py-4">
        <form onSubmit={handleSubmit} className="mx-auto flex max-w-[640px] gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about a scheme..."
            disabled={loading}
            className="flex-1 rounded-xl border border-[#E8E8E8] bg-[#F7F7F7] px-4 py-3 text-sm outline-none transition-colors placeholder:text-[#999] focus:border-black focus:bg-white disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="shrink-0 rounded-xl bg-black px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#333] disabled:cursor-not-allowed disabled:opacity-30"
          >
            {loading ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              "Ask"
            )}
          </button>
        </form>
      </footer>
    </div>
  );
}

function EmptyState({ onExample }: { onExample: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center py-20 text-center">
      <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-full bg-[#F7F7F7]">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>
      <h2 className="mb-2 text-lg font-semibold">MF-Facts</h2>
      <p className="mb-8 max-w-[320px] text-sm leading-relaxed text-[#666666]">
        Factual answers about HDFC mutual fund schemes, sourced from official documentation.
      </p>

      <div className="mb-10">
        <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-[#999]">Covering</p>
        <div className="flex flex-wrap justify-center gap-2">
          {SCHEMES.map((s) => (
            <span key={s} className="rounded-full border border-[#E8E8E8] px-3 py-1.5 text-xs font-medium text-[#333]">
              {s}
            </span>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-[#999]">Try asking</p>
        <div className="flex flex-col gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => onExample(ex)}
              className="rounded-xl border border-[#E8E8E8] bg-[#F7F7F7] px-4 py-3 text-left text-sm font-medium text-[#333] transition-colors hover:border-black hover:bg-white cursor-pointer"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-black px-4 py-3 text-sm leading-relaxed text-white">
          <p>{message.content}</p>
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%]">
        {/* PII block */}
        {message.type === "pii_block" ? (
          <div className="rounded-2xl rounded-bl-sm border border-[#FFCDD2] bg-[#FFF5F5] px-4 py-3">
            <p className="mb-1 text-sm font-medium text-[#E53935]">Personal information detected</p>
            <p className="text-sm text-[#666]">{message.content}</p>
          </div>
        ) : (
          <div className="rounded-2xl rounded-bl-sm bg-[#F7F7F7] px-4 py-3">
            <p className="whitespace-pre-line text-sm leading-relaxed">{message.content}</p>

            {/* Source link for answers */}
            {message.type === "answer" && message.source_url && (
              <div className="mt-3 border-t border-[#E8E8E8] pt-3">
                <a
                  href={message.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#00B86B] transition-colors hover:underline"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  {message.source_url.replace(/^https?:\/\//, "").split("/")[0]}
                </a>
              </div>
            )}

            {/* SEBI link for refusals */}
            {message.type === "refusal" && message.source_url && (
              <div className="mt-3 border-t border-[#E8E8E8] pt-3">
                <a
                  href={message.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#00B86B] transition-colors hover:underline"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  Learn about mutual fund investing
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
