import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Modal,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { radii, spacing, type Palette } from "../theme/tokens";
import {
  startRecording,
  stopRecording,
  cancelRecording,
  pauseRecording,
  resumeRecording,
  subscribeSpectrum,
  BAND_COUNT,
  type RecordingResult,
} from "../lib/recorder";
import { transcribeAudio, generate, type GenFormat } from "../lib/ai";
import { saveContent, isProUser } from "../lib/data";
import { requestMicPermission } from "../lib/recorder";
import { confirmAsync, alertMsg } from "../lib/confirm";
import { loadStudioSession, saveStudioSession, clearStudioSession } from "../lib/studio-session";
import { isTR } from "../lib/i18n";
import { MicSmallIcon } from "../components/icons";
import { Markdown } from "../components/Markdown";

type Step = "countdown" | "recording" | "segments" | "transcribing" | "transcript" | "generating" | "draft";
type Segment = { id: number; rec: RecordingResult; duration: number };

const platLabel = (f: GenFormat) =>
  f === "linkedin" ? "LinkedIn" : f === "x" ? "X / Twitter" : f === "substack" ? "Substack" : f === "medium" ? "Medium" : "Blog";

interface Props {
  onExit: () => void;
  /** When set, skip live recording and transcribe this uploaded audio directly. */
  initialUpload?: RecordingResult | null;
  /** When true, resume the saved session immediately (no prompt) — used when
   *  the user taps the in-progress item under "Son Kayıtlar". */
  resumeDirect?: boolean;
}

const OUTPUT_LANGUAGES = [
  { value: "Turkish", label: "Türkçe" },
  { value: "English", label: "English" },
  { value: "Spanish", label: "Español" },
  { value: "French", label: "Français" },
  { value: "German", label: "Deutsch" },
  { value: "Italian", label: "Italiano" },
  { value: "Portuguese", label: "Português" },
  { value: "Japanese", label: "日本語" },
  { value: "Korean", label: "한국어" },
  { value: "Chinese", label: "中文" },
  { value: "Arabic", label: "العربية" },
];
const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export default function RecordingFlow({ onExit, initialUpload, resumeDirect }: Props) {
  const { c } = useTheme();
  const styles = makeStyles(c);
  // Yüklenen dosya için otomatik transcript yapmayı kaldırdık — kullanıcı
  // segment eklemek ya da direkt transcript almak arasında seçim yapabilsin.
  const [step, setStep] = useState<Step>(initialUpload ? "segments" : "countdown");
  const [pendingResume, setPendingResume] = useState<{ transcript: string; draft: string; excerpts?: Record<string, string> } | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [paused, setPaused] = useState(false);
  const [count, setCount] = useState(3);
  const [resumeChecked, setResumeChecked] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [draft, setDraft] = useState("");
  const [outLang, setOutLang] = useState(isTR ? "Turkish" : "English");
  const [notes, setNotes] = useState("");
  const [excerpts, setExcerpts] = useState<Partial<Record<GenFormat, string>>>({});
  const [busyFormat, setBusyFormat] = useState<GenFormat | null>(null);
  const [saving, setSaving] = useState(false);
  const [isPro, setIsPro] = useState(false);
  useEffect(() => { isProUser().then(setIsPro); }, []);
  // Ücretsiz kullanıcı için kayıt üst limiti (saniye)
  const FREE_MAX_SECS = 30;
  // Studio paylaş animasyonu — sharePl: hangi platform o anda paylaşılıyor; sharedPls: kalıcı durum.
  const [sharePl, setSharePl] = useState<GenFormat | null>(null);
  const [sharedPls, setSharedPls] = useState<Partial<Record<GenFormat, boolean>>>({});
  const segId = useRef(0);

  // Paylaş — 2.2s pulse animasyonu sonra ✓ Paylaşıldı kalıcı.
  const doShare = (fmt: GenFormat) => {
    if (sharePl) return;
    setSharePl(fmt);
    setTimeout(() => {
      setSharedPls((prev) => ({ ...prev, [fmt]: true }));
      setSharePl(null);
    }, 2200);
  };

  // On mount: yükleme varsa segment olarak ekle (auto-transcribe YOK), yoksa kayıt akışına gir.
  useEffect(() => {
    if (initialUpload) {
      const seg = { id: ++segId.current, rec: initialUpload, duration: 0 };
      setSegments([seg]);
      // step zaten "segments" — kullanıcı ekleme/transkripte geçme seçimini yapsın.
      return;
    }
    (async () => {
      const saved = await loadStudioSession();
      if (saved && (saved.transcript.trim() || saved.draft.trim())) {
        if (resumeDirect) {
          restoreSession(saved);
          return;
        }
        // Show the themed resume popup; wait for the user's choice.
        setPendingResume(saved);
        return;
      }
      // Not resuming → let the 3-2-1 countdown start the recording.
      setResumeChecked(true);
    })();
    return () => { cancelRecording(); };
  }, []);

  const restoreSession = (saved: { transcript: string; draft: string; excerpts?: Record<string, string> }) => {
    setTranscript(saved.transcript);
    if (saved.excerpts) setExcerpts(saved.excerpts as Partial<Record<GenFormat, string>>);
    if (saved.draft.trim()) { setDraft(saved.draft); setStep("draft"); }
    else setStep("transcript");
  };

  // 3-2-1 countdown, then begin recording.
  useEffect(() => {
    if (step !== "countdown" || !resumeChecked) return;

    // Önce mikrofon izni iste — kullanıcı bilinçli olarak butona bastıktan sonra.
    // Reddederse geri sayıma başlamıyoruz.
    let cancelled = false;
    (async () => {
      const ok = await requestMicPermission();
      if (cancelled) return;
      if (!ok) {
        alertMsg("Mikrofon izni gerekli", "Ayarlar → Mindfolio → Mikrofon'dan izin verebilirsin. Sonra tekrar dene.");
        onExit();
        return;
      }
      // İzin alındı — geri sayımı başlat
      setCount(3);
      let n = 3;
      const id = setInterval(() => {
        n -= 1;
        if (n <= 0) {
          clearInterval(id);
          startRecording()
            .then(() => { setSeconds(0); setStep("recording"); })
            .catch((e: any) => {
              alertMsg("Mikrofon", e?.message ?? "Kayıt başlatılamadı.");
              onExit();
            });
        } else {
          setCount(n);
        }
      }, 800);
      // Effect cleanup için timer'ı sakla
      (window as any).__recCountdownTimer = id;
    })();

    return () => {
      cancelled = true;
      const id = (window as any).__recCountdownTimer;
      if (id) { clearInterval(id); (window as any).__recCountdownTimer = null; }
    };
  }, [step, resumeChecked]);

  // Persist in-progress text so it survives leaving the screen (24h TTL).
  useEffect(() => {
    if (step === "transcript" || step === "draft") {
      saveStudioSession({ transcript, draft });
    }
  }, [transcript, draft, step]);

  // Per-clip timer (frozen while paused).
  useEffect(() => {
    if (step !== "recording" || paused) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [step, paused]);

  // Ücretsiz kullanıcı için 30sn'de otomatik durdur.
  useEffect(() => {
    if (step !== "recording" || paused || isPro) return;
    if (seconds >= FREE_MAX_SECS) {
      alertMsg("30 saniye limiti", "Ücretsiz kullanımda kayıt 30 saniye ile sınırlı. Pro'ya geçerek limitsiz kayıt yap.");
      endSegment();
    }
  }, [seconds, step, paused, isPro]);

  const togglePause = async () => {
    if (paused) { await resumeRecording(); setPaused(false); }
    else { await pauseRecording(); setPaused(true); }
  };

  // Leaving while still recording/segmenting: the not-yet-transcribed AUDIO is
  // lost (can't be persisted), but any transcript/draft stays saved for 24h.
  const leaveRecording = async () => {
    const ok = await confirmAsync(
      "Ses kaydı silinecek",
      "Bu kaydı henüz yazıya çevirmedin. Çıkarsan, kişisel verilerin gizliliği ve güvenliği gereği ses kaydın silinir ve geri alınamaz.",
      { confirmLabel: "Sil ve çık", cancelLabel: "Devam et" }
    );
    if (ok) { cancelRecording(); onExit(); }
  };

  // Leaving from transcript/draft: work is already auto-saved — just exit and
  // resume later. No discard.
  const leaveSaved = () => { cancelRecording(); onExit(); };

  // Durdur → end current clip, add as a segment, go to the segments list.
  const endSegment = async () => {
    try {
      const rec = await stopRecording();
      if (rec) {
        setSegments((prev) => [...prev, { id: ++segId.current, rec, duration: seconds }]);
      }
    } catch {
      // ignore
    }
    setPaused(false);
    setSeconds(0);
    setStep("segments");
  };

  const addSegment = async () => {
    setSeconds(0);
    setPaused(false);
    setStep("recording");
    try { await startRecording(); } catch (e: any) {
      alertMsg("Mikrofon", e?.message ?? "Kayıt başlatılamadı");
      setStep("segments");
    }
  };

  const deleteSegment = (id: number) => setSegments((prev) => prev.filter((s) => s.id !== id));

  const transcribeAll = async () => {
    if (segments.length === 0) return;
    setStep("transcribing");
    try {
      const parts: string[] = [];
      for (const s of segments) parts.push(await transcribeAudio(s.rec));
      setTranscript(parts.filter((p) => p.trim()).join("\n\n"));
      setStep("transcript");
    } catch (e: any) {
      alertMsg("Transkript", e?.message ?? "Bir şeyler ters gitti");
      setStep("segments");
    }
  };

  // Prepend the chosen output language + the author's extra notes to every prompt.
  const buildPrompt = (base: string) => {
    const lang = `Write the output in ${outLang}.\n\n`;
    const note = notes.trim() ? `Additional context from the author (things they forgot to say or want to emphasize):\n${notes.trim()}\n\n` : "";
    return `${lang}${note}${base}`;
  };

  const handleGenerate = async () => {
    if (!transcript.trim()) return;
    setStep("generating");
    try {
      const text = await generate(
        buildPrompt(`Transform this transcript into a well-structured blog draft.\n\nTranscript:\n${transcript}`),
        "blog"
      );
      setDraft(text);
      setStep("draft");
    } catch (e: any) {
      alertMsg("Üretim", e?.message ?? "İçerik üretilemedi");
      setStep("transcript");
    }
  };

  const handleExcerpt = async (format: GenFormat) => {
    if (busyFormat) return;
    setBusyFormat(format);
    try {
      const label = format === "x" ? "an X (Twitter)" : format === "substack" ? "a Substack" : format === "medium" ? "a Medium" : "a LinkedIn";
      // Platform karakter sınırları — sonda kısa bir kaynak linki için 24 karakter yer bırak.
      const charLimit =
        format === "x" ? 280 - 24 :
        format === "linkedin" ? 1500 - 24 :
        format === "substack" ? 400 - 24 :
        format === "medium" ? 300 - 24 :
        800;
      // Çıktı dili taslakla aynı — outLang state'i buradaki dil (Turkish / English / vs.)
      const langInstruction = `Write the post in ${outLang}. Do not translate — match the exact language of the source draft.`;
      const linkReserveInstruction = `Keep the total length under ${charLimit} characters so the author can append a short source link.`;
      const text = await generate(
        buildPrompt(
          `Generate ${label} post — start with a strong hook, then a concise summary — from this draft.\n${langInstruction}\n${linkReserveInstruction}\n\nDraft:\n${draft}`
        ),
        format,
      );
      // Fonksiyonel updater + manuel session yazımı — React state güncellemesinin
      // ardından yeni referans üretildiğinden preview kartı hemen render edilir.
      // Önceden preview kartı ilk üretimde belirmiyordu; setImmediate benzeri
      // tick ile forced re-render de garanti veriyoruz.
      setExcerpts((p) => {
        const next = { ...p, [format]: text };
        saveStudioSession({ excerpts: next as Record<string, string> });
        return { ...next };
      });
    } catch (e: any) {
      alertMsg("Üretim", e?.message ?? "Oluşturulamadı");
    } finally {
      setBusyFormat(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const title = (draft.split("\n").find((l) => l.trim())?.slice(0, 80)) || transcript.slice(0, 80) || "Yeni içerik";
      // Platform çıktılarını da kaydet — X/LinkedIn/Substack/Medium kayboluyordu.
      await saveContent({ title, body: draft, excerpts: excerpts as Record<string, string> });
      await clearStudioSession();
      alertMsg("Kaydedildi", "Taslağın kaydedildi.");
      onExit();
    } catch (e: any) {
      alertMsg("Kaydetme", e?.message ?? "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  // ── COUNTDOWN ──
  if (step === "countdown") {
    return (
      <View style={styles.full}>
        <View style={styles.recTop}>
          <TouchableOpacity onPress={() => { cancelRecording(); onExit(); }}><Text style={styles.cancel}>İptal</Text></TouchableOpacity>
        </View>
        <View style={styles.countCenter}>
          {!pendingResume && <CountdownPulse value={count} accent={c.accent} />}
          {!pendingResume && <Text style={styles.countHint}>Hazır ol — konuşmaya başla</Text>}
        </View>

        <Modal visible={!!pendingResume} transparent animationType="fade" onRequestClose={() => {}}>
          <View style={styles.resumeOverlay}>
            <View style={styles.resumeCard}>
              <View style={styles.resumeIcon}><Text style={styles.resumeIconText}>↩️</Text></View>
              <Text style={styles.resumeTitle}>Kaldığın yerden devam?</Text>
              <Text style={styles.resumeBody}>
                Kaydedilmemiş bir çalışman var (son 24 saat içinde){pendingResume?.draft?.trim() ? " — taslak hazır" : pendingResume?.transcript?.trim() ? " — transkript hazır" : ""}.
              </Text>
              <TouchableOpacity
                style={styles.resumePrimary}
                activeOpacity={0.85}
                onPress={() => { const s = pendingResume; setPendingResume(null); if (s) restoreSession(s); }}
              >
                <Text style={styles.resumePrimaryText}>Devam et</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.resumeGhost}
                activeOpacity={0.85}
                onPress={async () => { await clearStudioSession(); setPendingResume(null); setResumeChecked(true); }}
              >
                <Text style={styles.resumeGhostText}>Yeni kayda başla</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ── RECORDING ──
  if (step === "recording") {
    return (
      <View style={styles.full}>
        <View style={styles.recTop}>
          <TouchableOpacity onPress={leaveRecording}><Text style={styles.cancel}>İptal</Text></TouchableOpacity>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Kayıt{segments.length > 0 ? ` · Seg ${segments.length + 1}` : ""}</Text>
          </View>
        </View>

        <View style={styles.recCenter}>
          <Equalizer />
          <Text style={styles.timer}>{fmt(seconds)}</Text>
          <Text style={styles.recHint}>{paused ? "⏸ Duraklatıldı" : "Doğal konuş — dil engeli yok"}</Text>
        </View>

        <View style={styles.recBtnRow}>
          <TouchableOpacity style={styles.durdurBtn} activeOpacity={0.85} onPress={endSegment}>
            <View style={styles.durdurSquare} />
            <Text style={styles.durdurText}>Durdur</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.duraklatBtn} activeOpacity={0.85} onPress={togglePause}>
            <Text style={styles.duraklatText}>{paused ? "Devam Et" : "Duraklat"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── SEGMENTS ──
  if (step === "segments") {
    return (
      <View style={styles.full}>
        <View style={styles.nav}>
          <TouchableOpacity onPress={leaveRecording}><Text style={styles.navBack}>‹</Text></TouchableOpacity>
          <Text style={styles.navTitle}>Kayıt Segmentleri</Text>
          <TouchableOpacity onPress={leaveRecording}><Text style={styles.navDone}>Stüdyo</Text></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.segSub}>Sil için × tıkla</Text>
          {segments.map((s, i) => (
            <View key={s.id} style={styles.segCard}>
              <View style={styles.segIcon}><MicSmallIcon color={c.accent} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.segNum}>Segment {i + 1}</Text>
                <Text style={styles.segDur}>{fmt(s.duration)}</Text>
              </View>
              <TouchableOpacity style={styles.segDel} onPress={() => deleteSegment(s.id)}>
                <Text style={styles.segDelText}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
          {segments.length === 0 && <Text style={styles.segEmpty}>Segment kalmadı — yeni bir segment ekle.</Text>}

          <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.85} onPress={addSegment}>
            <Text style={styles.secondaryBtnText}>+ Yeni Segment Ekle</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryBtn, segments.length === 0 && styles.disabled]}
            activeOpacity={0.85}
            disabled={segments.length === 0}
            onPress={transcribeAll}
          >
            <Text style={styles.primaryBtnText}>Transkript Al</Text>
          </TouchableOpacity>
          <Text style={styles.segHint}>Segmentler birleştirilerek transkript oluşturulur</Text>
          <View style={styles.privacyNote}>
            <Text style={styles.privacyText}>
              🔒 Ses kaydın yalnızca yazıya çevirmek için kullanılır; kişisel verilerin gizliliği ve güvenliği gereği saklanmaz, işlem sonrası silinir. Yalnızca transkript ve taslakların saklanır.
            </Text>
          </View>
          <TouchableOpacity onPress={leaveRecording}>
            <Text style={styles.cancelLink}>İptal et</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── LOADERS ──
  if (step === "transcribing" || step === "generating") {
    const isTrans = step === "transcribing";
    return (
      <View style={styles.loaderFull}>
        <Spinner accent={c.accent} />
        <Text style={styles.loaderH1}>{isTrans ? "Transkript oluşturuluyor…" : "Taslak üretiliyor…"}</Text>
        <Text style={styles.loaderSub}>
          {isTrans
            ? initialUpload ? "Ses dosyası işleniyor" : `${segments.length} segment işleniyor`
            : "Sesine göre yazılıyor"}
        </Text>
      </View>
    );
  }

  // ── TRANSCRIPT ──
  if (step === "transcript") {
    return (
      <View style={styles.full}>
        <View style={styles.nav}>
          <TouchableOpacity onPress={() => setStep("segments")}><Text style={styles.navBack}>‹</Text></TouchableOpacity>
          <Text style={styles.navTitle}>Transkript & Notlar</Text>
          <TouchableOpacity onPress={leaveSaved}><Text style={styles.navDone}>Stüdyo</Text></TouchableOpacity>
        </View>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.secLb}>TRANSKRİPT</Text>
          <TextInput style={styles.transcriptCard} value={transcript} onChangeText={setTranscript} multiline />

          <Text style={styles.secLb}>ÇIKTI DİLİ</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.langRow}>
            {OUTPUT_LANGUAGES.map((l) => {
              const on = outLang === l.value;
              return (
                <TouchableOpacity key={l.value} style={[styles.langChip, on && styles.langChipOn]} activeOpacity={0.8} onPress={() => setOutLang(l.value)}>
                  <Text style={[styles.langChipText, on && styles.langChipTextOn]}>{l.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.secLb}>EK NOTLAR (opsiyonel)</Text>
          <TextInput
            style={styles.notesCard}
            value={notes}
            onChangeText={setNotes}
            multiline
            textAlignVertical="top"
            placeholder="Ses kaydında atladığın ya da özellikle vurgulamak istediğin noktalar varsa buraya ekleyebilirsin…"
            placeholderTextColor={c.text4}
          />

          <TouchableOpacity
            style={[styles.primaryBtn, !transcript.trim() && styles.disabled]}
            activeOpacity={0.85}
            disabled={!transcript.trim()}
            onPress={handleGenerate}
          >
            <Text style={styles.primaryBtnText}>Taslak Üret</Text>
          </TouchableOpacity>
          <Text style={styles.saveHint}>💾 Transkript ve taslakların saklanır; ses kaydın saklanmaz, gizlilik için silinir.</Text>
        </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ── DRAFT ──
  return (
    <View style={styles.full}>
      <View style={styles.nav}>
        <TouchableOpacity onPress={() => setStep("transcript")}><Text style={styles.navBack}>‹</Text></TouchableOpacity>
        <Text style={styles.navTitle}>Taslak</Text>
        <TouchableOpacity onPress={leaveSaved}><Text style={styles.navDone}>Stüdyo</Text></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.secLb}>BLOG TASLAĞI</Text>
        <View style={styles.draftCard}><Markdown text={draft} /></View>

        <Text style={styles.secLb}>PLATFORM ÇIKTILARI (hook + özet)</Text>
        {busyFormat && (
          <View style={[styles.draftCard, { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 }]}>
            <ActivityIndicator size="small" color={c.accent} />
            <Text style={{ fontSize: 13, color: c.text2, flex: 1 }}>
              {platLabel(busyFormat)} için önizleme oluşturuluyor…
            </Text>
          </View>
        )}
        <View style={styles.platRow}>
          {(["linkedin", "x", "substack", "medium"] as const).map((f) => {
            const isShared = !!sharedPls[f];
            const isSharing = sharePl === f;
            return (
              <TouchableOpacity
                key={f}
                style={[
                  styles.platBtn,
                  busyFormat === f && styles.disabled,
                  isSharing && styles.platBtnSharing,
                  isShared && styles.platBtnShared,
                ]}
                activeOpacity={0.85}
                disabled={!!busyFormat || isSharing}
                onPress={() => {
                  if (excerpts[f]) doShare(f);
                  else handleExcerpt(f);
                }}
              >
                <Text style={[styles.platBtnText, isShared && { color: c.accent }]}>
                  {busyFormat === f
                    ? "..."
                    : isSharing
                      ? "Yükleniyor…"
                      : isShared
                        ? "✓ Paylaşıldı"
                        : excerpts[f]
                          ? `Paylaş — ${platLabel(f)}`
                          : platLabel(f)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {(["linkedin", "x", "substack", "medium"] as const).map((f) =>
          excerpts[f] ? (
            <View key={f} style={styles.draftCard}>
              <Text style={styles.draftLabel}>{platLabel(f)}</Text>
              <Markdown text={excerpts[f] ?? ""} />
            </View>
          ) : null
        )}

        <TouchableOpacity style={[styles.primaryBtn, saving && styles.disabled]} activeOpacity={0.85} disabled={saving} onPress={handleSave}>
          <Text style={styles.primaryBtnText}>{saving ? "Kaydediliyor…" : "Taslağı Kaydet"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

/* Center-mirrored real-time equalizer with a red → yellow → green gradient. */
const RED = [239, 68, 68], YEL = [245, 158, 11], GRN = [16, 185, 129];
const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);
function colorAt(t: number): string {
  // green (low) → yellow → red (high), standard VU/equalizer direction.
  if (t < 0.5) {
    const u = t * 2;
    return `rgb(${lerp(GRN[0], YEL[0], u)},${lerp(GRN[1], YEL[1], u)},${lerp(GRN[2], YEL[2], u)})`;
  }
  const u = (t - 0.5) * 2;
  return `rgb(${lerp(YEL[0], RED[0], u)},${lerp(YEL[1], RED[1], u)},${lerp(YEL[2], RED[2], u)})`;
}

function Equalizer() {
  const [bands, setBands] = useState<number[]>(() => Array(BAND_COUNT).fill(0.04));
  useEffect(() => subscribeSpectrum(setBands), []);
  return (
    <View style={eqStyles.wrap}>
      {bands.map((v, i) => {
        const color = colorAt(i / (BAND_COUNT - 1));
        return (
          <View
            key={i}
            style={{
              flex: 1,
              marginHorizontal: 0.5,
              borderRadius: 1,
              backgroundColor: color,
              height: 4 + v * 118,
              shadowColor: color,
              shadowOpacity: 0.6,
              shadowRadius: 3,
              shadowOffset: { width: 0, height: 0 },
            }}
          />
        );
      })}
    </View>
  );
}

function CountdownPulse({ value, accent }: { value: number; accent: string }) {
  const s = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    s.setValue(0.55);
    Animated.spring(s, { toValue: 1, friction: 4.5, tension: 90, useNativeDriver: true }).start();
  }, [value, s]);
  return (
    <Animated.View style={{ transform: [{ scale: s }], alignItems: "center" }}>
      <Text style={{ fontSize: 104, fontWeight: "800", color: accent, letterSpacing: -3 }}>{value}</Text>
    </Animated.View>
  );
}

function Spinner({ accent }: { accent: string }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const l = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 900, useNativeDriver: true }));
    l.start();
    return () => l.stop();
  }, []);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return (
    <Animated.View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: `${accent}33`, borderTopColor: accent, transform: [{ rotate }], marginBottom: 20 }} />
  );
}

const eqStyles = StyleSheet.create({
  // alignItems:center → bars grow up AND down from the midline (mirrored wave).
  wrap: { flexDirection: "row", alignItems: "center", height: 140, width: "88%", marginBottom: 24 },
});

function makeStyles(c: Palette) {
  return StyleSheet.create({
    full: { flex: 1, backgroundColor: c.page, paddingTop: 56 },
    loaderFull: { flex: 1, backgroundColor: c.page, alignItems: "center", justifyContent: "center", padding: 24 },

    recTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md },
    cancel: { fontSize: 15, color: c.text3 },
    liveBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: "rgba(239,68,68,0.12)" },
    liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#ef4444" },
    liveText: { fontSize: 12, fontWeight: "600", color: "#ef4444" },

    countCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
    countHint: { fontSize: 15, color: c.text3, marginTop: 12 },

    resumeOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 28 },
    resumeCard: { width: "100%", maxWidth: 360, borderRadius: radii.card, backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder, padding: 22, alignItems: "center" },
    resumeIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: c.mintBg, borderWidth: 1, borderColor: c.mintBorder, alignItems: "center", justifyContent: "center", marginBottom: 14 },
    resumeIconText: { fontSize: 24 },
    resumeTitle: { fontSize: 17, fontWeight: "700", color: c.text1, textAlign: "center", marginBottom: 8 },
    resumeBody: { fontSize: 13.5, color: c.text3, lineHeight: 20, textAlign: "center", marginBottom: 18 },
    resumePrimary: { alignSelf: "stretch", paddingVertical: 13, borderRadius: radii.btn, backgroundColor: c.accent, alignItems: "center" },
    resumePrimaryText: { fontSize: 15, fontWeight: "700", color: "#fff" },
    resumeGhost: { alignSelf: "stretch", paddingVertical: 12, borderRadius: radii.btn, alignItems: "center", marginTop: 8 },
    resumeGhostText: { fontSize: 14, fontWeight: "600", color: c.text3 },
    recCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
    timer: { fontSize: 44, fontWeight: "700", color: c.text1, letterSpacing: -1, fontVariant: ["tabular-nums"] },
    recHint: { fontSize: 13, color: c.text3, marginTop: 8 },

    recBtnRow: { flexDirection: "row", gap: 12, paddingHorizontal: spacing.md, paddingBottom: 48 },
    durdurBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, borderRadius: 14, backgroundColor: c.accent },
    durdurSquare: { width: 12, height: 12, borderRadius: 3, backgroundColor: "#fff" },
    durdurText: { fontSize: 15, fontWeight: "600", color: "#fff" },
    duraklatBtn: { paddingVertical: 16, paddingHorizontal: 24, borderRadius: 14, backgroundColor: c.glassFill, borderWidth: 1, borderColor: c.glassBorder, alignItems: "center", justifyContent: "center" },
    duraklatText: { fontSize: 15, fontWeight: "600", color: c.text2 },

    segHeader: { paddingHorizontal: spacing.md, paddingBottom: 12 },
    segTitle: { fontSize: 22, fontWeight: "700", letterSpacing: -0.6, color: c.text1 },
    segSub: { fontSize: 12, color: c.text4, marginTop: 4 },
    segCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 13, borderRadius: radii.card, backgroundColor: c.glassFill, borderWidth: 1, borderColor: c.glassBorder, marginBottom: 8 },
    segIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: c.mintBg, borderWidth: 1, borderColor: c.mintBorder, alignItems: "center", justifyContent: "center" },
    segNum: { fontSize: 14, fontWeight: "600", color: c.text1 },
    segDur: { fontSize: 12, color: c.text4, marginTop: 2 },
    segDel: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
    segDelText: { fontSize: 22, color: c.text3, lineHeight: 24 },
    segEmpty: { fontSize: 13, color: c.text4, textAlign: "center", paddingVertical: 24 },
    segHint: { fontSize: 12, color: c.text4, textAlign: "center", marginTop: 12 },
    privacyNote: { marginTop: 16, padding: 12, borderRadius: radii.card, backgroundColor: c.glassFill, borderWidth: 1, borderColor: c.glassBorder },
    privacyText: { fontSize: 11.5, color: c.text3, lineHeight: 17, textAlign: "center" },
    cancelLink: { fontSize: 14, color: c.text3, textAlign: "center", marginTop: 18 },

    loaderH1: { fontSize: 18, fontWeight: "700", color: c.text1, textAlign: "center" },
    loaderSub: { fontSize: 13, color: c.text3, marginTop: 6 },

    nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: c.glassBorder },
    navBack: { fontSize: 28, color: c.text2, lineHeight: 30 },
    navTitle: { fontSize: 15, fontWeight: "600", color: c.text1 },
    navDone: { fontSize: 15, fontWeight: "600", color: c.accent },

    scroll: { padding: spacing.md, paddingBottom: 60 },
    secLb: { fontSize: 10, letterSpacing: 0.8, color: c.text4, fontWeight: "600", marginBottom: 10, marginTop: 16 },
    transcriptCard: { padding: 16, borderRadius: radii.card, backgroundColor: c.glassFill, borderWidth: 1, borderColor: c.glassBorder, fontSize: 15, color: c.text1, lineHeight: 22, minHeight: 160, textAlignVertical: "top" },
    langRow: { flexDirection: "row", gap: 8, paddingVertical: 2 },
    langChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill, backgroundColor: c.glassFill, borderWidth: 1, borderColor: c.glassBorder },
    langChipOn: { backgroundColor: c.accent, borderColor: c.accent },
    langChipText: { fontSize: 13, fontWeight: "600", color: c.text3 },
    langChipTextOn: { color: "#fff" },
    notesCard: { padding: 14, borderRadius: radii.card, backgroundColor: c.glassFill, borderWidth: 1, borderColor: c.glassBorder, fontSize: 14, color: c.text1, lineHeight: 21, minHeight: 80, textAlignVertical: "top" },
    primaryBtn: { marginTop: 16, paddingVertical: 16, borderRadius: 14, backgroundColor: c.accent, alignItems: "center" },
    primaryBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
    secondaryBtn: { marginTop: 16, paddingVertical: 15, borderRadius: 14, backgroundColor: c.glassFill, borderWidth: 1, borderColor: c.glassBorder, alignItems: "center" },
    secondaryBtnText: { fontSize: 15, fontWeight: "600", color: c.accent },
    saveHint: { fontSize: 11, color: c.text4, textAlign: "center", marginTop: 12 },
    disabled: { opacity: 0.5 },

    draftCard: { padding: 16, borderRadius: radii.card, backgroundColor: c.glassFill, borderWidth: 1, borderColor: c.glassBorder, marginBottom: 10 },
    draftLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, color: c.accent, textTransform: "uppercase", marginBottom: 8 },
    draftText: { fontSize: 14, color: c.text1, lineHeight: 21 },
    platRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 6 },
    platBtn: {
      flexBasis: "48%",
      flexGrow: 1,
      paddingVertical: 12,
      borderRadius: radii.btn,
      backgroundColor: c.glassFill,
      borderWidth: 1,
      borderColor: c.glassBorder,
      alignItems: "center",
    },
    platBtnText: { fontSize: 13, fontWeight: "600", color: c.text2 },
    // shareGen pulse durumu
    platBtnSharing: {
      borderColor: c.accent,
      backgroundColor: c.accentGhost,
      shadowColor: c.accent,
      shadowOpacity: 0.35,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 0 },
    },
    platBtnShared: {
      borderColor: c.mintBorder,
      backgroundColor: c.mintBg,
    },
  });
}
