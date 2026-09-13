const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type UploadResult = {
  session_id: string;
  filename: string;
  rows: number;
  columns: string[];
};

export type AskResult = {
  success: boolean;
  explanation: string;
  result_preview: string | null;
  result_table: { columns: string[]; rows: Record<string, string | number>[] } | null;
  chart: { type: string; labels: string[]; datasets: { label: string; data: number[] }[] };
  code: string;
  attempts: number;
};

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body.detail || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

/**
 * The backend runs on Render's free tier, which fully sleeps after a period
 * of inactivity. Waking it back up can take 30-60s, and while it's booting
 * the request can fail at the network level (connection refused/reset)
 * rather than coming back as a normal HTTP error - fetch() surfaces that as
 * a generic "Failed to fetch" with no useful detail. Retrying a few times
 * with a short delay rides out that boot window instead of surfacing a
 * confusing error on the very first attempt.
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  { retries = 8, delayMs = 5000 }: { retries?: number; delayMs?: number } = {}
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetch(url, init);
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw new Error(
    lastError instanceof Error
      ? `Couldn't reach the server after several tries: ${lastError.message}`
      : "Couldn't reach the server after several tries."
  );
}

/**
 * Fire-and-forget ping to wake the backend as early as possible - call this
 * as soon as the landing page mounts, so by the time someone picks a file
 * the free-tier server has had a head start on waking up.
 */
export function wakeBackend(): void {
  fetch(`${API_BASE}/health`).catch(() => {
    // Ignored - this is just a warm-up ping, the real request will retry.
  });
}

export async function uploadDataset(file: File): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetchWithRetry(`${API_BASE}/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

export async function askQuestion(sessionId: string, question: string): Promise<AskResult> {
  const res = await fetchWithRetry(`${API_BASE}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, question }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}
