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

export async function uploadDataset(file: File): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/upload`, { method: "POST", body: formData });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

export async function askQuestion(sessionId: string, question: string): Promise<AskResult> {
  const res = await fetch(`${API_BASE}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, question }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}
