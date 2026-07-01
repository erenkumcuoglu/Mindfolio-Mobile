import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  ActivityIndicator,
  Modal,
  TextInput,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../theme/ThemeContext";
import { ThemeToggle } from "../components/ThemeToggle";
import { radii, spacing, type Palette } from "../theme/tokens";
import {
  MicHeroIcon,
  MicSmallIcon,
  TextLinesIcon,
  UploadIcon,
  LockIcon,
} from "../components/icons";
import { PaywallModal } from "../components/PaywallModal";
import { listContent, getPersona, saveContent, formatShortDate, isProUser, type ContentRow } from "../lib/data";
import { alertMsg } from "../lib/confirm";
import { pickAudioFile } from "../lib/upload";
import type { RecordingResult } from "../lib/recorder";
import { loadStudioSession, type StudioSession } from "../lib/studio-session";
import { Markdown } from "../components/Markdown";
import { useT } from "../lib/i18n";

interface Props {
  onStartRecording?: () => void;
  onUploadAudio?: (rec: RecordingResult) => void;
  onResumeDraft?: () => void;
}

export default function StudioScreen({ onStartRecording: onStartRecordingRaw, onUploadAudio, onResumeDraft }: Props) {
  const { c } = useTheme();
  const t = useT();
  const styles = makeStyles(c);
  const [paywall, setPaywall] = useState(false);
  const [recent, setRecent] = useState<ContentRow[] | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [pillars, setPillars] = useState<string[]>([]);
  const [writeOpen, setWriteOpen] = useState(false);
  const [viewing, setViewing] = useState<ContentRow | null>(null);
  const [pending, setPending] = useState<StudioSession | null>(null);
  // Ücretsiz kullanıcı için gerçek içerik sayısı — badge'te "N hak kaldı" göstermek için.
  const [totalContent, setTotalContent] = useState(0);
  const FREE_LIMIT = 3;
  const remainingFree = Math.max(0, FREE_LIMIT - totalContent);

  // Kayıt başlatmayı ücretsiz limite bağla
  const onStartRecording = useCallback(() => {
    if (!isPro && totalContent >= FREE_LIMIT) {
      alertMsg("Ücretsiz limit doldu", "3 içerik hakkını kullandın. Pro'ya geçerek limitsiz devam et.");
      setPaywall(true);
      return;
    }
    onStartRecordingRaw?.();
  }, [onStartRecordingRaw, isPro, totalContent]);

  const handleUpload = useCallback(async () => {
    // Free limit gate — 3 hak dolduysa direkt paywall
    if (!isPro && totalContent >= FREE_LIMIT) {
      alertMsg("Ücretsiz limit doldu", "3 içerik hakkını kullandın. Pro'ya geçerek limitsiz devam et.");
      setPaywall(true);
      return;
    }
    const r = await pickAudioFile();
    if (r.ok) { onUploadAudio?.(r.rec); return; }
    if (r.reason === "too_large") alertMsg("Dosya çok büyük", "En fazla 20MB ses dosyası yükleyebilirsin.");
    else if (r.reason === "error") alertMsg("Yükleme", r.message ?? "Dosya seçilemedi.");
  }, [onUploadAudio, isPro, totalContent]);

  const loadRecent = useCallback(() => {
    listContent()
      .then((r) => { setTotalContent(r.length); setRecent(r.slice(0, 3)); })
      .catch(() => setRecent([]));
    loadStudioSession().then((s) => setPending(s && (s.transcript.trim() || s.draft.trim()) ? s : null)).catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    loadRecent();
    isProUser().then((v) => alive && setIsPro(v));
    getPersona()
      .then((p) => alive && setPillars((p?.profile?.pillars ?? []).map((x) => x.title).filter(Boolean)))
      .catch(() => {});
    return () => { alive = false; };
  }, [loadRecent]);

  const pendingTitle = pending
    ? ((pending.draft || pending.transcript || "").trim().split("\n").map((s) => s.trim()).find(Boolean) || "Adsız çalışma")
        .replace(/^#+\s*/, "").replace(/^Başlık\s*\d+\s*:\s*/i, "").slice(0, 60)
    : "";
  const pendingStage = pending
    ? (pending.draft.trim() ? "Taslak hazır" : pending.transcript.trim() ? "Transcript halinde" : "Ses kaydı")
    : "";

  return (
    <>
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.pgHdr}>
        <View style={{ flex: 1 }}>
          <Text style={styles.pgTitle}>{t.studioTitle}</Text>
          <Text style={styles.pgDesc}>{t.studioDesc}</Text>
        </View>
        <View style={styles.hdrRight}>
          <ThemeToggle />
        </View>
      </View>

      <View style={styles.micHero}>
        <Ripples accent={c.accent} />
        <TouchableOpacity style={styles.micShadow} activeOpacity={0.85} onPress={onStartRecording}>
          <LinearGradient
            colors={[c.accent, c.accentDeep]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.micBtn}
          >
            <MicHeroIcon size={24} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
        <Text style={styles.micLb}>Kayıt Başlat</Text>
        <Text style={styles.micSub}>Konuş, biz yazıya çevirelim</Text>
      </View>

      <View style={styles.qaRow}>
        <TouchableOpacity style={styles.qaBtn} activeOpacity={0.7} onPress={() => setWriteOpen(true)}>
          <TextLinesIcon color={c.accent} />
          <Text style={styles.qaText}>Metin Yaz</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.qaBtn} activeOpacity={0.7} onPress={handleUpload}>
          <UploadIcon color={c.accent} />
          <Text style={styles.qaText}>Ses Dosyası Yükle</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.secRow}>
        <Text style={styles.secLb}>SON KAYITLAR</Text>
      </View>

      {pending && (
        <TouchableOpacity style={styles.pendingCard} activeOpacity={0.85} onPress={onResumeDraft}>
          <View style={styles.pendingIcon}><MicSmallIcon color={c.accent} /></View>
          <View style={styles.rcInfo}>
            <Text style={styles.rcTitle} numberOfLines={1}>{pendingTitle}</Text>
            <View style={styles.rcMetaRow}>
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>{pendingStage}</Text>
              </View>
              <Text style={styles.rcMeta}>Kaldığın yerden devam et →</Text>
            </View>
          </View>
        </TouchableOpacity>
      )}

      {recent === null ? (
        <View style={styles.rcLoading}><ActivityIndicator color={c.accent} /></View>
      ) : recent.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}><MicSmallIcon color={c.accent} /></View>
          <Text style={styles.emptyTitle}>İlk içeriğin bir tık uzakta.</Text>
          <Text style={styles.emptyDesc}>
            Mikrofona basıp doğal konuş — Mindfolio sesini içeriğe dönüştürür. Hazır olduğunda LinkedIn, X, Substack ve Medium çıktısı tek dokunuşta.
          </Text>
          <TouchableOpacity style={styles.emptyCta} activeOpacity={0.85} onPress={onStartRecording}>
            <Text style={styles.emptyCtaText}>Kayda Başla →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.rcList}>
          {recent.map((r) => {
            const hasDraft = !!r.body;
            return (
              <TouchableOpacity key={r.id} style={styles.rcCard} activeOpacity={0.85} onPress={() => setViewing(r)}>
                <View style={[styles.rcIcon, hasDraft ? styles.rcIconMint : styles.rcIconDim]}>
                  {r.source === "text"
                    ? <TextLinesIcon color={hasDraft ? c.accent : c.text4} />
                    : <MicSmallIcon color={hasDraft ? c.accent : c.text4} />}
                </View>
                <View style={styles.rcInfo}>
                  <Text style={styles.rcTitle} numberOfLines={1}>{r.title}</Text>
                  <View style={styles.rcMetaRow}>
                    {hasDraft && <View style={styles.rcBadge}><Text style={styles.rcBadgeText}>Taslak hazır</Text></View>}
                    {r.category ? <View style={styles.rcPillar}><Text style={styles.rcPillarText} numberOfLines={1}>{r.category}</Text></View> : null}
                    <Text style={styles.rcMeta}>{formatShortDate(r.created_at)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {!isPro && (
        <TouchableOpacity style={styles.freeBadge} activeOpacity={0.8} onPress={() => setPaywall(true)}>
          <LockIcon color={c.amber} />
          <Text style={styles.freeBadgeText}>
            Ücretsiz · 30sn limit · {remainingFree > 0 ? `${remainingFree} hak kaldı` : "Limit doldu"}
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
    <PaywallModal visible={paywall} onClose={() => setPaywall(false)} />
    <WriteDraftModal
      visible={writeOpen}
      pillars={pillars}
      onClose={() => setWriteOpen(false)}
      onSaved={() => { setWriteOpen(false); loadRecent(); }}
    />
    <RecentViewer item={viewing} onClose={() => setViewing(null)} />
    </>
  );
}

/** Read-only content viewer opened from "Son Kayıtlar" — stays inside Studio. */
function RecentViewer({ item, onClose }: { item: ContentRow | null; onClose: () => void }) {
  const { c } = useTheme();
  const styles = makeStyles(c);
  if (!item) return null;
  const hasDraft = !!item.body;
  return (
    <Modal visible={!!item} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.mdOverlay}>
        <View style={styles.mdSheet}>
          <View style={styles.mdHandle} />
          <View style={styles.mdHdr}>
            <Text style={styles.mdTitle} numberOfLines={2}>{item.title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.mdClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.rvMetaRow}>
            {hasDraft && <View style={styles.rcBadge}><Text style={styles.rcBadgeText}>Taslak hazır</Text></View>}
            {item.category ? <View style={styles.rcPillar}><Text style={styles.rcPillarText}>{item.category}</Text></View> : null}
            <Text style={styles.rcMeta}>{formatShortDate(item.created_at)}</Text>
          </View>
          <ScrollView style={styles.rvBodyWrap} showsVerticalScrollIndicator={false}>
            {item.body ? <Markdown text={item.body} /> : <Text style={styles.rvBody}>Bu kayıt için henüz taslak metni yok.</Text>}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** Manual draft-writing modal ("Metin Yaz") — saves a draft to Content. */
function WriteDraftModal({
  visible,
  pillars,
  onClose,
  onSaved,
}: {
  visible: boolean;
  pillars: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { c } = useTheme();
  const styles = makeStyles(c);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pillar, setPillar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) { setTitle(""); setBody(""); setPillar(null); setSaving(false); }
  }, [visible]);

  const save = async () => {
    if (!title.trim() && !body.trim()) return;
    setSaving(true);
    try {
      await saveContent({
        title: title.trim() || body.trim().slice(0, 60),
        body: body.trim() || undefined,
        category: pillar ?? undefined,
        source: "text",
      });
      onSaved();
    } catch (e: any) {
      alertMsg("Kaydedilemedi", e?.message ?? "Bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.mdOverlay}>
        <View style={styles.mdSheet}>
          <View style={styles.mdHandle} />
          <View style={styles.mdHdr}>
            <Text style={styles.mdTitle}>Metin Yaz</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.mdClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.mdLb}>BAŞLIK</Text>
            <TextInput
              style={styles.mdInput}
              placeholder="İçeriğin başlığı"
              placeholderTextColor={c.text4}
              value={title}
              onChangeText={setTitle}
            />
            {pillars.length > 0 && (
              <>
                <Text style={styles.mdLb}>İÇERİK SÜTUNU</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mdPillRow}>
                  {pillars.map((p) => {
                    const on = pillar === p;
                    return (
                      <TouchableOpacity
                        key={p}
                        style={[styles.mdPill, on && styles.mdPillOn]}
                        activeOpacity={0.8}
                        onPress={() => setPillar(on ? null : p)}
                      >
                        <Text style={[styles.mdPillText, on && styles.mdPillTextOn]} numberOfLines={1}>{p}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}
            <Text style={styles.mdLb}>NOTLAR / TASLAK</Text>
            <TextInput
              style={[styles.mdInput, styles.mdArea]}
              placeholder="Aklındaki fikri buraya yaz…"
              placeholderTextColor={c.text4}
              value={body}
              onChangeText={setBody}
              multiline
              textAlignVertical="top"
            />
          </ScrollView>
          <TouchableOpacity
            style={[styles.mdSave, (saving || (!title.trim() && !body.trim())) && styles.mdSaveOff]}
            activeOpacity={0.85}
            onPress={save}
            disabled={saving || (!title.trim() && !body.trim())}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.mdSaveText}>Kaydet</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/** Continuous water-drop ripple rings behind the mic — three staggered loops. */
function Ripples({ accent }: { accent: string }) {
  const a1 = useRef(new Animated.Value(0)).current;
  const a2 = useRef(new Animated.Value(0)).current;
  const a3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const DUR = 2600;
    const loop = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: 1,
            duration: DUR,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
    // Even spacing across the cycle so a ring is always expanding outward.
    const ls = [loop(a1, 0), loop(a2, DUR / 3), loop(a3, (2 * DUR) / 3)];
    ls.forEach((l) => l.start());
    return () => ls.forEach((l) => l.stop());
  }, [a1, a2, a3]);

  const ring = (val: Animated.Value, size: number) => ({
    position: "absolute" as const,
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: accent,
    opacity: val.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0] }),
    transform: [{ scale: val.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1.9] }) }],
  });

  return (
    <>
      <Animated.View pointerEvents="none" style={ring(a1, 120)} />
      <Animated.View pointerEvents="none" style={ring(a2, 120)} />
      <Animated.View pointerEvents="none" style={ring(a3, 120)} />
    </>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.page },
    scrollContent: { paddingHorizontal: spacing.md, paddingTop: 56, paddingBottom: 130 },

    pgHdr: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: 20,
    },
    hdrRight: { flexDirection: "row", alignItems: "center", gap: 10 },
    pgTitle: { fontSize: 28, fontWeight: "700", letterSpacing: -1, color: c.text1 },
    pgDesc: { fontSize: 13, color: c.text3, marginTop: 2 },
    // (Streak / gamification removed per design brief — gamification YOK.)

    micHero: { alignItems: "center", marginTop: 24, marginBottom: 20 },
    micShadow: {
      shadowColor: c.accent,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.55,
      shadowRadius: 26,
      elevation: 10,
      borderRadius: 46,
    },
    micBtn: { width: 92, height: 92, borderRadius: 46, alignItems: "center", justifyContent: "center" },
    micLb: { fontSize: 15, fontWeight: "600", color: c.text1, letterSpacing: -0.3, marginTop: 12 },
    micSub: { fontSize: 12, color: c.text3, marginTop: 2 },

    qaRow: { flexDirection: "row", gap: 10, marginBottom: 22 },
    qaBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 16,
      borderRadius: radii.card,
      backgroundColor: c.glassFill,
      borderWidth: 1,
      borderColor: c.glassBorder,
    },
    qaText: { fontSize: 13.5, fontWeight: "600", color: c.text1 },

    secRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
    secLb: { fontSize: 10, letterSpacing: 0.8, color: c.text4, fontWeight: "600" },
    secHint: { fontSize: 10, color: c.text4, fontStyle: "italic" },

    rcLoading: { paddingVertical: 24, alignItems: "center", marginBottom: 14 },
    rcEmpty: { fontSize: 13, color: c.text4, marginBottom: 14 },

    // Empty state — ilk kullanım
    emptyCard: {
      padding: 22,
      borderRadius: radii.card,
      backgroundColor: c.glassFill,
      borderWidth: 1,
      borderColor: c.glassBorder,
      alignItems: "center",
      marginBottom: 16,
    },
    emptyIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: c.accentGhost,
      borderWidth: 1,
      borderColor: c.mintBorder,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 14,
    },
    emptyTitle: { fontSize: 17, fontWeight: "700", color: c.text1, marginBottom: 6, textAlign: "center" },
    emptyDesc: { fontSize: 13, color: c.text2, lineHeight: 19, textAlign: "center", marginBottom: 16 },
    emptyCta: {
      paddingHorizontal: 22,
      paddingVertical: 11,
      borderRadius: radii.btn,
      backgroundColor: c.accent,
    },
    emptyCtaText: { fontSize: 14, fontWeight: "700", color: "#fff" },
    pendingCard: {
      flexDirection: "row", alignItems: "center", gap: 10,
      paddingVertical: 11, paddingHorizontal: 13, borderRadius: 13, marginBottom: 8,
      backgroundColor: c.mintBg, borderWidth: 1, borderColor: c.mintBorder,
    },
    pendingIcon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: c.glassFill, borderWidth: 1, borderColor: c.mintBorder },
    pendingBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: c.accent },
    pendingBadgeText: { fontSize: 9, fontWeight: "700", color: "#fff" },
    rcList: { gap: 8, marginBottom: 14 },
    rcCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 11,
      paddingHorizontal: 13,
      borderRadius: 13,
      backgroundColor: c.glassFill,
      borderWidth: 1,
      borderColor: c.glassBorder,
    },
    rcIcon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    rcIconMint: { backgroundColor: c.mintBg, borderWidth: 1, borderColor: c.mintBorder },
    rcIconDim: { backgroundColor: c.glassFill, borderWidth: 1, borderColor: c.glassBorder },
    rcInfo: { flex: 1, minWidth: 0 },
    rcTitle: { fontSize: 12, fontWeight: "500", color: c.text1 },
    rcMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" },
    rcMeta: { fontSize: 10, color: c.text4 },
    rcBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: c.mintBg, borderWidth: 1, borderColor: c.mintBorder },
    rcBadgeText: { fontSize: 9, fontWeight: "600", color: c.accent },
    rcPillar: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: c.glassFill, borderWidth: 1, borderColor: c.glassBorder, maxWidth: 120 },
    rcPillarText: { fontSize: 9, fontWeight: "500", color: c.text3 },
    rcDraftBtn: {
      paddingHorizontal: 11,
      paddingVertical: 5,
      borderRadius: 8,
      backgroundColor: c.accent,
      shadowColor: c.accent,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
    },
    rcDraftText: { fontSize: 11, fontWeight: "600", color: "#fff" },

    freeBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 10,
      backgroundColor: c.amberGhost,
      borderWidth: 1,
      borderColor: c.amberBorder,
      alignSelf: "flex-start",
    },
    freeBadgeText: { fontSize: 11, color: c.amber, fontWeight: "500" },

    mdOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    mdSheet: {
      backgroundColor: c.page,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      paddingHorizontal: spacing.md,
      paddingTop: 10,
      paddingBottom: 28,
      maxHeight: "88%",
    },
    mdHandle: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: c.glassBorder, marginBottom: 12 },
    mdHdr: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
    mdTitle: { fontSize: 20, fontWeight: "700", letterSpacing: -0.5, color: c.text1 },
    mdClose: { fontSize: 18, color: c.text3, fontWeight: "600" },
    mdLb: { fontSize: 10, letterSpacing: 0.8, color: c.text4, fontWeight: "600", marginTop: 14, marginBottom: 7 },
    mdInput: {
      borderWidth: 1,
      borderColor: c.glassBorder,
      backgroundColor: c.glassFill,
      borderRadius: 12,
      paddingHorizontal: 13,
      paddingVertical: 12,
      fontSize: 15,
      color: c.text1,
    },
    mdArea: { minHeight: 150 },
    mdPillRow: { gap: 7, paddingVertical: 2 },
    mdPill: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: radii.pill, backgroundColor: c.glassFill, borderWidth: 1, borderColor: c.glassBorder },
    mdPillOn: { backgroundColor: c.mintBg, borderColor: c.accent },
    mdPillText: { fontSize: 12, fontWeight: "500", color: c.text3, maxWidth: 160 },
    mdPillTextOn: { color: c.accent, fontWeight: "600" },
    mdSave: {
      marginTop: 18,
      borderRadius: radii.btn,
      paddingVertical: 15,
      alignItems: "center",
      backgroundColor: c.accent,
      shadowColor: c.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 14,
    },
    mdSaveOff: { opacity: 0.45 },
    mdSaveText: { fontSize: 15, fontWeight: "700", color: "#fff", letterSpacing: -0.2 },

    rvMetaRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 14 },
    rvBodyWrap: { maxHeight: 380 },
    rvBody: { fontSize: 15, color: c.text1, lineHeight: 23 },
  });
}
