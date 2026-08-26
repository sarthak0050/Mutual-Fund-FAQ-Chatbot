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
    <div className="flex h-screen flex-col bg-[#FAFAF8] text-[#1A1A1A]">
      {/* Header */}
      <header className="shrink-0 border-b border-[#E5E5E3] bg-[#FAFAF8] px-4 py-3">
        <div className="mx-auto flex max-w-[640px] items-baseline justify-between">
          <div>
            <h1 className="text-base font-semibold tracking-tight">MF-Facts</h1>
            <p className="text-[11px] text-[#8A8A88]">Facts-only. No investment advice.</p>
          </div>
          <span className="text-[10px] text-[#ACACA8]">RAG-powered</span>
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
                  <div className="rounded-xl rounded-bl-sm border border-[#E5E5E3] bg-white px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ACACA8]" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ACACA8]" style={{ animationDelay: "0.15s" }} />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ACACA8]" style={{ animationDelay: "0.3s" }} />
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
      <footer className="shrink-0 border-t border-[#E5E5E3] bg-[#FAFAF8] px-4 py-3">
        <form onSubmit={handleSubmit} className="mx-auto flex max-w-[640px] gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about a scheme..."
            disabled={loading}
            className="flex-1 rounded-lg border border-[#D4D4D2] bg-white px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-[#ACACA8] focus:border-[#1A1A1A] disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="shrink-0 rounded-lg bg-[#1A1A1A] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#333] disabled:cursor-not-allowed disabled:opacity-30"
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
    <div className="flex flex-col items-center py-16 text-center">
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-[#E5E5E3] bg-white">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ACACA8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>
      <h2 className="mb-1 text-sm font-medium">MF-Facts</h2>
      <p className="mb-6 max-w-[320px] text-xs leading-relaxed text-[#6B6B6B]">
        Factual answers about HDFC mutual fund schemes, sourced from official AMC documentation.
      </p>

      <div className="mb-6">
        <p className="mb-2 text-[10px] uppercase tracking-wider text-[#ACACA8]">Covering</p>
        <div className="flex flex-wrap justify-center gap-1.5">
          {SCHEMES.map((s) => (
            <span key={s} className="rounded-full border border-[#E5E5E3] bg-white px-2.5 py-1 text-[11px] text-[#4A4A4A]">
              {s}
            </span>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[10px] uppercase tracking-wider text-[#ACACA8]">Try asking</p>
        <div className="flex flex-col gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => onExample(ex)}
              className="rounded-lg border border-[#E5E5E3] bg-white px-3 py-2 text-left text-xs text-[#4A4A4A] transition-colors hover:border-[#1A1A1A] hover:text-[#1A1A1A] cursor-pointer"
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

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "rounded-br-sm bg-[#1A1A1A] text-white"
            : "rounded-bl-sm border border-[#E5E5E3] bg-white text-[#1A1A1A]"
        }`}
      >
        {/* PII block gets special styling */}
        {message.type === "pii_block" && !isUser ? (
          <div>
            <p className="mb-1 font-medium text-[#8B3A3A]">Personal information detected</p>
            <p className="text-[#6B4A4A]">{message.content}</p>
          </div>
        ) : (
          <p className="whitespace-pre-line">{message.content}</p>
        )}

        {/* Source link for answers */}
        {!isUser && message.type === "answer" && message.source_url && (
          <div className="mt-3 border-t border-[#F0F0EE] pt-2">
            <a
              href={message.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-[#2563EB] transition-colors hover:underline"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              {message.source_url.replace(/^https?:\/\//, "").split("/")[0]}
            </a>
          </div>
        )}

        {/* SEBI link for refusals */}
        {!isUser && message.type === "refusal" && message.source_url && (
          <div className="mt-3 border-t border-[#F0EFE3] pt-2">
            <a
              href={message.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-[#2563EB] transition-colors hover:underline"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Learn about mutual fund investing
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
