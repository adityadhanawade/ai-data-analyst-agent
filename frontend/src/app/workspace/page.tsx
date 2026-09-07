"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { askQuestion, type AskResult } from "@/lib/api";

type Turn = {
  question: string;
  status: "thinking" | "done" | "error";
  result?: AskResult;
  errorMessage?: string;
  showCode?: boolean;
};

function WorkspaceContent() {
  const params = useSearchParams();
  const sessionId = params.get("session") || "";
  const filename = params.get("filename") || "dataset.csv";
  const rows = params.get("rows") || "?";
  const columns = (params.get("columns") || "").split(",").filter(Boolean);

  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");

  async function handleAsk() {
    const q = question.trim();
    if (!q || !sessionId) return;
    setQuestion("");
    setTurns((prev) => [...prev, { question: q, status: "thinking" }]);

    try {
      const result = await askQuestion(sessionId, q);
      setTurns((prev) =>
        prev.map((t, i) =>
          i === prev.length - 1 ? { ...t, status: "done", result } : t
        )
      );
    } catch (err) {
      setTurns((prev) =>
        prev.map((t, i) =>
          i === prev.length - 1
            ? {
                ...t,
                status: "error",
                errorMessage:
                  err instanceof Error ? err.message : "Something went wrong.",
              }
            : t
        )
      );
    }
  }

  function toggleCode(index: number) {
    setTurns((prev) =>
      prev.map((t, i) => (i === index ? { ...t, showCode: !t.showCode } : t))
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="flex items-center justify-between border-b border-border bg-surface px-8 py-4">
        <span className="text-base font-bold text-text-primary">DataAgent</span>
        <Link
          href="/"
          className="text-sm font-medium text-text-muted transition-colors hover:text-text-primary"
        >
          &larr; New dataset
        </Link>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-64 shrink-0 border-r border-border bg-surface p-4 sm:block">
          <div className="rounded-xl bg-primary-light p-3">
            <p className="text-sm font-semibold text-primary">{filename}</p>
            <p className="text-xs text-text-muted">
              {rows} rows &middot; {columns.length} columns
            </p>
          </div>
          {columns.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {columns.map((c) => (
                <span
                  key={c}
                  className="rounded-full bg-bg px-2.5 py-1 text-xs text-text-muted"
                >
                  {c}
                </span>
              ))}
            </div>
          )}
        </aside>

        <main className="flex flex-1 flex-col px-6 py-6 sm:px-10">
          <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4">
            {turns.length === 0 && (
              <p className="mt-8 text-center text-sm text-text-muted">
                Ask something about your data below - e.g. &quot;which category
                is declining?&quot;
              </p>
            )}

            <AnimatePresence initial={false}>
              {turns.map((turn, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col gap-2"
                >
                  <div className="self-end rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white">
                    {turn.question}
                  </div>

                  {turn.status === "thinking" && (
                    <div className="rounded-xl border border-amber-border bg-amber-bg px-4 py-3 text-sm text-amber-text">
                      Writing analysis code and checking the result...
                    </div>
                  )}

                  {turn.status === "error" && (
                    <div className="rounded-xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-text">
                      {turn.errorMessage}
                    </div>
                  )}

                  {turn.status === "done" && turn.result && (
                    <div className="rounded-xl border border-border bg-surface p-5">
                      <p className="text-sm text-text-primary">
                        {turn.result.explanation}
                      </p>
                      {turn.result.result_preview && (
                        <pre className="mt-3 overflow-x-auto rounded-lg bg-bg p-3 text-xs text-text-muted">
                          {turn.result.result_preview}
                        </pre>
                      )}
                      <button
                        onClick={() => toggleCode(i)}
                        className="mt-3 text-xs font-medium text-text-muted hover:text-text-primary"
                      >
                        {turn.showCode ? "^ Hide" : ">"} the code it ran
                        {turn.result.attempts > 1 &&
                          ` (took ${turn.result.attempts} attempts)`}
                      </button>
                      {turn.showCode && (
                        <pre className="mt-2 overflow-x-auto rounded-lg bg-[#0f172a] p-3 font-mono text-xs text-[#cbd5e1]">
                          {turn.result.code}
                        </pre>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="mx-auto mt-6 flex w-full max-w-3xl items-center gap-2 rounded-xl border border-border bg-surface p-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAsk()}
              placeholder="Ask a question about your data..."
              className="flex-1 bg-transparent px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted"
            />
            <button
              onClick={handleAsk}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
            >
              Ask
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={null}>
      <WorkspaceContent />
    </Suspense>
  );
}
