"use client";

import { useRef, useState } from "react";
import { motion } from "motion/react";

export default function UploadPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setError(null);
    // TODO: wire this up to the backend upload endpoint
    console.log("File accepted:", file.name);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    validateAndHandleFile(e.dataTransfer.files?.[0]);
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
          <span className="text-xs font-semibold tracking-[0.2em] text-primary">
            SELF-CORRECTING DATA AGENT
          </span>
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
          <motion.div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
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
            className="flex h-44 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-[1.5px] border-dashed"
          >
            <p
              className={`text-base font-semibold ${
                error ? "text-danger-text" : "text-text-primary"
              }`}
            >
              {error ? error : "Drop your CSV here"}
            </p>
            {!error && (
              <p className="text-sm text-text-muted">
                or click to browse - .csv, up to 10MB
              </p>
            )}
          </motion.div>
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
          className="mt-6 rounded-lg border border-border bg-surface px-5 py-3 text-sm font-medium text-primary shadow-sm transition-shadow hover:shadow-md"
        >
          Try the sample sales dataset -&gt;
        </motion.button>
      </main>
    </div>
  );
}
