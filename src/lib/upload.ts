/** Pick an audio file from the device and adapt it to a RecordingResult. */
import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import type { RecordingResult } from "./recorder";

export const MAX_AUDIO_BYTES = 20 * 1024 * 1024; // matches the transcribe API limit

export type PickResult =
  | { ok: true; rec: RecordingResult; name: string }
  | { ok: false; reason: "canceled" | "too_large" | "error"; message?: string };

/** Open the system file picker for audio files. */
export async function pickAudioFile(): Promise<PickResult> {
  try {
    const res = await DocumentPicker.getDocumentAsync({
      type: "audio/*",
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (res.canceled) return { ok: false, reason: "canceled" };

    const asset = res.assets?.[0];
    if (!asset) return { ok: false, reason: "error", message: "Dosya okunamadı." };

    const name = asset.name || "ses-dosyasi";
    const mime = asset.mimeType || "audio/mpeg";

    if (typeof asset.size === "number" && asset.size > MAX_AUDIO_BYTES) {
      return { ok: false, reason: "too_large" };
    }

    if (Platform.OS === "web") {
      const file = (asset as { file?: File }).file;
      if (file) {
        if (file.size > MAX_AUDIO_BYTES) return { ok: false, reason: "too_large" };
        return { ok: true, name, rec: { kind: "blob", blob: file, type: file.type || mime } };
      }
      const blob = await fetch(asset.uri).then((r) => r.blob());
      if (blob.size > MAX_AUDIO_BYTES) return { ok: false, reason: "too_large" };
      return { ok: true, name, rec: { kind: "blob", blob, type: blob.type || mime } };
    }

    // KRİTİK: pickAudioFile'ın döndürdüğü uri iOS cache'inde geçici bir path.
    // Uygulama arka plana alınıp geri gelince veya ikinci upload yapılınca
    // "The file couldn't be opened because there is no such file" alıyoruz.
    // Fix: hemen base64'e cache et — uri stale olsa da veri elde kalır,
    // transcribe(toAudioJsonPayload) bunu direkt kullanır.
    try {
      const cachedBase64 = await readAsBase64(asset.uri);
      return { ok: true, name, rec: { kind: "uri", uri: asset.uri, type: mime, cachedBase64 } };
    } catch (e) {
      return { ok: false, reason: "error", message: e instanceof Error ? e.message : "Dosya okunamadı" };
    }
  } catch (e) {
    return { ok: false, reason: "error", message: e instanceof Error ? e.message : undefined };
  }
}

/** file:// URI'yi base64'e çevir. RN'de XHR responseType blob → FileReader ile. */
async function readAsBase64(uri: string): Promise<string> {
  let u = uri;
  if (!u.startsWith("file://") && !u.startsWith("http") && !u.startsWith("content://")) u = "file://" + u;
  const blob = await new Promise<Blob>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.responseType = "blob";
    xhr.onload = () => (xhr.status === 0 || xhr.status === 200 ? resolve(xhr.response) : reject(new Error(`status ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("xhr blob failed"));
    xhr.open("GET", u);
    xhr.send();
  });
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result || "");
      const comma = s.indexOf(",");
      resolve(comma >= 0 ? s.slice(comma + 1) : s);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
