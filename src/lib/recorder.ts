/**
 * Cross-platform audio recorder with a live frequency SPECTRUM (equalizer).
 *  - Web (Expo web): MediaRecorder + Web Audio AnalyserNode FFT → real spectrum.
 *  - Native (iOS/Android): expo-av Audio.Recording metering → spectrum approximated
 *    from the input level (no FFT available natively).
 * subscribeSpectrum streams a normalized band array (0..1) for the equalizer.
 */
import { Platform } from "react-native";
import { Audio } from "expo-av";

export type RecordingResult =
  | { kind: "blob"; blob: Blob; type: string }
  | { kind: "uri"; uri: string; type: string };

export const BAND_COUNT = 48;

let spectrumCb: ((bands: number[]) => void) | null = null;
export function subscribeSpectrum(cb: (bands: number[]) => void): () => void {
  spectrumCb = cb;
  return () => { if (spectrumCb === cb) spectrumCb = null; };
}

// ── Web internals ──
let webRecorder: MediaRecorder | null = null;
let webChunks: BlobPart[] = [];
let webStream: MediaStream | null = null;
let webAudioCtx: AudioContext | null = null;
let webAnalyser: AnalyserNode | null = null;
let webRaf: number | null = null;

// ── Native internals ──
let nativeRecording: Audio.Recording | null = null;

function emitFromBins(bins: Uint8Array) {
  // Downsample FFT bins into BAND_COUNT bands (skip the very top, mostly empty).
  const usable = Math.floor(bins.length * 0.8);
  const per = Math.max(1, Math.floor(usable / BAND_COUNT));
  const bands: number[] = [];
  for (let b = 0; b < BAND_COUNT; b++) {
    let sum = 0;
    for (let i = 0; i < per; i++) sum += bins[b * per + i] ?? 0;
    const v = sum / per / 255;
    // mild gamma so quiet input still shows movement
    bands.push(Math.min(1, Math.pow(v, 0.7) * 1.15));
  }
  spectrumCb?.(bands);
}

function startWebMeterLoop() {
  if (!webAnalyser) return;
  const buf = new Uint8Array(webAnalyser.frequencyBinCount);
  const tick = () => {
    if (!webAnalyser) return;
    webAnalyser.getByteFrequencyData(buf);
    emitFromBins(buf);
    webRaf = requestAnimationFrame(tick);
  };
  tick();
}

function stopWebMeterLoop() {
  if (webRaf != null) { cancelAnimationFrame(webRaf); webRaf = null; }
}

function emitFromLevel(level: number) {
  // Approximate an equalizer from a single level: bell shape + jitter.
  const bands: number[] = [];
  for (let i = 0; i < BAND_COUNT; i++) {
    const dist = Math.abs(i - BAND_COUNT / 2) / (BAND_COUNT / 2);
    const shape = 1 - dist * 0.6;
    bands.push(Math.max(0.04, Math.min(1, level * shape * (0.7 + Math.random() * 0.6))));
  }
  spectrumCb?.(bands);
}

function meterToLevel(db: number): number {
  return Math.max(0, Math.min(1, (db + 60) / 60));
}

export async function startRecording(): Promise<void> {
  if (Platform.OS === "web") {
    webStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    webChunks = [];
    webRecorder = new MediaRecorder(webStream);
    webRecorder.ondataavailable = (e) => { if (e.data.size) webChunks.push(e.data); };
    webRecorder.start();

    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    webAudioCtx = new Ctx();
    const source = webAudioCtx.createMediaStreamSource(webStream);
    webAnalyser = webAudioCtx.createAnalyser();
    webAnalyser.fftSize = 256;
    webAnalyser.smoothingTimeConstant = 0.72;
    source.connect(webAnalyser);
    startWebMeterLoop();
    return;
  }

  await Audio.requestPermissionsAsync();
  await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
  const { recording } = await Audio.Recording.createAsync(
    { ...Audio.RecordingOptionsPresets.HIGH_QUALITY, isMeteringEnabled: true },
    (status) => {
      if (status.isRecording && typeof status.metering === "number") {
        emitFromLevel(meterToLevel(status.metering));
      }
    },
    100
  );
  nativeRecording = recording;
}

export async function pauseRecording(): Promise<void> {
  if (Platform.OS === "web") {
    stopWebMeterLoop();
    if (webRecorder?.state === "recording") webRecorder.pause();
    spectrumCb?.(new Array(BAND_COUNT).fill(0.04));
    return;
  }
  if (nativeRecording) await nativeRecording.pauseAsync();
}

export async function resumeRecording(): Promise<void> {
  if (Platform.OS === "web") {
    if (webRecorder?.state === "paused") webRecorder.resume();
    startWebMeterLoop();
    return;
  }
  if (nativeRecording) await nativeRecording.startAsync();
}

function teardownWeb() {
  stopWebMeterLoop();
  if (webAudioCtx) { webAudioCtx.close().catch(() => {}); webAudioCtx = null; }
  webAnalyser = null;
}

export async function stopRecording(): Promise<RecordingResult | null> {
  if (Platform.OS === "web") {
    teardownWeb();
    if (!webRecorder) return null;
    const rec = webRecorder;
    const blob = await new Promise<Blob>((resolve) => {
      rec.onstop = () => resolve(new Blob(webChunks, { type: rec.mimeType || "audio/webm" }));
      if (rec.state !== "inactive") rec.stop();
      else resolve(new Blob(webChunks, { type: "audio/webm" }));
    });
    webStream?.getTracks().forEach((t) => t.stop());
    webRecorder = null;
    webStream = null;
    return { kind: "blob", blob, type: blob.type || "audio/webm" };
  }

  if (!nativeRecording) return null;
  await nativeRecording.stopAndUnloadAsync();
  const uri = nativeRecording.getURI();
  nativeRecording = null;
  return uri ? { kind: "uri", uri, type: "audio/m4a" } : null;
}

export async function cancelRecording(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      teardownWeb();
      if (webRecorder && webRecorder.state !== "inactive") webRecorder.stop();
      webStream?.getTracks().forEach((t) => t.stop());
      webRecorder = null;
      webStream = null;
    } else if (nativeRecording) {
      await nativeRecording.stopAndUnloadAsync();
      nativeRecording = null;
    }
  } catch {
    // ignore
  } finally {
    spectrumCb = null;
  }
}

function extForType(type: string): string {
  const t = (type || "").toLowerCase();
  if (t.includes("mpeg") || t.includes("mp3")) return "mp3";
  if (t.includes("wav")) return "wav";
  if (t.includes("ogg")) return "ogg";
  if (t.includes("flac")) return "flac";
  if (t.includes("aac")) return "aac";
  if (t.includes("mp4")) return "mp4";
  if (t.includes("m4a")) return "m4a";
  return "webm";
}

/** Build the multipart body for /api/ai/transcribe from a recording result. */
export function toAudioFormData(rec: RecordingResult): FormData {
  const fd = new FormData();
  const ext = extForType(rec.type);
  if (rec.kind === "blob") {
    fd.append("audio", rec.blob, `recording.${ext}`);
  } else {
    fd.append("audio", { uri: rec.uri, name: `recording.${ext}`, type: rec.type } as unknown as Blob);
  }
  return fd;
}
