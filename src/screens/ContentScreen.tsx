import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  TouchableWithoutFeedback,
  Animated,
  PanResponder,
  Dimensions,
  StyleSheet,
} from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { radii, spacing, type Palette } from "../theme/tokens";
import { EmptyState } from "../components/EmptyState";
import { DocIcon } from "../components/icons";
import {
  listContent,
  saveContent,
  updateContent,
  deleteContent,
  setContentStatus,
  setContentExcerpts,
  getPersona,
  formatShortDate,
  type ContentRow,
  type ContentStatus,
} from "../lib/data";
import { confirmAsync, alertMsg } from "../lib/confirm";
import { copyText } from "../lib/clipboard";
import { generate, type GenFormat } from "../lib/ai";
import { loadExcerpts, saveExcerpts, type Excerpts } from "../lib/excerpts";
import { useT } from "../lib/i18n";

const LANG_PREFIX = "Write the output in Turkish.\n\n";
const PLATFORMS: { key: GenFormat; label: string; promptName: string }[] = [
  { key: "linkedin", label: "LinkedIn", promptName: "a LinkedIn" },
  { key: "x", label: "X (Twitter)", promptName: "an X (Twitter)" },
  { key: "substack", label: "Substack / Medium", promptName: "a Substack/Medium" },
];

const tagColors = (k: string, c: Palette) => {
  const s = (k ?? "").toLowerCase();
  if (s.includes("linkedin")) return { bg: "rgba(56,189,248,0.12)", fg: "#0284c7" };
  if (s === "x" || s.includes("twitter")) return { bg: c.glassFillStrong, fg: c.text2 };
  return { bg: c.mintBg, fg: c.accent };
};

export default function ContentScreen() {
  const { c } = useTheme();
  const t = useT();
  const styles = makeStyles(c);
  const [rows, setRows] = useState<ContentRow[] | null>(null);
  const [error, setError] = useState(false);
  const [pillars, setPillars] = useState<string[]>([]);
  const [chip, setChip] = useState("Tümü");
  const [statusFilter, setStatusFilter] = useState<ContentStatus | "all">("all");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ContentRow | null>(null);

  const load = () => {
    setRows(null);
    listContent().then(setRows).catch(() => setError(true));
  };
  useEffect(() => {
    load();
    getPersona().then((p) => setPillars((p?.profile?.pillars ?? []).map((x) => x.title).filter(Boolean)));
  }, []);

  const chips = ["Tümü", ...pillars];
  const statusOf = (r: ContentRow): ContentStatus => (r.status as ContentStatus) ?? "draft";
  const statusFilters: { key: ContentStatus | "all"; label: string }[] = [
    { key: "all", label: "Tümü" },
    { key: "draft", label: "Taslak" },
    { key: "published", label: "Yayında" },
    { key: "archived", label: "Arşiv" },
  ];
  const items = (rows ?? []).filter(
    (r) => (chip === "Tümü" || r.category === chip) && (statusFilter === "all" || statusOf(r) === statusFilter),
  );

  const changeStatus = async (it: ContentRow, status: ContentStatus) => {
    try { await setContentStatus(it.id, status); load(); } catch { alertMsg("Durum", "Durum güncellenemedi."); }
  };
  const copyBody = async (it: ContentRow) => {
    if (!it.body) return;
    const ok = await copyText(it.body);
    alertMsg(ok ? "Kopyalandı" : "Kopyalanamadı", ok ? "İçerik panoya kopyalandı." : "Panoya erişilemedi.");
  };
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.pgHdr}>
          <Text style={styles.pgTitle}>{t.contentTitle}</Text>
          <Text style={styles.pgDesc}>{t.contentDesc}</Text>
        </View>

        {rows === null && !error && <View style={styles.loading}><ActivityIndicator color={c.accent} /></View>}
        {error && <Text style={styles.error}>İçerikler yüklenemedi.</Text>}

        {rows !== null && rows.length === 0 && (
          <EmptyState
            icon={<DocIcon color={c.accent} />}
            title="Henüz içerik yok"
            motiv="Yeni içerik ekle ya da Stüdyo'dan kayıt yap."
            ctaLabel="İçerik Ekle →"
            onCta={() => setAdding(true)}
          />
        )}

        {rows !== null && rows.length > 0 && (
          <>
            {/* Status segmented control */}
            <View style={styles.segment}>
              {statusFilters.map((s) => (
                <TouchableOpacity
                  key={s.key}
                  style={[styles.segItem, statusFilter === s.key && styles.segItemActive]}
                  activeOpacity={0.8}
                  onPress={() => setStatusFilter(s.key)}
                >
                  <Text style={[styles.segText, statusFilter === s.key && styles.segTextActive]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {chips.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {chips.map((ch) => (
                  <TouchableOpacity key={ch} style={[styles.chip, chip === ch && styles.chipActive]} activeOpacity={0.8} onPress={() => setChip(ch)}>
                    <Text style={[styles.chipText, chip === ch && styles.chipTextActive]}>{ch}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <View style={styles.list}>
              {items.map((it) => {
                const tag = tagColors(it.category ?? "", c);
                const st = statusOf(it);
                return (
                  <SwipeRow
                    key={it.id}
                    c={c}
                    styles={styles}
                    archived={st === "archived"}
                    onPublish={async () => { await changeStatus(it, "published"); return true; }}
                    onArchive={async () => { await changeStatus(it, st === "archived" ? "draft" : "archived"); return true; }}
                  >
                    <TouchableOpacity style={[styles.card, st === "archived" && styles.cardArchived]} activeOpacity={0.85} onPress={() => setEditing(it)}>
                      <View style={styles.cardTop}>
                        {it.category ? (
                          <View style={[styles.tag, { backgroundColor: tag.bg }]}><Text style={[styles.tagText, { color: tag.fg }]}>{it.category}</Text></View>
                        ) : <View />}
                        <View style={styles.cardTopRight}>
                          <View style={[styles.stPill, st === "published" ? styles.stPub : st === "archived" ? styles.stArch : styles.stDraft]}>
                            <Text style={[styles.stPillText, st === "published" ? styles.stPubText : st === "archived" ? styles.stArchText : styles.stDraftText]}>
                              {st === "published" ? "Yayında" : st === "archived" ? "Arşiv" : "Taslak"}
                            </Text>
                          </View>
                          <Text style={styles.cardDate}>{formatShortDate(it.created_at)}</Text>
                        </View>
                      </View>
                      <Text style={styles.cardTitle}>{it.title}</Text>
                      {it.body ? <Text style={styles.cardPreview} numberOfLines={2}>{it.body}</Text> : <Text style={styles.statusDim}>Taslak yok</Text>}

                      {it.body ? (
                        <TouchableOpacity style={styles.copyBtn} activeOpacity={0.8} onPress={() => copyBody(it)}>
                          <Text style={styles.copyBtnText}>⧉  Kopyala</Text>
                        </TouchableOpacity>
                      ) : null}
                    </TouchableOpacity>
                  </SwipeRow>
                );
              })}
              {items.length === 0 && <Text style={styles.noFilter}>"{chip}" pillar'ında içerik yok.</Text>}
            </View>
          </>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={() => setAdding(true)}>
        <Text style={styles.fabPlus}>＋</Text>
      </TouchableOpacity>

      <ContentEditor
        mode="add"
        visible={adding}
        pillars={pillars}
        onClose={() => setAdding(false)}
        onSaved={() => { setAdding(false); load(); }}
      />
      <ContentEditor
        mode="edit"
        visible={!!editing}
        item={editing}
        pillars={pillars}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load(); }}
      />
    </View>
  );
}

const SCREEN_W = Dimensions.get("window").width;

/** Gmail-style swipeable row: swipe right → publish, swipe left → archive. */
function SwipeRow({
  children,
  onPublish,
  onArchive,
  archived,
  c,
  styles,
}: {
  children: React.ReactNode;
  onPublish: () => Promise<boolean>;
  onArchive: () => Promise<boolean>;
  archived: boolean;
  c: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  const tx = useRef(new Animated.Value(0)).current;
  const THRESHOLD = SCREEN_W * 0.32;

  const springBack = () => Animated.spring(tx, { toValue: 0, useNativeDriver: true, friction: 7 }).start();

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_e, g) => tx.setValue(g.dx),
      onPanResponderRelease: (_e, g) => {
        if (g.dx > THRESHOLD) {
          // swipe right → publish (fly off, then mark published + refresh)
          Animated.timing(tx, { toValue: SCREEN_W, duration: 180, useNativeDriver: true }).start(async () => {
            const ok = await onPublish();
            if (!ok) tx.setValue(0);
          });
        } else if (g.dx < -THRESHOLD) {
          // swipe left → archive / unarchive (fly off then refresh)
          Animated.timing(tx, { toValue: -SCREEN_W, duration: 180, useNativeDriver: true }).start(async () => {
            const ok = await onArchive();
            if (!ok) tx.setValue(0);
          });
        } else {
          springBack();
        }
      },
    }),
  ).current;

  const pubOpacity = tx.interpolate({ inputRange: [0, 50], outputRange: [0, 1], extrapolate: "clamp" });
  const arcOpacity = tx.interpolate({ inputRange: [-50, 0], outputRange: [1, 0], extrapolate: "clamp" });

  return (
    <View style={styles.swipeWrap}>
      <Animated.View style={[styles.swipeBg, styles.swipePublish, { opacity: pubOpacity }]}>
        <Text style={styles.swipeActText}>✓  Yayınlandı</Text>
      </Animated.View>
      <Animated.View style={[styles.swipeBg, styles.swipeArchive, { opacity: arcOpacity }]}>
        <Text style={styles.swipeActText}>{archived ? "Geri al  ↩" : "Arşivle  📥"}</Text>
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX: tx }] }} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

function ContentEditor({ mode, visible, item, pillars, onClose, onSaved }: {
  mode: "add" | "edit";
  visible: boolean;
  item?: ContentRow | null;
  pillars: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { c } = useTheme();
  const styles = makeStyles(c);
  const [title, setTitle] = useState("");
  const [pillar, setPillar] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [scheduled, setScheduled] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [excerpts, setExcerpts] = useState<Excerpts>({});
  const [busyFmt, setBusyFmt] = useState<GenFormat | null>(null);

  // Swipe down on the handle to dismiss.
  const closePan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderRelease: (_e, g) => { if (g.dy > 60) onClose(); },
    }),
  ).current;

  useEffect(() => {
    if (visible) {
      setTitle(item?.title ?? "");
      setPillar(item?.category ?? null);
      setBody(item?.body ?? "");
      setScheduled(item?.scheduled_at ?? null);
      setBusyFmt(null);
      // Prefer the DB-synced excerpts on the row; fall back to local cache.
      if (item?.excerpts && Object.keys(item.excerpts).length) setExcerpts(item.excerpts);
      else if (item?.id) loadExcerpts(item.id).then(setExcerpts);
      else setExcerpts({});
    }
  }, [visible, item]);

  // Save excerpts to the DB (cross-device) + local cache (offline/fallback).
  const persistExcerpts = (next: Excerpts) => {
    if (!item?.id) return;
    saveExcerpts(item.id, next);
    setContentExcerpts(item.id, next as Record<string, string>).catch(() => {});
  };

  const genPlatform = async (fmt: GenFormat, promptName: string) => {
    if (!body.trim() || busyFmt) return;
    setBusyFmt(fmt);
    try {
      const text = await generate(`${LANG_PREFIX}Generate ${promptName} post — start with a strong hook, then a concise summary — from this content:\n\n${body}`, fmt);
      const next = { ...excerpts, [fmt]: text };
      setExcerpts(next);
      persistExcerpts(next);
    } catch (e: any) {
      alertMsg("Üretim", e?.message ?? "Oluşturulamadı");
    } finally {
      setBusyFmt(null);
    }
  };

  const editExcerpt = (fmt: GenFormat, val: string) => {
    const next = { ...excerpts, [fmt]: val };
    setExcerpts(next);
    persistExcerpts(next);
  };

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (mode === "edit" && item) {
        await updateContent(item.id, { title: title.trim(), category: pillar, body: body || null, scheduled_at: scheduled });
      } else {
        await saveContent({ title: title.trim(), body, category: pillar ?? undefined, scheduled_at: scheduled });
      }
      onSaved();
    } catch (e: any) {
      alertMsg("Kaydetme", e?.message ?? "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!item) return;
    const ok = await confirmAsync("İçeriği sil?", item.title, { confirmLabel: "Sil" });
    if (!ok) return;
    try { await deleteContent(item.id); onSaved(); } catch { alertMsg("Silme", "İçerik silinemedi."); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.sheet}>
              <View style={styles.sheetHandleRow} {...closePan.panHandlers}>
                <View style={styles.sheetHandle} />
              </View>
              <View style={styles.sheetHdr}>
                <Text style={styles.sheetKicker}>{mode === "add" ? "Yeni İçerik" : "İçerik"}</Text>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={styles.sheetClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={styles.sheetScroll}>
                <Text style={styles.fieldLb}>Başlık</Text>
                <TextInput style={styles.input} placeholder="İçerik başlığı" placeholderTextColor={c.text4} value={title} onChangeText={setTitle} />

                <Text style={styles.fieldLb}>Pillar</Text>
                {pillars.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillarRow}>
                    {pillars.map((p) => {
                      const on = pillar === p;
                      return (
                        <TouchableOpacity key={p} style={[styles.pillarChip, on && styles.pillarChipOn]} onPress={() => setPillar(on ? null : p)}>
                          <Text style={[styles.pillarChipText, on && styles.pillarChipTextOn]} numberOfLines={1}>{p}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                ) : (
                  <Text style={styles.hint}>Pillar'ların onboarding'de oluşur.</Text>
                )}

                <Text style={styles.fieldLb}>İçerik</Text>
                <TextInput style={[styles.input, styles.bodyInput]} placeholder="Taslak metni…" placeholderTextColor={c.text4} value={body} onChangeText={setBody} multiline textAlignVertical="top" />

                {mode === "edit" && body.trim().length > 0 && (
                  <>
                    <Text style={styles.fieldLb}>PLATFORM PAYLAŞIMLARI</Text>
                    <View style={styles.platBtnRow}>
                      {PLATFORMS.map((p) => (
                        <TouchableOpacity
                          key={p.key}
                          style={[styles.platBtn, busyFmt === p.key && { opacity: 0.5 }]}
                          activeOpacity={0.8}
                          disabled={!!busyFmt}
                          onPress={() => genPlatform(p.key, p.promptName)}
                        >
                          <Text style={styles.platBtnText}>{busyFmt === p.key ? "…" : excerpts[p.key] ? `${p.label} ↻` : p.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {PLATFORMS.map((p) =>
                      excerpts[p.key] ? (
                        <View key={p.key} style={styles.platCard}>
                          <Text style={styles.platLabel}>{p.label}</Text>
                          <TextInput
                            style={styles.platInput}
                            value={excerpts[p.key]}
                            onChangeText={(v) => editExcerpt(p.key, v)}
                            multiline
                            textAlignVertical="top"
                          />
                        </View>
                      ) : null,
                    )}
                  </>
                )}
              </ScrollView>

              <View style={styles.sheetActions}>
                {mode === "edit" ? (
                  <TouchableOpacity style={styles.delBtn} onPress={remove}><Text style={styles.delText}>Sil</Text></TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.cancelBtn} onPress={onClose}><Text style={styles.cancelText}>Vazgeç</Text></TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.5 }]} onPress={save} disabled={saving}>
                  <Text style={styles.saveText}>{saving ? "Kaydediliyor…" : "Kaydet"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.page },
    content: { paddingHorizontal: spacing.md, paddingTop: 56, paddingBottom: 130 },

    pgHdr: { marginBottom: 16 },
    pgTitle: { fontSize: 28, fontWeight: "700", letterSpacing: -1, color: c.text1 },
    pgDesc: { fontSize: 13, color: c.text3, marginTop: 2 },

    loading: { paddingVertical: 60, alignItems: "center" },
    error: { paddingVertical: 40, textAlign: "center", color: c.error, fontSize: 14 },
    noFilter: { textAlign: "center", color: c.text4, fontSize: 13, paddingVertical: 24 },

    chipRow: { flexDirection: "row", gap: 8, paddingVertical: 2, marginBottom: 14 },
    chip: { paddingHorizontal: 13, paddingVertical: 6, borderRadius: radii.pill, borderWidth: 1, borderColor: c.glassBorder, backgroundColor: c.glassFill },
    chipActive: { backgroundColor: c.accentGhost, borderColor: c.mintBorder },
    chipText: { fontSize: 12, color: c.text3 },
    chipTextActive: { color: c.accent, fontWeight: "600" },

    segment: { flexDirection: "row", backgroundColor: c.glassFill, borderWidth: 1, borderColor: c.glassBorder, borderRadius: radii.pill, padding: 3, marginBottom: 12 },
    segItem: { flex: 1, paddingVertical: 7, borderRadius: radii.pill, alignItems: "center" },
    segItemActive: { backgroundColor: c.accent },
    segText: { fontSize: 12.5, fontWeight: "600", color: c.text3 },
    segTextActive: { color: "#fff" },
    swipeHint: { fontSize: 11, color: c.text4, textAlign: "center", marginBottom: 10 },

    swipeWrap: { borderRadius: radii.card, overflow: "hidden" },
    swipeBg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: radii.card, justifyContent: "center", paddingHorizontal: 22 },
    swipePublish: { backgroundColor: c.accent, alignItems: "flex-start" },
    swipeArchive: { backgroundColor: c.amber, alignItems: "flex-end" },
    swipeActText: { fontSize: 14, fontWeight: "700", color: "#fff" },

    list: { gap: 12 },
    card: { padding: 16, borderRadius: radii.card, backgroundColor: c.glassFill, borderWidth: 1, borderColor: c.glassBorder },
    cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
    cardTopRight: { flexDirection: "row", alignItems: "center", gap: 8 },
    tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill },
    tagText: { fontSize: 11, fontWeight: "600" },
    cardDate: { fontSize: 11, color: c.text4 },
    draftBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill, backgroundColor: c.mintBg, borderWidth: 1, borderColor: c.mintBorder },
    draftBadgeText: { fontSize: 10, color: c.accent, fontWeight: "600" },
    greenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.accent },
    cardTitle: { fontSize: 15, fontWeight: "600", color: c.text1, lineHeight: 21 },
    cardPreview: { fontSize: 12.5, color: c.text3, lineHeight: 18, marginTop: 6 },
    statusDim: { fontSize: 12, color: c.text4, marginTop: 8 },
    copyBtn: { marginTop: 12, alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 7, borderRadius: radii.pill, backgroundColor: c.glassFill, borderWidth: 1, borderColor: c.glassBorder },
    copyBtnText: { fontSize: 12.5, fontWeight: "600", color: c.accent },
    cardArchived: { opacity: 0.62 },
    cardStatusRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" },
    stPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: radii.pill, borderWidth: 1 },
    stPillText: { fontSize: 10, fontWeight: "600" },
    stDraft: { backgroundColor: c.amberGhost, borderColor: c.amberBorder },
    stDraftText: { color: c.amber },
    stPub: { backgroundColor: c.mintBg, borderColor: c.mintBorder },
    stPubText: { color: c.accent },
    stArch: { backgroundColor: c.glassFill, borderColor: c.glassBorder },
    stArchText: { color: c.text4 },
    cardAct: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: radii.pill, backgroundColor: c.glassFill, borderWidth: 1, borderColor: c.glassBorder },
    cardActText: { fontSize: 11, fontWeight: "600", color: c.text2 },

    fab: { position: "absolute", right: 20, bottom: 96, width: 56, height: 56, borderRadius: 28, backgroundColor: c.accent, alignItems: "center", justifyContent: "center", shadowColor: c.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 8 },
    fabPlus: { fontSize: 30, color: "#fff", marginTop: -2 },

    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    sheet: { backgroundColor: c.page, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28, maxHeight: "95%", minHeight: "60%" },
    sheetHandleRow: { alignItems: "center", paddingVertical: 4 },
    sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: c.border },
    sheetHdr: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4, marginBottom: 2 },
    sheetKicker: { fontSize: 11, letterSpacing: 0.6, fontWeight: "600", color: c.text4, textTransform: "uppercase" },
    sheetClose: { fontSize: 17, color: c.text3, fontWeight: "600" },
    sheetScroll: { flexShrink: 1 },
    fieldLb: { fontSize: 11, letterSpacing: 0.5, fontWeight: "600", color: c.text4, marginBottom: 6, marginTop: 14, textTransform: "uppercase" },
    input: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radii.btn, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: c.text1 },
    bodyInput: { minHeight: 160, textAlignVertical: "top" },
    hint: { fontSize: 12, color: c.text4, marginTop: 4 },
    pillarRow: { flexDirection: "row", gap: 8, paddingVertical: 2 },
    pillarChip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: radii.pill, backgroundColor: c.glassFill, borderWidth: 1, borderColor: c.glassBorder },
    pillarChipOn: { backgroundColor: c.accentGhost, borderColor: c.mintBorder },
    pillarChipText: { fontSize: 12, color: c.text3, maxWidth: 160 },
    pillarChipTextOn: { color: c.accent, fontWeight: "600" },

    platBtnRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    platBtn: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: radii.btn, backgroundColor: c.glassFill, borderWidth: 1, borderColor: c.glassBorder },
    platBtnText: { fontSize: 12.5, fontWeight: "600", color: c.accent },
    platCard: { marginTop: 10, borderRadius: radii.card, backgroundColor: c.glassFill, borderWidth: 1, borderColor: c.glassBorder, padding: 12 },
    platLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4, color: c.accent, textTransform: "uppercase", marginBottom: 6 },
    platInput: { fontSize: 14, color: c.text1, lineHeight: 21, minHeight: 70, textAlignVertical: "top" },

    sheetActions: { flexDirection: "row", gap: 10, marginTop: 16 },
    cancelBtn: { flex: 1, paddingVertical: 13, borderRadius: radii.btn, borderWidth: 1, borderColor: c.border, alignItems: "center" },
    cancelText: { fontSize: 14, fontWeight: "600", color: c.text2 },
    delBtn: { paddingHorizontal: 22, paddingVertical: 13, borderRadius: radii.btn, borderWidth: 1, borderColor: c.amberBorder, alignItems: "center" },
    delText: { fontSize: 14, fontWeight: "600", color: c.error },
    saveBtn: { flex: 1, paddingVertical: 13, borderRadius: radii.btn, backgroundColor: c.accent, alignItems: "center" },
    saveText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  });
}
