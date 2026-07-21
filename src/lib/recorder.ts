/**
 * Cross-platform audio recorder with a live frequency SPECTRUM (equalizer).
 *  - Web (Expo web): MediaRecorder + Web Audio AnalyserNode FFT → real spectrum.
 *  - Native (iOS/Android): expo-audio AudioRecorder class + polling metering.
 * subscribeSpectrum streams a normalized band array (0..1) for the equalizer.
 *
 * expo-av (deprecated) yerine expo-audio kullanılıyor.
 * AudioRecorder class'ını doğrudan instantiate ediyoruz (singleton pattern için).
 */
import { Platform } from "react-native";
import { AudioModule, RecordingPresets, setAudioModeAsync } from "expo-audio";
import type { AudioRecorder as ExpoAudioRecorder } from "expo-audio";

export type RecordingResult =
  | { kind: "blob"; blob: Blob; type: string }
  | { kind: "uri"; uri: string; type: string; cachedBase64?: string };

export const BAND_COUNT = 48;

// Konuşma için optimize preset — mono + 64 kbps. HIGH_QUALITY (~128 kbps stereo)
// yerine bunu kullanıyoruz: dosya boyutu ~yarıya iner (uzun kayıtlarda transcript
// yükleme/timeout riskini azaltır), konuşma kalitesi pratikte etkilenmez.
const SPEECH_PRESET = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  bitRate: 64000,
  web: { ...((RecordingPresets.HIGH_QUALITY as any).web ?? {}), bitsPerSecond: 64000 },
} as any;

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
let nativeRecording: ExpoAudioRecorder | null = null;
let nativeMeterInterval: ReturnType<typeof setInterval> | null = null;

function emitFromBins(bins: Uint8Array) {
  const usable = Math.floor(bins.length * 0.8);
  const per = Math.max(1, Math.floor(usable / BAND_COUNT));
  const bands: number[] = [];
  for (let b = 0; b < BAND_COUNT; b++) {
    let sum = 0;
    for (let i = 0; i < per; i++) sum += bins[b * per + i] ?? 0;
    const v = sum / per / 255;
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

// Önceki emit'in bantları — smoothing için tutuyoruz (pop-pop görünümü ortadan kalksın).
let prevBands: number[] | null = null;

function emitFromLevel(level: number) {
  const bands: number[] = new Array(BAND_COUNT);
  // Sessizlikte düz-hafif çizgi.
  if (level <= 0.05) {
    for (let i = 0; i < BAND_COUNT; i++) bands[i] = 0.04;
  } else {
    // Aktif ses — merkezi vurgulayan bell şekli + hafif per-band jitter.
    for (let i = 0; i < BAND_COUNT; i++) {
      const dist = Math.abs(i - BAND_COUNT / 2) / (BAND_COUNT / 2);
      const shape = 1 - dist * 0.5;
      bands[i] = Math.max(0.04, Math.min(1, level * shape * (0.85 + Math.random() * 0.25)));
    }
  }
  // Exponential smoothing — attack fast (0.55 yeni), release slow (0.25 yeni) → responsive + akıcı.
  if (prevBands) {
    for (let i = 0; i < BAND_COUNT; i++) {
      const alpha = bands[i] > prevBands[i] ? 0.55 : 0.25;
      bands[i] = prevBands[i] + (bands[i] - prevBands[i]) * alpha;
    }
  }
  prevBands = bands;
  spectrumCb?.(bands);
}

function stopNativeMeter() {
  if (nativeMeterInterval) { clearInterval(nativeMeterInterval); nativeMeterInterval = null; }
}

function startNativeMeter(rec: ExpoAudioRecorder) {
  stopNativeMeter();
  prevBands = null;
  // 40ms polling → ~25 FPS. Waveform akıcı olur. Ortam sesini bastırmak için
  // NOISE_FLOOR (-45dB) altındaki tüm değerler sessizlik sayılır.
  const NOISE_FLOOR = -45;
  const MAX_DB = -5;
  nativeMeterInterval = setInterval(() => {
    try {
      const status = (rec as any).getStatus?.();
      const dbfs: number | undefined = status?.metering;
      if (typeof dbfs === "number" && Number.isFinite(dbfs)) {
        if (dbfs < NOISE_FLOOR) {
          emitFromLevel(0.04);
        } else {
          // NOISE_FLOOR..MAX_DB aralığını 0..1'e map → konuşma sesine daha responsive.
          const norm = Math.max(0.04, Math.min(1, (dbfs - NOISE_FLOOR) / (MAX_DB - NOISE_FLOOR)));
          emitFromLevel(norm);
        }
      } else {
        emitFromLevel(0.04);
      }
    } catch {
      emitFromLevel(0.04);
    }
  }, 40);
}

/** Mikrofon izni iste. Kullanıcı akışında butona tıkladıktan sonra çağrılmalı. */
export async function requestMicPermission(): Promise<boolean> {
  if (Platform.OS === "web") {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      return true;
    } catch { return false; }
  }
  try {
    const res = await AudioModule.requestRecordingPermissionsAsync();
    return res.granted === true;
  } catch { return false; }
}

export async function startRecording(): Promise<void> {
  if (Platform.OS === "web") {
    webStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    webChunks = [];
    // 64 kbps — SPEECH_PRESET ile paralel; boyutu düşük tutar.
    webRecorder = new MediaRecorder(webStream, { audioBitsPerSecond: 64000 });
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

  // Native — expo-audio AudioRecorder class'ını doğrudan instantiate et
  // Not: İzin (requestMicPermission) daha önce iste. Burada tekrar istemiyoruz.
  await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true } as any);

  // metering aktif → waveform gerçek ses seviyesine tepki verir
  const preset = { ...SPEECH_PRESET, isMeteringEnabled: true } as any;
  // AudioModule.AudioRecorder — class'a NativeAudioModule üzerinden erişiyoruz.
  const RecorderClass = (AudioModule as any).AudioRecorder;
  if (!RecorderClass) {
    throw new Error("expo-audio AudioRecorder bulunamadı. Kurulum yeniden yapılmalı olabilir.");
  }
  const recorder: ExpoAudioRecorder = new RecorderClass(preset);
  await recorder.prepareToRecordAsync(preset);
  recorder.record();
  nativeRecording = recorder;
  startNativeMeter(recorder);
}

export async function pauseRecording(): Promise<void> {
  if (Platform.OS === "web") {
    stopWebMeterLoop();
    if (webRecorder?.state === "recording") webRecorder.pause();
    spectrumCb?.(new Array(BAND_COUNT).fill(0.04));
    return;
  }
  if (nativeRecording) {
    try { nativeRecording.pause(); } catch { /* ignore */ }
    stopNativeMeter();
  }
}

export async function resumeRecording(): Promise<void> {
  if (Platform.OS === "web") {
    if (webRecorder?.state === "paused") webRecorder.resume();
    startWebMeterLoop();
    return;
  }
  if (nativeRecording) {
    try { nativeRecording.record(); } catch { /* ignore */ }
    startNativeMeter(nativeRecording);
  }
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
  stopNativeMeter();
  try { await nativeRecording.stop(); } catch { /* ignore */ }
  const uri = nativeRecording.uri;
  nativeRecording = null;
  // MIME'i "audio/mp4" — m4a container'ının RFC standart tipi. RN FormData bunu tanır;
  // "audio/m4a" bazı polyfill'lerde "Unsupported FormDataPart" atıyordu.
  return uri ? { kind: "uri", uri, type: "audio/mp4" } : null;
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
      stopNativeMeter();
      try { await nativeRecording.stop(); } catch { /* ignore */ }
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
  if (t.includes("m4a")) return "m4a";
  if (t.includes("mp4")) return "m4a"; // ses için mp4 container = m4a uzantısı
  return "webm";
}

/**
 * Multipart FormData — WEB için.
 * Native (iOS/Android) client'lar `toAudioJsonPayload` kullansın; RN 0.85 New
 * Architecture'da FormData polyfill'i "Unsupported FormDataPart implementation"
 * hatası veriyor.
 */
export function toAudioFormData(rec: RecordingResult): FormData {
  const fd = new FormData();
  const ext = extForType(rec.type);
  if (rec.kind === "blob") {
    fd.append("audio", rec.blob, `recording.${ext}`);
  } else {
    fd.append("audio", { uri: rec.uri, name: `recording.${ext}`, type: rec.type || "audio/mp4" } as any);
  }
  return fd;
}

/**
 * Native (iOS/Android) transcribe payload — dosyayı base64'e çevir, JSON body ile
 * yolla. FormData polyfill bug'ını komple bypass eder. Backend hem multipart hem
 * bu JSON şemasını kabul ediyor.
 */
export async function toAudioJsonPayload(rec: RecordingResult): Promise<{ audioBase64: string; mimeType: string; filename: string }> {
  const ext = extForType(rec.type);
  const filename = `recording.${ext}`;
  const mimeType = rec.type || "audio/mp4";

  const blobToBase64 = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const s = String(reader.result || "");
        const comma = s.indexOf(",");
        resolve(comma >= 0 ? s.slice(comma + 1) : s);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });

  if (rec.kind === "blob") {
    return { audioBase64: await blobToBase64(rec.blob), mimeType, filename };
  }

  // Upload akışında pickAudioFile hemen base64 cache eder — uri iOS tarafından
  // silinse de veri elde kalır. Cache varsa direkt kullan.
  if (rec.cachedBase64) {
    return { audioBase64: rec.cachedBase64, mimeType, filename };
  }

  // Native — file:// URI. RN 0.85'te `fetch(uri).blob()` bazı build'lerde
  // "Creating blobs from 'arraybuffer' and 'arraybufferview' are not supported"
  // atıyor. Alternatif yollar sırayla:
  //   1. XHR responseType="blob" — native yol, Blob object'i doğrudan gelir
  //   2. XHR responseType="arraybuffer" + btoa manuel — hiç Blob'a dokunmadan base64
  let uri = rec.uri;
  if (!uri.startsWith("file://") && !uri.startsWith("http") && !uri.startsWith("content://")) {
    uri = "file://" + uri;
  }

  // 1) XHR blob dene
  try {
    const blob = await new Promise<Blob>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.responseType = "blob";
      xhr.onload = () => (xhr.status === 0 || xhr.status === 200 ? resolve(xhr.response) : reject(new Error(`status ${xhr.status}`)));
      xhr.onerror = () => reject(new Error("xhr blob failed"));
      xhr.open("GET", uri);
      xhr.send();
    });
    return { audioBase64: await blobToBase64(blob), mimeType, filename };
  } catch {
    // 2) arrayBuffer + btoa fallback
  }

  const buf: ArrayBuffer = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.responseType = "arraybuffer";
    xhr.onload = () => (xhr.status === 0 || xhr.status === 200 ? resolve(xhr.response) : reject(new Error(`status ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("xhr arraybuffer failed"));
    xhr.open("GET", uri);
    xhr.send();
  });
  const bytes = new Uint8Array(buf);
  // btoa yalnızca binary string kabul eder. Büyük dosyalarda parça parça çevir (call stack overflow'u önle).
  const CHUNK = 0x8000; // 32KB
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  const btoaFn: ((s: string) => string) | undefined = (globalThis as any).btoa;
  if (!btoaFn) throw new Error("btoa polyfill yok — base64 üretilemedi");
  return { audioBase64: btoaFn(binary), mimeType, filename };
}
