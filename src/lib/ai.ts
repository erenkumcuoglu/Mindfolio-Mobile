/** AI calls go through Supabase (server holds the model keys). */
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

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 min ceiling

/** Poll a *_jobs row (transcript_jobs / generation_jobs) until done or error. */
async function pollJob(table: string, id: string): Promise<string> {
  const started = Date.now();
  while (Date.now() - started < POLL_TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const { data: row } = await supabase
      .from(table)
      .select("status, result, error")
      .eq("id", id)
      .single();
    if (row?.status === "done") return (row.result as string) ?? "";
    if (row?.status === "error") throw new Error((row.error as string) || "İşlem başarısız oldu");
  }
  throw new Error("İşlem zaman aşımına uğradı. Lütfen tekrar dene.");
}

/**
 * Upload the recording DIRECTLY to Supabase Storage and return its path.
 * Bypasses the web API request body so long recordings don't hit Netlify's 6MB
 * limit. Path convention: `${userId}/<timestamp>.<ext>` (per-user RLS).
 */
async function uploadRecordingToStorage(
  rec: RecordingResult,
): Promise<{ storagePath: string; mimeType: string; userId: string }> {
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
  return { storagePath: path, mimeType, userId: uid };
}

/**
 * Transcribe audio asynchronously.
 * Upload to Storage -> create a transcript_jobs row -> invoke the `transcribe`
 * Edge Function (runs Gemini in the background, off Netlify) -> poll the row.
 * Removes the synchronous-function timeout that killed long recordings.
 */
export async function transcribeAudio(rec: RecordingResult): Promise<string> {
  const { storagePath, mimeType, userId } = await uploadRecordingToStorage(rec);

  const { data: job, error: jobErr } = await supabase
    .from("transcript_jobs")
    .insert({ user_id: userId, storage_path: storagePath, mime_type: mimeType, status: "pending" })
    .select("id")
    .single();
  if (jobErr || !job?.id) throw new Error(jobErr?.message || "Transkripsiyon işi oluşturulamadı.");

  const { error: invokeErr } = await supabase.functions.invoke("transcribe", {
    body: { jobId: job.id },
  });
  if (invokeErr) throw new Error(invokeErr.message || "Transkripsiyon başlatılamadı.");

  return pollJob("transcript_jobs", job.id);
}

export type GenFormat = "blog" | "linkedin" | "x" | "substack" | "medium" | "raw";

/**
 * Generate content asynchronously.
 * Insert a generation_jobs row -> invoke the `generate` Edge Function (two-pass
 * runs off Netlify) -> poll the row. Fixes the 502/504 that long-transcript
 * drafts hit on the synchronous Netlify route.
 */
export async function generate(prompt: string, format: GenFormat): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  const uid = user?.id;
  if (!uid) throw new Error("Oturum bulunamadı, tekrar giriş yap.");

  const { data: job, error: jobErr } = await supabase
    .from("generation_jobs")
    .insert({ user_id: uid, prompt, format, status: "pending" })
    .select("id")
    .single();
  if (jobErr || !job?.id) throw new Error(jobErr?.message || "İçerik işi oluşturulamadı.");

  const { error: invokeErr } = await supabase.functions.invoke("generate", {
    body: { jobId: job.id },
  });
  if (invokeErr) throw new Error(invokeErr.message || "İçerik üretimi başlatılamadı.");

  return pollJob("generation_jobs", job.id);
}
