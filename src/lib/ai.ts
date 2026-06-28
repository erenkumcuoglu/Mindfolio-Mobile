/** AI calls go through the web API (server holds the model keys). */
import { authedFetch } from "./supabase";
import { toAudioFormData, type RecordingResult } from "./recorder";
import type { LinkPreview } from "./data";

/** Fetch link preview metadata (thumbnail + title + description) for a URL. */
export async function fetchLinkPreview(url: string): Promise<LinkPreview | null> {
  try {
    const res = await authedFetch("/api/preview", {
      method: "POST",
      body: JSON.stringify({ url }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.preview as LinkPreview) ?? null;
  } catch {
    return null;
  }
}

export async function transcribeAudio(rec: RecordingResult): Promise<string> {
  const res = await authedFetch("/api/ai/transcribe", {
    method: "POST",
    body: toAudioFormData(rec),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Transkripsiyon başarısız oldu");
  return (data.text as string) ?? "";
}

export type GenFormat = "blog" | "linkedin" | "x" | "substack" | "raw";

export async function generate(prompt: string, format: GenFormat): Promise<string> {
  const res = await authedFetch("/api/ai/generate", {
    method: "POST",
    body: JSON.stringify({ prompt, format }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "İçerik üretilemedi");
  return (data.text as string) ?? "";
}
