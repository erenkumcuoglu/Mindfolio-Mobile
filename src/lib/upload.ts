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

    return { ok: true, name, rec: { kind: "uri", uri: asset.uri, type: mime } };
  } catch (e) {
    return { ok: false, reason: "error", message: e instanceof Error ? e.message : undefined };
  }
}
