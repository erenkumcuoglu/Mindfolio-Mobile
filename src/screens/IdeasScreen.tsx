import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  Image,
  Animated,
  StyleSheet,
} from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { radii, spacing, type Palette } from "../theme/tokens";
import { SearchIcon, BulbIcon } from "../components/icons";
import { EmptyState } from "../components/EmptyState";
import { listIdeas, createIdea, deleteIdea, updateIdea, formatShortDate, type IdeaRow, type LinkPreview } from "../lib/data";
import { fetchLinkPreview } from "../lib/ai";
import { getCustomTags, saveCustomTags } from "../lib/tags";
import { confirmAsync, alertMsg } from "../lib/confirm";
import { useT } from "../lib/i18n";

export default function IdeasScreen() {
  const { c } = useTheme();
  const t = useT();
  const styles = makeStyles(c);
  const [rows, setRows] = useState<IdeaRow[] | null>(null);
  const [error, setError] = useState(false);
  const [adding, setAdding] = useState(false);
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [tagEditMode, setTagEditMode] = useState(false);
  const [editingIdea, setEditingIdea] = useState<IdeaRow | null>(null);
  const [deleteMode, setDeleteMode] = useState(false);
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(5);

  const load = () => {
    setRows(null);
    listIdeas().then(setRows).catch(() => setError(true));
  };
  useEffect(() => {
    load();
    getCustomTags().then(setCustomTags);
  }, []);

  // All tags = custom tags ∪ tags used across ideas (unique, order: custom first)
  const usedTags = Array.from(new Set((rows ?? []).flatMap((r) => r.tags ?? [])));
  const allTags = Array.from(new Set([...customTags, ...usedTags]));

  const persistTags = (tags: string[]) => { setCustomTags(tags); saveCustomTags(tags); };

  const submitTag = async () => {
    const name = newTag.trim();
    if (!name) { setCreating(false); setEditingTag(null); return; }
    if (editingTag) {
      // rename in the custom list + on every idea that uses it
      persistTags(customTags.map((x) => (x === editingTag ? name : x)));
      const affected = (rows ?? []).filter((r) => r.tags?.includes(editingTag));
      for (const r of affected) {
        await updateIdea(r.id, { tags: r.tags.map((x) => (x === editingTag ? name : x)) }).catch(() => {});
      }
      if (activeTag === editingTag) setActiveTag(name);
      load();
    } else if (!allTags.includes(name)) {
      persistTags([...customTags, name]);
    }
    setNewTag("");
    setCreating(false);
    setEditingTag(null);
  };

  const deleteTag = async (tag: string) => {
    const ok = await confirmAsync(`"${tag}" etiketini sil?`, "Bu etiket tüm fikirlerden kaldırılacak.", { confirmLabel: "Sil" });
    if (!ok) return;
    persistTags(customTags.filter((x) => x !== tag));
    const affected = (rows ?? []).filter((r) => r.tags?.includes(tag));
    for (const r of affected) {
      await updateIdea(r.id, { tags: r.tags.filter((x) => x !== tag) }).catch(() => {});
    }
    if (activeTag === tag) setActiveTag(null);
    load();
  };
  const startRenameTag = (tag: string) => { setEditingTag(tag); setNewTag(tag); setCreating(true); };

  const onDeleteIdea = async (idea: IdeaRow) => {
    const ok = await confirmAsync("Fikri sil?", idea.title, { confirmLabel: "Sil" });
    if (!ok) return;
    try {
      await deleteIdea(idea.id);
      setRows((p) => (p ? p.filter((x) => x.id !== idea.id) : p));
    } catch {
      alertMsg("Silme", "Fikir silinemedi.");
    }
  };

  const sourceLabel = (idea: IdeaRow) =>
    idea.preview?.site_name || idea.source_type || (idea.url ? "Bağlantı" : "Not");

  const q = query.trim().toLowerCase();
  const filtered = (rows ?? []).filter(
    (r) =>
      (!activeTag || r.tags?.includes(activeTag)) &&
      (!q ||
        r.title.toLowerCase().includes(q) ||
        (r.content ?? "").toLowerCase().includes(q) ||
        (r.preview?.site_name ?? "").toLowerCase().includes(q)),
  );
  const displayed = q ? filtered.slice(0, visible) : filtered;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.pgHdr}>
          <Text style={styles.pgTitle}>{t.ideasTitle}</Text>
          <Text style={styles.pgDesc}>{t.ideasDesc}</Text>
        </View>

        {rows !== null && (rows.length > 0 || allTags.length > 0) && (
          <View style={styles.search}>
            <SearchIcon color={c.text4} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={(v) => { setQuery(v); setVisible(5); }}
              placeholder="Fikirlerde ara…"
              placeholderTextColor={c.text4}
              autoCorrect={false}
            />
          </View>
        )}

        {/* Tag filter row (under the search bar) */}
        {rows !== null && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagRow}>
            {allTags.map((tag) => {
              const active = activeTag === tag;
              return (
                <View key={tag} style={styles.tagChipWrap}>
                  <TouchableOpacity
                    style={[styles.tagChip, active && styles.tagChipActive, tagEditMode && styles.tagChipEditing]}
                    activeOpacity={0.8}
                    onPress={() => (tagEditMode ? startRenameTag(tag) : setActiveTag(active ? null : tag))}
                    onLongPress={() => setTagEditMode(true)}
                  >
                    <Text style={[styles.tagChipText, active && styles.tagChipTextActive]}>{tag}</Text>
                  </TouchableOpacity>
                  {tagEditMode && (
                    <TouchableOpacity style={styles.tagDel} activeOpacity={0.8} onPress={() => deleteTag(tag)}>
                      <Text style={styles.tagDelText}>×</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}

            {creating ? (
              <View style={styles.tagCreateWrap}>
                <TextInput
                  style={styles.tagInput}
                  value={newTag}
                  onChangeText={setNewTag}
                  placeholder={editingTag ? "Yeni ad" : "Etiket adı"}
                  placeholderTextColor={c.text4}
                  autoFocus
                  onSubmitEditing={submitTag}
                  returnKeyType="done"
                />
                <TouchableOpacity style={styles.tagAddBtn} onPress={submitTag}>
                  <Text style={styles.tagAddBtnText}>{editingTag ? "Kaydet" : "Ekle"}</Text>
                </TouchableOpacity>
              </View>
            ) : tagEditMode ? (
              <TouchableOpacity style={styles.tagDoneChip} activeOpacity={0.8} onPress={() => { setTagEditMode(false); setEditingTag(null); }}>
                <Text style={styles.tagDoneText}>Bitti</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.tagAddChip} activeOpacity={0.8} onPress={() => setCreating(true)}>
                <Text style={styles.tagAddChipText}>Etiket Ekle +</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        )}

        {rows === null && !error && <View style={styles.loading}><ActivityIndicator color={c.accent} /></View>}
        {error && <Text style={styles.error}>Fikirler yüklenemedi.</Text>}

        {rows !== null && rows.length === 0 && (
          <EmptyState
            icon={<BulbIcon color={c.accent} />}
            title="Henüz fikir yok"
            motiv="Bir bağlantı veya not ekle — ilham kaynakların burada görünsün."
            ctaLabel="Fikir Ekle →"
            onCta={() => setAdding(true)}
          />
        )}

        {rows !== null && rows.length > 0 && (
          <View style={styles.grid}>
            {displayed.map((idea) => (
              <Jiggle key={idea.id} active={deleteMode} style={styles.cardWrap}>
                <TouchableOpacity
                  style={styles.card}
                  activeOpacity={0.85}
                  onPress={() => (deleteMode ? setDeleteMode(false) : setEditingIdea(idea))}
                  onLongPress={() => setDeleteMode(true)}
                >
                  {idea.preview?.image ? <Image source={{ uri: idea.preview.image }} style={styles.thumb} resizeMode="cover" /> : null}
                  <Text style={styles.srcLb} numberOfLines={1}>{sourceLabel(idea)}</Text>
                  <Text style={styles.cardTitle} numberOfLines={2}>{idea.title}</Text>
                  {(idea.content || idea.preview?.description) ? (
                    <Text style={styles.body} numberOfLines={2}>{idea.content || idea.preview?.description}</Text>
                  ) : null}
                  {idea.tags?.length ? (
                    <View style={styles.cardTags}>
                      {idea.tags.slice(0, 3).map((tg) => (
                        <View key={tg} style={styles.cardTag}><Text style={styles.cardTagText} numberOfLines={1}>{tg}</Text></View>
                      ))}
                    </View>
                  ) : null}
                  <Text style={styles.date}>{formatShortDate(idea.created_at)}</Text>
                </TouchableOpacity>
                {deleteMode && (
                  <TouchableOpacity style={styles.delBadge} activeOpacity={0.8} onPress={() => onDeleteIdea(idea)}>
                    <Text style={styles.delBadgeText}>×</Text>
                  </TouchableOpacity>
                )}
              </Jiggle>
            ))}
            {filtered.length === 0 && (
              <Text style={styles.noFilter}>
                {q ? `"${query}" için sonuç yok.` : `"${activeTag}" etiketli fikir yok.`}
              </Text>
            )}
            {q && filtered.length > visible && (
              <TouchableOpacity style={styles.moreRow} activeOpacity={0.7} onPress={() => setVisible((v) => v + 5)}>
                <Text style={styles.moreText}>Sonraki 5 sonuç →</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={() => (deleteMode ? setDeleteMode(false) : setAdding(true))}>
        <Text style={styles.fabPlus}>{deleteMode ? "✓" : "＋"}</Text>
      </TouchableOpacity>

      <AddIdeaModal
        visible={adding}
        allTags={allTags}
        onClose={() => setAdding(false)}
        onSaved={() => { setAdding(false); load(); }}
      />

      <AddIdeaModal
        visible={!!editingIdea}
        item={editingIdea}
        allTags={allTags}
        onClose={() => setEditingIdea(null)}
        onSaved={() => { setEditingIdea(null); load(); }}
      />
    </View>
  );
}

function AddIdeaModal({ visible, item, allTags, onClose, onSaved }: {
  visible: boolean; item?: IdeaRow | null; allTags: string[]; onClose: () => void; onSaved: () => void;
}) {
  const { c } = useTheme();
  const styles = makeStyles(c);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setTitle(item?.title ?? "");
      setUrl(item?.url ?? "");
      setNotes(item?.content ?? "");
      setTags(item?.tags ?? []);
      setPreview(item?.preview ?? null);
    }
  }, [visible, item]);

  const reset = () => { setTitle(""); setUrl(""); setNotes(""); setTags([]); setPreview(null); };

  const onUrlBlur = async () => {
    const u = url.trim();
    if (!/^https?:\/\//.test(u)) return;
    setFetching(true);
    const p = await fetchLinkPreview(u);
    setFetching(false);
    if (p) { setPreview(p); if (!title.trim() && p.title) setTitle(p.title); }
  };

  const save = async () => {
    if (!title.trim() && !url.trim() && !notes.trim()) return;
    setSaving(true);
    try {
      if (item) {
        await updateIdea(item.id, { title: title.trim() || item.title, content: notes.trim() || null, tags });
      } else {
        await createIdea({
          title: title.trim() || preview?.title || url.trim() || notes.trim().slice(0, 60),
          url: url.trim() || undefined,
          content: notes.trim() || undefined,
          source_type: preview?.platform,
          tags,
          preview: preview ?? undefined,
        });
      }
      reset();
      onSaved();
    } catch (e: any) {
      alertMsg("Kaydetme", e?.message ?? "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{item ? "Fikri Düzenle" : "Yeni Fikir"}</Text>

          <Text style={styles.fieldLb}>Bağlantı (otomatik çekilir)</Text>
          <TextInput
            style={styles.input}
            placeholder="https://…"
            placeholderTextColor={c.text4}
            value={url}
            onChangeText={setUrl}
            onBlur={onUrlBlur}
            onEndEditing={onUrlBlur}
            autoCapitalize="none"
            keyboardType="url"
            autoCorrect={false}
          />
          {fetching && <Text style={styles.fetchNote}>Önizleme çekiliyor…</Text>}
          {preview && (
            <View style={styles.previewCard}>
              {preview.image ? <Image source={{ uri: preview.image }} style={styles.previewImg} resizeMode="cover" /> : null}
              <View style={{ flex: 1 }}>
                <Text style={styles.previewTitle} numberOfLines={2}>{preview.title || "Önizleme"}</Text>
                {preview.description ? <Text style={styles.previewDesc} numberOfLines={2}>{preview.description}</Text> : null}
              </View>
            </View>
          )}

          <Text style={styles.fieldLb}>Başlık</Text>
          <TextInput style={styles.input} placeholder="Fikir başlığı" placeholderTextColor={c.text4} value={title} onChangeText={setTitle} />

          <Text style={styles.fieldLb}>Not</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder="Bu fikre dair notların… (isteğe bağlı)"
            placeholderTextColor={c.text4}
            value={notes}
            onChangeText={setNotes}
            multiline
          />

          {allTags.length > 0 && (
            <>
              <Text style={styles.fieldLb}>Etiketler</Text>
              <View style={styles.modalTags}>
                {allTags.map((tg) => {
                  const on = tags.includes(tg);
                  return (
                    <TouchableOpacity
                      key={tg}
                      style={[styles.modalTag, on && styles.modalTagOn]}
                      onPress={() => setTags((p) => (on ? p.filter((x) => x !== tg) : [...p, tg]))}
                    >
                      <Text style={[styles.modalTagText, on && styles.modalTagTextOn]}>{tg}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          <View style={styles.sheetActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}><Text style={styles.cancelText}>Vazgeç</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.5 }]} onPress={save} disabled={saving}>
              <Text style={styles.saveText}>{saving ? "Kaydediliyor…" : "Kaydet"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** iOS-style jiggle for delete mode. */
function Jiggle({ active, style, children }: { active: boolean; style?: object; children: React.ReactNode }) {
  const r = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) { r.stopAnimation(); r.setValue(0); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(r, { toValue: 1, duration: 110, useNativeDriver: true }),
        Animated.timing(r, { toValue: -1, duration: 110, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active]);
  const rotate = r.interpolate({ inputRange: [-1, 1], outputRange: ["-1.5deg", "1.5deg"] });
  return <Animated.View style={[style, { transform: [{ rotate }] }]}>{children}</Animated.View>;
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.page },
    content: { paddingHorizontal: spacing.md, paddingTop: 56, paddingBottom: 130 },

    pgHdr: { marginBottom: 16 },
    pgTitle: { fontSize: 28, fontWeight: "700", letterSpacing: -1, color: c.text1 },
    pgDesc: { fontSize: 13, color: c.text3, marginTop: 2 },

    search: { flexDirection: "row", alignItems: "center", alignSelf: "stretch", gap: 8, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 12, backgroundColor: c.glassFill, borderWidth: 1, borderColor: c.glassBorder, marginBottom: 12 },
    searchPh: { fontSize: 14, color: c.text4 },
    searchInput: { flex: 1, minWidth: 0, fontSize: 15, color: c.text1, padding: 0, height: 22 },
    moreRow: { width: "100%", alignItems: "center", paddingVertical: 12, marginTop: 4 },
    moreText: { fontSize: 13, fontWeight: "600", color: c.accent },

    tagRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, marginBottom: 14 },
    tagChipWrap: { position: "relative" },
    tagChip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: radii.pill, backgroundColor: c.glassFill, borderWidth: 1, borderColor: c.glassBorder },
    tagChipActive: { backgroundColor: c.accentGhost, borderColor: c.mintBorder },
    tagChipEditing: { borderColor: c.mintBorder, borderStyle: "dashed" },
    tagDel: { position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: 9, backgroundColor: c.error, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: c.page },
    tagDelText: { color: "#fff", fontSize: 12, lineHeight: 13, fontWeight: "700" },
    tagDoneChip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: radii.pill, backgroundColor: c.accent },
    tagDoneText: { fontSize: 12, fontWeight: "600", color: "#fff" },
    tagChipText: { fontSize: 12, color: c.text3 },
    tagChipTextActive: { color: c.accent, fontWeight: "600" },
    tagAddChip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: radii.pill, borderWidth: 1, borderColor: c.glassBorder, borderStyle: "dashed" },
    tagAddChipText: { fontSize: 12, color: c.text4 },
    tagCreateWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
    tagInput: { minWidth: 110, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radii.pill, borderWidth: 1, borderColor: c.mintBorder, backgroundColor: c.surface, color: c.text1, fontSize: 12 },
    tagAddBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radii.pill, backgroundColor: c.accent },
    tagAddBtnText: { fontSize: 12, fontWeight: "600", color: "#fff" },

    loading: { paddingVertical: 60, alignItems: "center" },
    error: { paddingVertical: 40, textAlign: "center", color: c.error, fontSize: 14 },
    noFilter: { width: "100%", textAlign: "center", color: c.text4, fontSize: 13, paddingVertical: 24 },

    grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 10 },
    cardWrap: { width: "48%", position: "relative" },
    card: { width: "100%", padding: 12, borderRadius: radii.card, backgroundColor: c.glassFill, borderWidth: 1, borderColor: c.glassBorder },
    delBadge: { position: "absolute", top: -7, right: -7, width: 24, height: 24, borderRadius: 12, backgroundColor: c.error, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: c.page },
    delBadgeText: { color: "#fff", fontSize: 16, lineHeight: 18, fontWeight: "700" },
    thumb: { width: "100%", height: 80, borderRadius: 10, marginBottom: 8, backgroundColor: c.surfaceElevated },
    srcLb: { fontSize: 11, fontWeight: "600", color: c.accent, marginBottom: 4 },
    cardTitle: { fontSize: 14, fontWeight: "600", color: c.text1, lineHeight: 19 },
    body: { fontSize: 12, color: c.text3, lineHeight: 17, marginTop: 4 },
    cardTags: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 8 },
    cardTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill, backgroundColor: c.glassFillStrong },
    cardTagText: { fontSize: 10, color: c.text3, maxWidth: 80 },
    date: { fontSize: 10, color: c.text4, marginTop: 8 },

    fab: { position: "absolute", right: 20, bottom: 96, width: 56, height: 56, borderRadius: 28, backgroundColor: c.accent, alignItems: "center", justifyContent: "center", shadowColor: c.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 8 },
    fabPlus: { fontSize: 30, color: "#fff", marginTop: -2 },

    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    sheet: { backgroundColor: c.page, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
    sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, alignSelf: "center", marginBottom: 16 },
    sheetTitle: { fontSize: 20, fontWeight: "700", color: c.text1, marginBottom: 4 },
    fieldLb: { fontSize: 12, color: c.text3, marginBottom: 6, marginTop: 12 },
    input: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radii.btn, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: c.text1 },
    notesInput: { minHeight: 64, textAlignVertical: "top" },
    fetchNote: { fontSize: 12, color: c.accent, marginTop: 8 },
    previewCard: { flexDirection: "row", gap: 10, marginTop: 12, padding: 10, borderRadius: 12, backgroundColor: c.glassFill, borderWidth: 1, borderColor: c.glassBorder },
    previewImg: { width: 56, height: 56, borderRadius: 8, backgroundColor: c.surfaceElevated },
    previewTitle: { fontSize: 13, fontWeight: "600", color: c.text1 },
    previewDesc: { fontSize: 12, color: c.text3, marginTop: 2 },
    modalTags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    modalTag: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radii.pill, backgroundColor: c.glassFill, borderWidth: 1, borderColor: c.glassBorder },
    modalTagOn: { backgroundColor: c.accentGhost, borderColor: c.mintBorder },
    modalTagText: { fontSize: 12, color: c.text3 },
    modalTagTextOn: { color: c.accent, fontWeight: "600" },
    sheetActions: { flexDirection: "row", gap: 10, marginTop: 24 },
    cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: radii.btn, borderWidth: 1, borderColor: c.border, alignItems: "center" },
    cancelText: { fontSize: 15, fontWeight: "600", color: c.text2 },
    saveBtn: { flex: 1, paddingVertical: 14, borderRadius: radii.btn, backgroundColor: c.accent, alignItems: "center" },
    saveText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  });
}
