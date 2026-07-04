/** AI calls go through the web API (server holds the model keys). */
import { Platform } from "react-native";
import { authedFetch } from "./supabase";
import { toAudioFormData, toAudioJsonPayload, type RecordingResult } from "./recorder";
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
  // Native — JSON base64 body (FormData polyfill'ini bypass etmek için).
  // Web — multipart FormData (Blob desteği native, sorun yok).
  let res: Response;
  if (Platform.OS === "web") {
    res = await authedFetch("/api/ai/transcribe", {
      method: "POST",
      body: toAudioFormData(rec),
    });
  } else {
    const payload = await toAudioJsonPayload(rec);
    res = await authedFetch("/api/ai/transcribe", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Transkripsiyon başarısız oldu");
  return (data.text as string) ?? "";
}

export type GenFormat = "blog" | "linkedin" | "x" | "substack" | "medium" | "raw";

export async function generate(prompt: string, format: GenFormat): Promise<string> {
  const res = await authedFetch("/api/ai/generate", {
    method: "POST",
    body: JSON.stringify({ prompt, format }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "İçerik üretilemedi");
  return (data.text as string) ?? "";
}
