"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { askQuestion, type AskResult } from "@/lib/api";
import AnswerChart from "@/components/AnswerChart";

type Turn = {
  question: string;
  status: "thinking" | "done" | "error";
  result?: AskResult;
  errorMessage?: string;
  showCode?: boolean;
};

const SUGGESTIONS = [
  "Which category is declining?",
  "Show the top values over time",
  "Break that down by group",
];

function WorkspaceContent() {
  const params = useSearchParams();
  const sessionId = params.get("session") || "";
  const filename = params.get("filename") || "dataset.csv";
  const rows = params.get("rows") || "?";
  const columns = (params.get("columns") || "").split(",").filter(Boolean);

  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");

  async function submitQuestion(q: string) {
    if (!q.trim() || !sessionId) return;
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

  const isBusy = turns.some((t) => t.status === "thinking");

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="flex items-center justify-between border-b border-border bg-surface px-8 py-4">
        <span className="text-base font-bold text-text-primary">DataAgent</span>
        <Link
          href="/"
          className="text-sm font-medium text-text-muted transition-colors hover:text-text-primary"
        >
          &larr; Home
        </Link>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-64 shrink-0 flex-col gap-4 border-r border-border bg-surface p-4 sm:flex">
          <div className="rounded-xl bg-primary-light p-3">
            <p className="text-sm font-semibold text-primary">{filename}</p>
            <p className="text-xs text-text-muted">
              {rows} rows &middot; {columns.length} columns
            </p>
          </div>

          <div className="flex-1 overflow-y-auto">
            <p className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-text-muted">
              HISTORY
            </p>
            {turns.length === 0 ? (
              <p className="text-xs text-text-muted">
                Your questions will show up here.
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {turns.map((t, i) => (
                  <div
                    key={i}
                    className={`rounded-lg px-2.5 py-2 text-xs ${
                      i === turns.length - 1
                        ? "bg-bg font-medium text-text-primary"
                        : "text-text-muted"
                    }`}
                  >
                    &quot;{t.question}&quot;
                  </div>
                ))}
              </div>
            )}
          </div>

          <Link
            href="/"
            className="rounded-lg border border-border py-2 text-center text-sm font-medium text-text-primary transition-colors hover:bg-bg"
          >
            + New dataset
          </Link>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col px-6 py-6 sm:px-10">
          <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-1 flex-col gap-4">
            {turns.length === 0 && (
              <div className="mt-8 flex flex-col items-center gap-3 text-center">
                <p className="text-sm text-text-muted">
                  Not sure where to start? Try asking:
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => submitQuestion(s)}
                      className="rounded-full bg-primary-light px-3 py-1.5 text-xs font-medium text-primary transition-transform hover:scale-105"
                    >
                      &quot;{s}&quot;
                    </button>
                  ))}
                </div>
              </div>
            )}

            <AnimatePresence initial={false}>
              {turns.map((turn, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex min-w-0 flex-col gap-2"
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
                    <div className="min-w-0 rounded-xl border border-border bg-surface p-5">
                      <p className="text-sm text-text-primary">
                        {turn.result.explanation}
                      </p>

                      {(turn.result.chart.type !== "none" ||
                        turn.result.result_table) && (
                        <div className="mt-4 flex min-w-0 flex-col gap-4 sm:flex-row">
                          {turn.result.chart.type !== "none" && (
                            <div className="min-w-0 flex-1 rounded-lg bg-primary-light p-3">
                              <AnswerChart chart={turn.result.chart} />
                            </div>
                          )}
                          {turn.result.result_table && (
                            <div className="w-full min-w-0 rounded-lg border border-border p-3 sm:w-64">
                              <p className="mb-2 text-xs font-semibold text-text-muted">
                                Raw result
                              </p>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-text-muted">
                                      {turn.result.result_table.columns.map((c) => (
                                        <th key={c} className="pb-1 text-left font-medium whitespace-nowrap">
                                          {c}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {turn.result.result_table.rows.map((row, ri) => (
                                      <tr key={ri} className="text-text-primary">
                                        {turn.result!.result_table!.columns.map((c) => (
                                          <td key={c} className="py-0.5 whitespace-nowrap">
                                            {row[c]}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {turn.result.chart.type === "none" &&
                        !turn.result.result_table &&
                        turn.result.result_preview && (
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
              onKeyDown={(e) => e.key === "Enter" && submitQuestion(question)}
              placeholder="Ask a question about your data..."
              disabled={isBusy}
              className="flex-1 bg-transparent px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted disabled:opacity-50"
            />
            <button
              onClick={() => submitQuestion(question)}
              disabled={isBusy}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
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
