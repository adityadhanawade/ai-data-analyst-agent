"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { TextEffect } from "@/components/core/text-effect";
import { GlowEffect } from "@/components/core/glow-effect";
import { uploadDataset, wakeBackend } from "@/lib/api";

export default function UploadPage() {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isWaking, setIsWaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // The backend sleeps on Render's free tier after inactivity. Pinging it
  // as soon as the page loads gives it a head start on waking up before
  // the user has even picked a file.
  useEffect(() => {
    wakeBackend();
  }, []);

  async function uploadFile(file: File) {
    setError(null);
    setIsUploading(true);
    const wakingTimer = setTimeout(() => setIsWaking(true), 4000);
    try {
      const result = await uploadDataset(file);
      const params = new URLSearchParams({
        session: result.session_id,
        filename: result.filename,
        rows: String(result.rows),
        columns: result.columns.join(","),
      });
      router.push(`/workspace?${params.toString()}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong uploading that file."
      );
    } finally {
      clearTimeout(wakingTimer);
      setIsWaking(false);
      setIsUploading(false);
    }
  }

  function validateAndHandleFile(file: File | undefined) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("This file isn't a valid CSV. Please upload a .csv file under 10MB.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("That file is over 10MB. Please upload a smaller CSV.");
      return;
    }
    uploadFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    validateAndHandleFile(e.dataTransfer.files?.[0]);
  }

  async function trySampleDataset() {
    setError(null);
    setIsUploading(true);
    try {
      const res = await fetch("/sales_sample.csv");
      const blob = await res.blob();
      const file = new File([blob], "sales_sample.csv", { type: "text/csv" });
      await uploadFile(file);
    } catch {
      setError("Couldn't load the sample dataset. Try again.");
      setIsUploading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-center justify-between px-8 py-6 sm:px-16"
      >
        <span className="text-lg font-bold text-text-primary">DataAgent</span>
        <a
          href="#how-it-works"
          className="text-sm font-medium text-text-muted transition-colors hover:text-text-primary"
        >
          How it works
        </a>
      </motion.header>

      <main className="flex flex-1 flex-col items-center px-6 pt-14 sm:px-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="flex max-w-3xl flex-col items-center gap-5 text-center"
        >
          <TextEffect
            as="span"
            per="char"
            preset="fade"
            className="text-xs font-semibold tracking-[0.2em] text-primary"
          >
            SELF-CORRECTING DATA AGENT
          </TextEffect>
          <h1 className="text-4xl font-bold tracking-tight text-text-primary sm:text-5xl">
            Ask your data anything
          </h1>
          <p className="max-w-xl text-base text-text-muted">
            Upload a spreadsheet. The agent writes its own analysis code, checks
            its own work, and explains the result in plain English.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="mt-10 w-full max-w-3xl"
        >
          <div className="relative">
            {!error && (
              <GlowEffect
                colors={["rgba(63, 63, 70, 0.35)"]}
                mode="breathe"
                blur="medium"
                scale={1.03}
                duration={6}
                className="rounded-2xl"
              />
            )}
            <motion.div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => !isUploading && fileInputRef.current?.click()}
              animate={{
                scale: isDragging ? 1.015 : 1,
                borderColor: error
                  ? "var(--color-danger-border)"
                  : "var(--color-primary)",
                backgroundColor: error
                  ? "var(--color-danger-bg)"
                  : isDragging
                  ? "#dbe4fb"
                  : "var(--color-primary-light)",
              }}
              transition={{ duration: 0.2 }}
              className={`relative flex h-44 flex-col items-center justify-center gap-1 rounded-2xl border-[1.5px] border-dashed ${
                isUploading ? "cursor-wait" : "cursor-pointer"
              }`}
            >
              <p
                className={`text-base font-semibold ${
                  error ? "text-danger-text" : "text-text-primary"
                }`}
              >
                {isUploading
                  ? isWaking
                    ? "Waking up the server..."
                    : "Uploading..."
                  : error
                  ? error
                  : "Drop your CSV here"}
              </p>
              {isUploading && isWaking && (
                <p className="text-sm text-text-muted">
                  The free-tier backend sleeps when idle - this can take up
                  to a minute on the first request.
                </p>
              )}
              {!error && !isUploading && (
                <p className="text-sm text-text-muted">
                  or click to browse - .csv, up to 10MB
                </p>
              )}
            </motion.div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => validateAndHandleFile(e.target.files?.[0])}
          />
        </motion.div>

        <motion.button
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          disabled={isUploading}
          onClick={trySampleDataset}
          className="mt-6 rounded-lg border border-border bg-surface px-5 py-3 text-sm font-medium text-primary shadow-sm transition-shadow hover:shadow-md disabled:opacity-50"
        >
          Try the sample sales dataset -&gt;
        </motion.button>
      </main>

      <section
        id="how-it-works"
        className="mx-auto mt-28 w-full max-w-5xl scroll-mt-16 px-6 pb-24 sm:px-16"
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mb-10 text-center"
        >
          <span className="text-xs font-semibold tracking-[0.2em] text-primary">
            HOW IT WORKS
          </span>
          <h2 className="mt-3 text-2xl font-bold text-text-primary sm:text-3xl">
            An agent that checks its own work
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-text-muted">
            Most tools return whatever a model produces on the first try.
            DataAgent writes real code, runs it, and rewrites it when
            something looks wrong - before it ever answers you.
          </p>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              step: "1",
              title: "Upload",
              body: "Drop a CSV, or try the sample dataset - no schema setup needed.",
            },
            {
              step: "2",
              title: "Ask",
              body: "Type a question in plain English, the same way you'd ask a colleague.",
            },
            {
              step: "3",
              title: "Self-correct",
              body: "The agent writes pandas code, runs it safely, and rewrites it on its own if it fails - up to 3 tries.",
              highlight: true,
            },
            {
              step: "4",
              title: "Explain",
              body: "You get a plain-English answer, a chart when it helps, and the option to see the exact code.",
            },
          ].map((item, i) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{
                duration: 0.5,
                delay: i * 0.08,
                ease: [0.16, 1, 0.3, 1],
              }}
              className={`rounded-2xl border p-5 ${
                item.highlight
                  ? "border-amber-border bg-amber-bg"
                  : "border-border bg-surface"
              }`}
            >
              <span
                className={`text-xs font-semibold ${
                  item.highlight ? "text-amber-text" : "text-primary"
                }`}
              >
                STEP {item.step}
              </span>
              <h3 className="mt-2 text-base font-bold text-text-primary">
                {item.title}
              </h3>
              <p className="mt-1.5 text-sm text-text-muted">{item.body}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
