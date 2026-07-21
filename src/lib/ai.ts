/** AI calls go through the web API (server holds the model keys). */
import { authedFetch, supabase } from "./supabase";
import { toAudioJsonPayload, type RecordingResult } from "./recorder";
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

function extForMime(mime: string): string {
  const t = (mime || "").toLowerCase();
  if (t.includes("mpeg") || t.includes("mp3")) return "mp3";
  if (t.includes("wav")) return "wav";
  if (t.includes("ogg")) return "ogg";
  if (t.includes("flac")) return "flac";
  if (t.includes("aac")) return "aac";
  if (t.includes("m4a")) return "m4a";
  if (t.includes("mp4")) return "m4a";
  return "webm";
}

/**
 * Decode a base64 string to bytes. Prefers a native atob when present, otherwise
 * decodes manually (Hermes doesn't always expose atob). Assumes standard base64.
 */
function base64ToBytes(b64: string): Uint8Array {
  const atobFn = (globalThis as { atob?: (s: string) => string }).atob;
  if (atobFn) {
    const bin = atobFn(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, "");
  const len = Math.floor((clean.length * 3) / 4);
  const out = new Uint8Array(len);
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = CHARS.indexOf(clean[i]);
    const b = CHARS.indexOf(clean[i + 1]);
    const c = CHARS.indexOf(clean[i + 2]);
    const d = CHARS.indexOf(clean[i + 3]);
    const n = (a << 18) | (b << 12) | ((c & 63) << 6) | (d & 63);
    if (p < len) out[p++] = (n >> 16) & 255;
    if (c !== -1 && p < len) out[p++] = (n >> 8) & 255;
    if (d !== -1 && p < len) out[p++] = n & 255;
  }
  return out;
}

/**
 * Upload the recording DIRECTLY to Supabase Storage and return its path.
 * This bypasses the web API's request body entirely, so long recordings no
 * longer hit Netlify's 6MB synchronous-function body limit. Path convention:
 * `${userId}/<timestamp>.<ext>` — enforced by the bucket's per-user RLS policy.
 */
async function uploadRecordingToStorage(
  rec: RecordingResult,
): Promise<{ storagePath: string; mimeType: string }> {
  const { audioBase64, mimeType } = await toAudioJsonPayload(rec);
  const { data: { user } } = await supabase.auth.getUser();
  const uid = user?.id;
  if (!uid) throw new Error("Oturum bulunamadı, tekrar giriş yap.");

  const path = `${uid}/${Date.now()}.${extForMime(mimeType)}`;
  const bytes = base64ToBytes(audioBase64);

  const { error } = await supabase.storage
    .from("recordings")
    // ArrayBuffer is the reliable RN upload body (Blob can produce 0-byte files).
    .upload(path, bytes.buffer, { contentType: mimeType, upsert: false });

  if (error) throw new Error(error.message || "Ses kaydı yüklenemedi.");
  return { storagePath: path, mimeType };
}

export async function transcribeAudio(rec: RecordingResult): Promise<string> {
  // Upload to Storage first, then send only the tiny { storagePath, mimeType }
  // reference to the API. Works identically on web and native.
  const { storagePath, mimeType } = await uploadRecordingToStorage(rec);
  const res = await authedFetch("/api/ai/transcribe", {
    method: "POST",
    body: JSON.stringify({ storagePath, mimeType }),
  });
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
