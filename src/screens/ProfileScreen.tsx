import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import Svg, { Path, Rect, Circle } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase, authedFetch } from "../lib/supabase";
import { useTheme } from "../theme/ThemeContext";
import { ThemeToggle } from "../components/ThemeToggle";
import { PaywallModal } from "../components/PaywallModal";
import { radii, spacing, type Palette } from "../theme/tokens";
import { getPersona, savePillars, savePersonaProfile, type PersonaRow } from "../lib/data";
import { alertMsg, confirmAsync } from "../lib/confirm";
import { useT, useLang } from "../lib/i18n";

interface UsageStats {
  daily: { current: number; limit: number; remaining: number };
  monthly: { current: number; limit: number; remaining: number };
}
const DAY = 86400000;
const CELEB_KEY = "mindfolio.strategyCelebrated";

interface Props {
  onLogout: () => void;
}

/* ─────────── Inline section-header icons (1:1 mockup) ─────────── */
function SecIconPositioning({ color }: { color: string }) {
  return (
    <Svg width={10} height={10} viewBox="0 0 12 12" fill="none">
      <Circle cx={6} cy={6} r={4} stroke={color} strokeWidth={1.4} />
      <Circle cx={6} cy={6} r={1.5} fill={color} />
    </Svg>
  );
}
function SecIconPillars({ color }: { color: string }) {
  return (
    <Svg width={10} height={10} viewBox="0 0 12 12" fill="none">
      <Rect x={1} y={1} width={4} height={10} rx={1} fill={color} opacity={0.6} />
      <Rect x={7} y={3} width={4} height={8} rx={1} fill={color} />
    </Svg>
  );
}
function SecIconVoice({ color }: { color: string }) {
  return (
    <Svg width={10} height={10} viewBox="0 0 12 12" fill="none">
      <Path d="M6 1a2.5 2.5 0 012.5 2.5v3A2.5 2.5 0 013.5 6.5v-3A2.5 2.5 0 016 1z" stroke={color} strokeWidth={1.3} />
      <Path d="M2 6v.5a4 4 0 008 0V6" stroke={color} strokeWidth={1.3} strokeLinecap="round" />
    </Svg>
  );
}
function SecIconCheck({ color }: { color: string }) {
  return (
    <Svg width={10} height={10} viewBox="0 0 12 12" fill="none">
      <Path d="M2 6l2.5 2.5 5.5-5.5" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function SecIconPost({ color }: { color: string }) {
  return (
    <Svg width={10} height={10} viewBox="0 0 12 12" fill="none">
      <Rect x={1} y={1} width={10} height={10} rx={2} stroke={color} strokeWidth={1.3} />
      <Path d="M3 4.5h6M3 6.5h4M3 8.5h5" stroke={color} strokeWidth={1.2} strokeLinecap="round" />
    </Svg>
  );
}
function SecIconAudience({ color }: { color: string }) {
  return (
    <Svg width={10} height={10} viewBox="0 0 12 12" fill="none">
      <Circle cx={4} cy={4} r={2.5} stroke={color} strokeWidth={1.3} />
      <Circle cx={8.5} cy={7} r={2} stroke={color} strokeWidth={1.3} />
    </Svg>
  );
}
function SecIconValues({ color }: { color: string }) {
  return (
    <Svg width={10} height={10} viewBox="0 0 12 12" fill="none">
      <Path d="M6 1l1.5 3 3.5.5-2.5 2.5.5 3.5L6 9l-3 1.5.5-3.5L1 4.5 4.5 4z" stroke={color} strokeWidth={1.2} strokeLinejoin="round" />
    </Svg>
  );
}
function SecIconPlatforms({ color }: { color: string }) {
  return (
    <Svg width={10} height={10} viewBox="0 0 12 12" fill="none">
      <Rect x={1} y={1} width={4.5} height={4.5} rx={1} stroke={color} strokeWidth={1.2} />
      <Rect x={6.5} y={1} width={4.5} height={4.5} rx={1} stroke={color} strokeWidth={1.2} />
      <Rect x={1} y={6.5} width={4.5} height={4.5} rx={1} stroke={color} strokeWidth={1.2} />
      <Rect x={6.5} y={6.5} width={4.5} height={4.5} rx={1} stroke={color} strokeWidth={1.2} />
    </Svg>
  );
}
function SecIconUsage({ color }: { color: string }) {
  return (
    <Svg width={10} height={10} viewBox="0 0 12 12" fill="none">
      <Rect x={1} y={3} width={10} height={7} rx={1.5} stroke={color} strokeWidth={1.3} />
      <Path d="M4 3V2a2 2 0 014 0v1" stroke={color} strokeWidth={1.3} strokeLinecap="round" />
    </Svg>
  );
}
function LockGlyph({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Rect x={2.5} y={6.5} width={11} height={7.5} rx={2} stroke={color} strokeWidth={1.5} />
      <Path d="M5 6.5V5a3 3 0 016 0v1.5" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}
function CheckGlyph() {
  return (
    <Svg width={9} height={9} viewBox="0 0 10 10" fill="none">
      <Path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/* ─────────── Section header — ikonlu, sağa buton opsiyonel ─────────── */
function SectionHeader({
  icon,
  label,
  right,
  c,
}: {
  icon: React.ReactNode;
  label: string;
  right?: React.ReactNode;
  c: Palette;
}) {
  const s = sectionHeaderStyles(c);
  return (
    <View style={s.row}>
      <View style={s.left}>
        <View style={s.iconWrap}>{icon}</View>
        <Text style={s.label}>{label}</Text>
      </View>
      {right}
    </View>
  );
}

/* ─────────── Component ─────────── */
export default function ProfileScreen({ onLogout }: Props) {
  const { c } = useTheme();
  const t = useT();
  const { lang, setLang } = useLang();
  const styles = makeStyles(c);
  const [name, setName] = useState("");
  const [persona, setPersona] = useState<PersonaRow | null | undefined>(undefined);
  const [paywall, setPaywall] = useState(false);
  const [pillars, setPillars] = useState<string[]>([]);
  const [newPillar, setNewPillar] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [editingPos, setEditingPos] = useState(false);
  const [posDraft, setPosDraft] = useState("");
  const [voiceDraft, setVoiceDraft] = useState("");
  const [audienceDraft, setAudienceDraft] = useState("");
  const [fieldDraft, setFieldDraft] = useState("");
  const [goalDraft, setGoalDraft] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [linkedinDraft, setLinkedinDraft] = useState("");
  const [helperDraft, setHelperDraft] = useState("");
  const [savingPos, setSavingPos] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [lockModal, setLockModal] = useState(false);
  const savedAnim = useRef(new Animated.Value(0)).current;

  // Kutlama toast (Pro·Tam) — bir kez göster, sonra kapansın
  const [showCeleb, setShowCeleb] = useState(false);
  const celebAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (u) setName(u.user_metadata?.display_name ?? u.email?.split("@")[0] ?? "");
    });
    getPersona()
      .then((p) => {
        setPersona(p);
        setPillars((p?.profile?.pillars ?? []).map((x) => x.title).filter(Boolean));
      })
      .catch(() => setPersona(null));
    authedFetch("/api/usage").then((r) => r.json()).then((d) => { if (d?.monthly) setUsage(d); }).catch(() => {});
  }, []);

  const profile = persona?.profile ?? null;
  const positioning = profile?.positioning_statement;
  const voice = profile?.voice_profile ?? [];
  const voiceAvoid: string[] = (profile as any)?.voice_avoid ?? [];
  const descFor = (title: string) => (profile?.pillars ?? []).find((x) => x.title === title)?.description ?? "";
  const purpose = profile?.purpose;
  const audience = profile?.audience;
  const values = profile?.values ?? [];
  const diffDo = profile?.differentiation?.do ?? [];
  const diffDont = profile?.differentiation?.dont ?? [];
  const samplePost = profile?.sample_post;
  const platforms = profile?.suggested_platforms ?? [];
  const cadence = profile?.cadence;
  const toneStyle = profile?.tone?.style;

  const lastChanged = profile?.persona_changed_at ? new Date(profile.persona_changed_at).getTime() : 0;
  const daysSince = lastChanged ? Math.floor((Date.now() - lastChanged) / DAY) : Infinity;
  const canEditPersona = daysSince >= 30;
  const nextEditDate = lastChanged
    ? new Date(lastChanged + 30 * DAY).toLocaleDateString("tr-TR", { day: "2-digit", month: "long" })
    : null;

  // ─────────── State detection ───────────
  const isProSub = !!profile?.subscription?.active;
  // Zorunlu (checklist doluluğu): Konumlandırma + en az 3 pillar + Ses/Ton (voice_profile).
  // 5 zorunlu değil — AI genellikle 3-5 üretir; ideal 5'tir ama 3 de yayına hazır.
  const hasPositioning = !!positioning;
  const hasEnoughPillars = pillars.length >= 3;
  const hasVoice = voice.length > 0;
  const strategyDoneCount = [hasPositioning, hasEnoughPillars, hasVoice].filter(Boolean).length;
  const isStrategyComplete = strategyDoneCount === 3;
  const profileState: "free" | "pro-incomplete" | "pro-complete" = !isProSub
    ? "free"
    : isStrategyComplete
      ? "pro-complete"
      : "pro-incomplete";

  // Kutlama toast — Pro·Tam olduğunda ve önceden gösterilmediyse 1× göster
  useEffect(() => {
    if (profileState !== "pro-complete") return;
    AsyncStorage.getItem(CELEB_KEY).then((v) => {
      if (v === "1") return;
      setShowCeleb(true);
      Animated.timing(celebAnim, { toValue: 1, duration: 260, useNativeDriver: true }).start();
      const to = setTimeout(() => {
        Animated.timing(celebAnim, { toValue: 0, duration: 260, useNativeDriver: true }).start(() => {
          setShowCeleb(false);
          AsyncStorage.setItem(CELEB_KEY, "1").catch(() => {});
        });
      }, 3000);
      return () => clearTimeout(to);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileState]);

  const flashSaved = () => {
    savedAnim.setValue(0);
    Animated.sequence([
      Animated.timing(savedAnim, { toValue: 1, duration: 220, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.delay(1100),
      Animated.timing(savedAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
  };

  const startEditPos = () => {
    if (!canEditPersona) { setLockModal(true); return; }
    setPosDraft(positioning ?? "");
    setVoiceDraft(voice.join(", "));
    setAudienceDraft(profile?.audience ?? "");
    setFieldDraft(profile?.demographics?.industry || profile?.demographics?.role || "");
    setGoalDraft(profile?.purpose ?? "");
    setNameDraft(name);
    setLinkedinDraft(profile?.linkedin_url ?? "");
    setHelperDraft("");
    setEditingPos(true);
  };

  const persistNameIfChanged = async () => {
    if (nameDraft.trim() && nameDraft.trim() !== name) {
      try {
        await supabase.auth.updateUser({ data: { display_name: nameDraft.trim() } });
        setName(nameDraft.trim());
      } catch { /* ignore */ }
    }
  };

  const savePos = async () => {
    const ok = await confirmAsync(
      "Persona'yı güncelle?",
      "Tutarlı strateji ve modelin sesini doğru öğrenmesi için persona ayda yalnızca bir kez değiştirilebilir. Kaydedersen bir ay boyunca kilitlenir. Devam edilsin mi?",
      { confirmLabel: "Güncelle", cancelLabel: "Vazgeç", destructive: false },
    );
    if (!ok) return;
    setSavingPos(true);
    try {
      const now = new Date().toISOString();
      const voiceArr = voiceDraft.split(",").map((s) => s.trim()).filter(Boolean);
      const patch: any = {
        positioning_statement: posDraft.trim(),
        voice_profile: voiceArr,
        audience: audienceDraft.trim(),
        purpose: goalDraft.trim(),
        linkedin_url: linkedinDraft.trim(),
        demographics: { ...(profile?.demographics ?? {}), industry: fieldDraft.trim() },
        persona_changed_at: now,
      };
      await savePersonaProfile(patch);
      await persistNameIfChanged();
      setPersona((prev) => (prev ? { ...prev, profile: { ...(prev.profile ?? {}), ...patch } } : prev));
      setEditingPos(false);
      flashSaved();
    } catch {
      alertMsg("Kaydetme", "Persona kaydedilemedi (persona tablosu gerekebilir).");
    } finally {
      setSavingPos(false);
    }
  };

  const regeneratePersona = async () => {
    const ok = await confirmAsync(
      "Stratejini yeniden üretelim mi?",
      "Bilgilerinin olabildiğince doğru ve dolu olmasına dikkat et. Marka dilinin tutarlı kalması ve modelin senin sesini doğru öğrenebilmesi için sık değişiklik önermiyoruz — bir sonraki güncelleme 1 ay sonra yapılabilir.",
      { confirmLabel: "Devam et", cancelLabel: "İptal", destructive: false },
    );
    if (!ok) return;
    setRegenLoading(true);
    try {
      const res = await authedFetch("/api/ai/analyze-persona", {
        method: "POST",
        body: JSON.stringify({
          goal: goalDraft.trim() || "Kitle ve otorite inşa etmek",
          field: fieldDraft.trim() || "Genel",
          hasContent: "yes",
          voiceTraits: voiceDraft.trim() || voice.join(", ") || "net, samimi, özgün",
          audience: audienceDraft.trim() || "Alanındaki profesyoneller",
          positioning: posDraft.trim() || positioning || "Kendi alanında özgün bir ses",
          importedContent: helperDraft.trim() || linkedinDraft.trim() || undefined,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.profile) throw new Error(d.error || "Üretilemedi");
      const now = new Date().toISOString();
      await savePersonaProfile({ ...d.profile, linkedin_url: linkedinDraft.trim() || d.profile.linkedin_url || "", persona_changed_at: now });
      await persistNameIfChanged();
      const fresh = await getPersona();
      setPersona(fresh);
      setPillars((fresh?.profile?.pillars ?? []).map((x) => x.title).filter(Boolean));
      // Yeni bir persona geldiğinde kutlama flag'ini sıfırla — tam olursa tekrar göstersin
      AsyncStorage.removeItem(CELEB_KEY).catch(() => {});
      setEditingPos(false);
      flashSaved();
    } catch (e: any) {
      alertMsg("AI", e?.message ?? "Persona üretilemedi.");
    } finally {
      setRegenLoading(false);
    }
  };

  // Pillar editor
  const pillarsFull: { title: string; description: string }[] = (profile?.pillars ?? [])
    .filter((p) => !!p.title)
    .map((p) => ({ title: p.title, description: p.description ?? "" }));

  const persistPillarsFull = async (next: { title: string; description: string }[]) => {
    setPillars(next.map((p) => p.title));
    try { await savePillars(next); }
    catch { alertMsg("Kaydetme", "Pillar kaydedilemedi."); }
  };

  const addOrUpdatePillar = () => {
    if (!canEditPersona) { setLockModal(true); return; }
    const title = newPillar.trim();
    const desc = newDesc.trim();
    if (!title) { setEditingIdx(null); setNewPillar(""); setNewDesc(""); return; }
    const current: { title: string; description: string }[] = pillarsFull.length
      ? pillarsFull
      : pillars.map((tt) => ({ title: tt, description: descFor(tt) }));
    let next: { title: string; description: string }[];
    if (editingIdx != null) next = current.map((p, i) => (i === editingIdx ? { title, description: desc } : p));
    else next = current.some((p) => p.title === title) ? current : [...current, { title, description: desc }];
    persistPillarsFull(next);
    setNewPillar("");
    setNewDesc("");
    setEditingIdx(null);
  };

  // Referral / promo
  const [promo, setPromo] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [ref, setRef] = useState<{ code: string; referrals: number; earnedMonths: number; appliedCode: boolean } | null>(null);
  const [refInput, setRefInput] = useState("");

  useEffect(() => {
    authedFetch("/api/referral").then((r) => r.json()).then((d) => { if (d.code) setRef(d); }).catch(() => {});
  }, []);

  const applyRef = async () => {
    if (!refInput.trim()) return;
    try {
      const res = await authedFetch("/api/referral", { method: "POST", body: JSON.stringify({ code: refInput.trim() }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) alertMsg("Davet", d.error || "Kod uygulanamadı.");
      else {
        alertMsg("Tebrikler 🎉", "Davet kodu uygulandı.");
        setRefInput("");
        authedFetch("/api/referral").then((r) => r.json()).then((x) => { if (x.code) setRef(x); }).catch(() => {});
      }
    } catch { alertMsg("Davet", "Bağlantı hatası."); }
  };
  const redeemPromo = async () => {
    if (!promo.trim()) return;
    setPromoLoading(true);
    try {
      const res = await authedFetch("/api/promo/redeem", { method: "POST", body: JSON.stringify({ code: promo.trim() }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) alertMsg("Promo", data.error || "Kod kullanılamadı.");
      else {
        alertMsg("Tebrikler 🎉", `${data.duration_days} günlük Pro üyelik tanımlandı!`);
        setPromo("");
        getPersona().then(setPersona).catch(() => {});
      }
    } catch { alertMsg("Promo", "Bağlantı hatası."); }
    finally { setPromoLoading(false); }
  };

  const role = profile?.demographics
    ? [profile.demographics.industry, profile.demographics.role].filter(Boolean).join(" · ")
    : persona?.description || "";
  const initial = (name || "?").charAt(0).toUpperCase();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onLogout();
  };

  // Ücretsiz state'de accent → amber; Pro state'de accent → yeşil (mevcut c.accent)
  const primary = profileState === "free" ? c.amber : c.accent;
  const primaryDeep = profileState === "free" ? c.amber : c.accentDeep;
  const primaryGhost = profileState === "free" ? c.amberGhost : c.accentGhost;
  const primaryBorder = profileState === "free" ? c.amberBorder : c.mintBorder;

  const strategyPct = Math.round((strategyDoneCount / 3) * 100);

  return (
    <>
      {/* KeyboardAvoidingView — düzenleme modunda alt TextInput'lar klavye açılınca
          görünmez oluyordu; iOS'ta padding davranışı ScrollView içindeki alanı
          klavye üstüne kaldırır. */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
      <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.top}>
          <View style={[styles.avatar, { backgroundColor: primary }]}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.info}>
            <Text style={styles.name}>{name || "Profilim"}</Text>
            {!!role && <Text style={styles.role}>{role}</Text>}
          </View>
          {!editingPos && (
            <TouchableOpacity onPress={startEditPos} style={styles.editProfileBtn} activeOpacity={0.8}>
              <Text style={styles.editProfileBtnText}>Düzenle</Text>
            </TouchableOpacity>
          )}
        </View>

        {persona === undefined ? (
          <View style={styles.loading}><ActivityIndicator color={primary} /></View>
        ) : editingPos ? (
          renderEditor(styles, c, primary, primaryGhost, primaryBorder, {
            nameDraft, setNameDraft, posDraft, setPosDraft, voiceDraft, setVoiceDraft,
            audienceDraft, setAudienceDraft, fieldDraft, setFieldDraft, goalDraft, setGoalDraft,
            linkedinDraft, setLinkedinDraft, helperDraft, setHelperDraft,
            savingPos, regenLoading, savePos, regeneratePersona,
            cancel: () => setEditingPos(false),
          })
        ) : (
          <>
            {/* ─────────── State-specific top card ─────────── */}
            {profileState === "free" && (
              <View style={[styles.lockCard, { backgroundColor: c.amberGhost, borderColor: c.amberBorder }]}>
                <View style={[styles.lockIconWrap, { backgroundColor: c.amberGhost, borderColor: c.amberBorder }]}>
                  <LockGlyph color={c.amber} />
                </View>
                <Text style={styles.lockTitleNew}>Stratejinin tamamı Pro'da</Text>
                <Text style={styles.lockSub}>
                  Konu başlıkların, farklılaşman, örnek postun ve platform planın hazır. Kilidini aç, üretmeye başla.
                </Text>
                <TouchableOpacity
                  style={[styles.lockBtnPrimary, { backgroundColor: c.amber, shadowColor: c.amber }]}
                  activeOpacity={0.85}
                  onPress={() => setPaywall(true)}
                >
                  <Text style={styles.lockBtnPrimaryText}>Stratejimi Aç</Text>
                </TouchableOpacity>
              </View>
            )}

            {profileState === "pro-incomplete" && (
              <>
                <View style={[styles.progCard, { backgroundColor: c.accentGhost, borderColor: c.mintBorder }]}>
                  <View style={styles.progTopRow}>
                    <Text style={styles.progTitle}>Stratejin %{strategyPct} tamam</Text>
                    <Text style={[styles.progPct, { color: c.accentText }]}>{strategyDoneCount} / 3 bölüm</Text>
                  </View>
                  <View style={styles.progBarWrap}>
                    <View style={[styles.progBarFill, { width: `${strategyPct}%`, backgroundColor: c.accent }]} />
                  </View>
                  <Text style={styles.progSub}>
                    {3 - strategyDoneCount === 0
                      ? "Tüm zorunlu bölümler hazır — kutlamayı hak ettin."
                      : `${3 - strategyDoneCount} bölümü doldur, stratejin yayına hazır olsun.`}
                  </Text>
                </View>

                <View style={styles.chkCard}>
                  <View style={[styles.chkRow, styles.chkRowBorder]}>
                    <View style={[hasPositioning ? styles.chkIconDone : styles.chkIconTodo, hasPositioning && { backgroundColor: c.accent }]}>
                      {hasPositioning ? <CheckGlyph /> : null}
                    </View>
                    <Text style={hasPositioning ? styles.chkTxtDone : styles.chkTxt}>Konumlandırma</Text>
                    {!hasPositioning && (
                      <TouchableOpacity onPress={startEditPos} style={[styles.chkAddBtn, { backgroundColor: c.accent }]}>
                        <Text style={styles.chkAddBtnText}>Doldur</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={[styles.chkRow, styles.chkRowBorder]}>
                    <View style={[hasEnoughPillars ? styles.chkIconDone : styles.chkIconTodo, hasEnoughPillars && { backgroundColor: c.accent }]}>
                      {hasEnoughPillars ? <CheckGlyph /> : null}
                    </View>
                    <Text style={hasEnoughPillars ? styles.chkTxtDone : styles.chkTxt}>
                      İçerik Sütunları · {pillars.length}/5
                    </Text>
                    {!hasEnoughPillars && (
                      // Konu Başlıkları eksik → tek çare: AI ile yeniden üret (persona edit modu).
                      // startEditPos açıyor → içinde "AI ile Yeniden Üret" butonu tek tıkta 5 pillar dahil
                      // tüm stratejiyi güncelliyor. Alternatif: elle 5 pillar girmek → yorucu, çürütücü.
                      <TouchableOpacity onPress={startEditPos} style={[styles.chkAddBtn, { backgroundColor: c.accent }]}>
                        <Text style={styles.chkAddBtnText}>Doldur</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={styles.chkRow}>
                    <View style={[hasVoice ? styles.chkIconDone : styles.chkIconTodo, hasVoice && { backgroundColor: c.accent }]}>
                      {hasVoice ? <CheckGlyph /> : null}
                    </View>
                    <Text style={hasVoice ? styles.chkTxtDone : styles.chkTxt}>Ses & Ton</Text>
                    {!hasVoice && (
                      <TouchableOpacity onPress={startEditPos} style={[styles.chkAddBtn, { backgroundColor: c.accent }]}>
                        <Text style={styles.chkAddBtnText}>Doldur</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </>
            )}

            {profileState === "pro-complete" && showCeleb && (
              <Animated.View style={{ opacity: celebAnim, transform: [{ translateY: celebAnim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }] }}>
                <View style={[styles.ctaCard, { backgroundColor: c.accentGhost, borderColor: c.mintBorder }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ctaTitle}>Stratejin tamam ✓</Text>
                    <Text style={styles.ctaSub}>Tüm zorunlu bölümler dolu</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.ctaBtn, { backgroundColor: c.accent, shadowColor: c.accent }]}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.ctaBtnText}>Bugün üret →</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            )}

            {/* ─────────── Konumlandırma ─────────── */}
            {(positioning || profileState !== "free") && (
              <>
                <SectionHeader icon={<SecIconPositioning color={primary} />} label="Konumlandırma" c={c} />
                <View style={[styles.posCardNew, { backgroundColor: primaryGhost, borderColor: primaryBorder }]}>
                  {positioning ? (
                    <Text style={styles.posTxNew}>"{positioning}"</Text>
                  ) : (
                    <Text style={[styles.posTxNew, { fontStyle: "normal", color: c.text4 }]}>
                      Henüz konumlandırma yok — Düzenle ile ekle.
                    </Text>
                  )}
                </View>
                {purpose ? <Text style={styles.purposeTx}>{purpose}</Text> : null}
              </>
            )}

            {/* ─────────── Ücretsiz: bulanık teaser ─────────── */}
            {profileState === "free" && (
              <View style={styles.blurWrap}>
                <View style={styles.blurInner}>
                  <SectionHeader icon={<SecIconPillars color={primary} />} label="İçerik Sütunları" c={c} />
                  <View style={styles.pillarsCard}>
                    {(pillars.length ? pillars : ["Kurucu Gerçekleri", "YZ Araçları & Deneyleri", "Türk Startup Ekosistemi"]).slice(0, 3).map((p, i, arr) => (
                      <View key={i} style={[styles.pillarItemNew, i < arr.length - 1 && styles.pillarBorder]}>
                        <View style={[styles.pillarNumNew, { backgroundColor: primaryGhost, borderColor: primaryBorder }]}>
                          <Text style={[styles.pillarNumTextNew, { color: primary }]}>{i + 1}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.pillarNameNew}>{p}</Text>
                          <Text style={styles.pillarDescNew}>{descFor(p) || "Kısa açıklama"}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                  <SectionHeader icon={<SecIconCheck color={primary} />} label="Farklılaşma" c={c} />
                  <View style={[styles.voiceCardNew, { backgroundColor: c.glassFill, borderColor: c.glassBorder }]}>
                    <View style={styles.voiceRow}>
                      <Text style={styles.voiceLbl}>Ton</Text>
                      <View style={styles.vTagRowNew}>
                        <View style={[styles.vTagNew, { backgroundColor: primaryGhost, borderColor: primaryBorder }]}>
                          <Text style={[styles.vTagNewText, { color: primary }]}>Samimi</Text>
                        </View>
                        <View style={[styles.vTagNew, { backgroundColor: primaryGhost, borderColor: primaryBorder }]}>
                          <Text style={[styles.vTagNewText, { color: primary }]}>Analitik</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
                <View style={styles.blurFade} pointerEvents="none" />
              </View>
            )}

            {/* ─────────── Pillars — Pro ─────────── */}
            {profileState !== "free" && (
              <>
                <SectionHeader
                  icon={<SecIconPillars color={primary} />}
                  label="İçerik Sütunları"
                  c={c}
                  right={
                    <TouchableOpacity
                      onPress={() => { if (!canEditPersona) { setLockModal(true); return; } setEditingIdx(-1); setNewPillar(""); setNewDesc(""); }}
                      style={[styles.secEditBtn, { backgroundColor: primaryGhost, borderColor: primaryBorder }]}
                    >
                      <Text style={[styles.secEditBtnText, { color: primary }]}>+ Ekle</Text>
                    </TouchableOpacity>
                  }
                />
                {!canEditPersona && (
                  <View style={styles.lockBanner}>
                    <Text style={styles.lockBannerTitle}>Düzenleme kilitli</Text>
                    <Text style={styles.lockBannerText}>
                      Persona bu ay güncellendi. Pillar'lar persona kilidine bağlıdır
                      {nextEditDate ? ` — sıradaki: ${nextEditDate}` : ""}.
                    </Text>
                  </View>
                )}
                <View style={styles.pillarsCard}>
                  {[0, 1, 2, 3, 4].map((i) => {
                    const p = pillars[i];
                    const desc = p ? descFor(p) : "";
                    const isLast = i === 4;
                    if (p) {
                      return (
                        <View key={i} style={[styles.pillarItemNew, !isLast && styles.pillarBorder]}>
                          <View style={[styles.pillarNumNew, { backgroundColor: c.accentGhost, borderColor: c.mintBorder }]}>
                            <Text style={[styles.pillarNumTextNew, { color: c.accent }]}>{i + 1}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.pillarNameNew}>{p}</Text>
                            <Text style={styles.pillarDescNew}>{desc || "Bu pillar için açıklama ekle"}</Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => { setEditingIdx(i); setNewPillar(p); setNewDesc(desc); }}
                            style={[styles.editBtnNew, { borderColor: c.glassBorder }]}
                            hitSlop={8}
                          >
                            <Text style={[styles.editBtnNewText, { color: c.text4 }]}>✏</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    }
                    return (
                      <View key={i} style={[styles.pillarItemNew, !isLast && styles.pillarBorder]}>
                        <View style={[styles.pillarNumEmpty, { borderColor: c.text4 }]}>
                          <Text style={[styles.pillarNumTextNew, { color: c.text4 }]}>{i + 1}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.pillarNameEmpty, { color: c.text4 }]}>Boş başlık</Text>
                          <Text style={styles.pillarDescNew}>Eklemek için dokun</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => { if (!canEditPersona) { setLockModal(true); return; } setEditingIdx(-1); setNewPillar(""); setNewDesc(""); }}
                          style={[styles.secEditBtn, { backgroundColor: c.accentGhost, borderColor: c.mintBorder }]}
                        >
                          <Text style={[styles.secEditBtnText, { color: c.accent }]}>+ Ekle</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
                {editingIdx !== null && (
                  <View style={styles.pillarEditRow}>
                    <TextInput
                      style={styles.pillarInput}
                      value={newPillar}
                      onChangeText={setNewPillar}
                      placeholder={editingIdx === -1 ? "Yeni pillar başlığı…" : "Pillar başlığı…"}
                      placeholderTextColor={c.text4}
                      editable={canEditPersona}
                    />
                    <TextInput
                      style={[styles.pillarInput, { minHeight: 60, textAlignVertical: "top" }]}
                      value={newDesc}
                      onChangeText={setNewDesc}
                      placeholder="Bu pillar ne hakkında? (kısa açıklama)"
                      placeholderTextColor={c.text4}
                      multiline
                      editable={canEditPersona}
                    />
                    <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
                      <TouchableOpacity
                        onPress={() => { setEditingIdx(null); setNewPillar(""); setNewDesc(""); }}
                        style={styles.pillarCancel}
                      >
                        <Text style={styles.pillarCancelText}>Vazgeç</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={addOrUpdatePillar}
                        style={[styles.pillarAddBtn, { backgroundColor: c.accent }]}
                        disabled={!canEditPersona}
                      >
                        <Text style={styles.pillarAddText}>{editingIdx === -1 ? "Ekle" : "Güncelle"}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </>
            )}

            {/* ─────────── Ses & Ton — Pro ─────────── */}
            {profileState !== "free" && (voice.length > 0 || voiceAvoid.length > 0) && (
              <>
                <SectionHeader
                  icon={<SecIconVoice color={primary} />}
                  label={`Ses & Ton${toneStyle ? ` · ${toneStyle}` : ""}`}
                  c={c}
                  right={
                    <TouchableOpacity onPress={startEditPos} style={[styles.secEditBtn, { backgroundColor: primaryGhost, borderColor: primaryBorder }]}>
                      <Text style={[styles.secEditBtnText, { color: primary }]}>Düzenle</Text>
                    </TouchableOpacity>
                  }
                />
                <View style={[styles.voiceCardNew, { backgroundColor: c.glassFill, borderColor: c.glassBorder }]}>
                  {voice.length > 0 && (
                    <View style={styles.voiceRow}>
                      <Text style={styles.voiceLbl}>Ton</Text>
                      <View style={styles.vTagRowNew}>
                        {voice.map((v, i) => (
                          <View key={v + i} style={[styles.vTagNew, { backgroundColor: c.accentGhost, borderColor: c.mintBorder }]}>
                            <Text style={[styles.vTagNewText, { color: c.accentText }]}>{v}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                  {voiceAvoid.length > 0 && (
                    <>
                      {voice.length > 0 && <View style={[styles.voiceDivider, { backgroundColor: c.glassBorder }]} />}
                      <View style={styles.voiceRow}>
                        <Text style={styles.voiceLbl}>Kaçın</Text>
                        <View style={styles.vTagRowNew}>
                          {voiceAvoid.map((v, i) => (
                            <View key={v + i} style={[styles.vTagRed]}>
                              <Text style={styles.vTagRedText}>{v}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    </>
                  )}
                </View>
              </>
            )}

            {/* ─────────── Farklılaşma — Pro ─────────── */}
            {profileState !== "free" && (diffDo.length > 0 || diffDont.length > 0) && (
              <>
                <SectionHeader icon={<SecIconCheck color={primary} />} label="Farklılaşma" c={c} />
                <View style={[styles.diffCard, { backgroundColor: c.glassFill, borderColor: c.glassBorder }]}>
                  <View style={styles.diffCol}>
                    <View style={[styles.doTag, { backgroundColor: c.accentGhost, borderColor: c.mintBorder }]}>
                      <Text style={[styles.doTagText, { color: c.accent }]}>✓ Yap</Text>
                    </View>
                    {diffDo.map((d, i) => (
                      <Text key={i} style={styles.diffItemNew}>{d}</Text>
                    ))}
                  </View>
                  <View style={[styles.diffDivider, { backgroundColor: c.glassBorder }]} />
                  <View style={styles.diffCol}>
                    <View style={styles.dontTag}>
                      <Text style={styles.dontTagText}>✕ Kaçın</Text>
                    </View>
                    {diffDont.map((d, i) => (
                      <Text key={i} style={styles.diffItemRed}>{d}</Text>
                    ))}
                  </View>
                </View>
              </>
            )}

            {/* ─────────── Örnek Post — Pro ─────────── */}
            {profileState !== "free" && !!samplePost && (
              <>
                <SectionHeader icon={<SecIconPost color={primary} />} label="Örnek Post" c={c} />
                <View style={[styles.samplePostCard, { backgroundColor: c.glassFill, borderColor: c.glassBorder }]}>
                  <View style={styles.samplePostHeader}>
                    <View style={[styles.sampleAvatar, { backgroundColor: c.accent }]}>
                      <Text style={styles.sampleAvatarText}>{initial}</Text>
                    </View>
                    <View>
                      <Text style={styles.sampleName}>{name || "Sen"}</Text>
                      <Text style={styles.sampleMeta}>LinkedIn · örnek</Text>
                    </View>
                    <View style={{ marginLeft: "auto" }}>
                      <View style={styles.inBadge}><Text style={styles.inBadgeText}>in</Text></View>
                    </View>
                  </View>
                  <Text style={styles.sampleBody}>{samplePost}</Text>
                </View>
              </>
            )}

            {/* ─────────── Hedef Kitle — Pro ─────────── */}
            {profileState !== "free" && !!audience && (
              <>
                <SectionHeader icon={<SecIconAudience color={primary} />} label="Hedef Kitle" c={c} />
                <View style={[styles.audienceCard, { backgroundColor: c.glassFill, borderColor: c.glassBorder }]}>
                  {audience.split(/\n|,|·/).map((s) => s.trim()).filter(Boolean).slice(0, 4).map((line, i) => (
                    <View key={i} style={styles.audienceItem}>
                      <View style={[styles.audienceDot, { backgroundColor: c.accent }]} />
                      <Text style={styles.audienceTxt}>{line}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* ─────────── Değerler — Pro ─────────── */}
            {profileState !== "free" && values.length > 0 && (
              <>
                <SectionHeader icon={<SecIconValues color={primary} />} label="Değerler" c={c} />
                <View style={styles.valuesRow}>
                  {values.map((v, i) => (
                    <View key={v + i} style={[styles.valueTag, { backgroundColor: c.accentGhost, borderColor: c.mintBorder }]}>
                      <Text style={[styles.valueTagText, { color: c.accentText }]}>{v}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* ─────────── Platformlar — Pro ─────────── */}
            {profileState !== "free" && platforms.length > 0 && (
              <>
                <SectionHeader icon={<SecIconPlatforms color={primary} />} label="Platformlar" c={c} />
                <View style={[styles.platformsCard, { backgroundColor: c.glassFill, borderColor: c.glassBorder }]}>
                  {platforms.map((p, i, arr) => {
                    const isFirst = i === 0;
                    const info = platformInfo(p);
                    return (
                      <View key={p + i} style={[styles.platformRowNew, i < arr.length - 1 && styles.pillarBorder]}>
                        <View style={[styles.platformIconNew, info.bg, info.border]}>
                          <Text style={[styles.platformIconText, info.color]}>{info.short}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.platformNameNew}>{info.name}</Text>
                        </View>
                        <View style={[isFirst ? styles.platformPrimary : styles.platformSecondary, {
                          backgroundColor: isFirst ? c.accentGhost : c.glassFill,
                          borderColor: isFirst ? c.mintBorder : c.glassBorder,
                        }]}>
                          <Text style={[isFirst ? { color: c.accent } : { color: c.text4 }, styles.platformBadgeText]}>
                            {isFirst ? "Birincil" : "İkincil"}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                  {cadence ? (
                    <View style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
                      <Text style={styles.cadenceHint}>📅 {cadence}</Text>
                    </View>
                  ) : null}
                </View>
              </>
            )}

            {/* ─────────── Kullanım — Pro ─────────── */}
            {profileState !== "free" && (
              <>
                <SectionHeader icon={<SecIconUsage color={primary} />} label="Kullanım" c={c} />
                <View style={[styles.usageCardNew, { backgroundColor: c.glassFill, borderColor: c.glassBorder }]}>
                  <View style={styles.usageRowNew}>
                    <Text style={styles.usageLblNew}>Bu ay</Text>
                    <Text style={styles.usageValNew}>
                      {usage ? `${usage.monthly.current} / ${usage.monthly.limit === Infinity ? "∞" : usage.monthly.limit}` : "—"}
                    </Text>
                  </View>
                  <View style={[styles.usageBarWrapNew, { backgroundColor: c.glassBorder }]}>
                    <View style={[styles.usageBarFillNew, { width: "100%", backgroundColor: c.accent }]} />
                  </View>
                  <Text style={[styles.usagePlan, { color: c.accentText }]}>Pro Plan · Aktif</Text>
                </View>
              </>
            )}
          </>
        )}

        {/* ─────────── Ücretsiz: promo + davet + Pro CTA ─────────── */}
        {profileState === "free" && persona !== undefined && !editingPos && (
          <>
            <Text style={styles.stratLb}>PROMO KODU</Text>
            <View style={styles.promoRow}>
              <TextInput
                style={styles.promoInput}
                value={promo}
                onChangeText={(v) => setPromo(v.toUpperCase())}
                placeholder="KOD"
                placeholderTextColor={c.text4}
                autoCapitalize="characters"
                autoCorrect={false}
                onSubmitEditing={redeemPromo}
                returnKeyType="go"
              />
              <TouchableOpacity
                style={[styles.promoBtn, { backgroundColor: primary }, promoLoading && { opacity: 0.5 }]}
                onPress={redeemPromo}
                disabled={promoLoading}
              >
                <Text style={styles.promoBtnText}>{promoLoading ? "…" : "Kullan"}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ─────────── Davet et — hep göster ─────────── */}
        {persona !== undefined && !editingPos && (
          <>
            <Text style={styles.stratLb}>DAVET ET & KAZAN</Text>
            <Text style={styles.refInfo}>
              Davet ettiğin kişi aylık üye olursa +1 ay, yıllık olursa +3 ay Pro hediye kazanırsın.
            </Text>
            {ref && (
              <>
                <View style={[styles.refCodeRow, { backgroundColor: c.accentGhost, borderColor: c.mintBorder }]}>
                  <Text style={[styles.refCode, { color: c.accent }]}>{ref.code}</Text>
                  <Text style={styles.refStat}>{ref.referrals} davet · +{ref.earnedMonths} ay</Text>
                </View>
                {!ref.appliedCode && (
                  <View style={styles.promoRow}>
                    <TextInput
                      style={styles.promoInput}
                      value={refInput}
                      onChangeText={(v) => setRefInput(v.toUpperCase())}
                      placeholder="Davet eden kodu"
                      placeholderTextColor={c.text4}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      onSubmitEditing={applyRef}
                      returnKeyType="go"
                    />
                    <TouchableOpacity style={[styles.promoBtn, { backgroundColor: c.accent }]} onPress={applyRef}>
                      <Text style={styles.promoBtnText}>Uygula</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </>
        )}

        {/* ─────────── Ayarlar + Logout ─────────── */}
        {!editingPos && (
          <>
            <Text style={styles.stratLb}>AYARLAR</Text>
            <View style={styles.settingsCard}>
              <View style={styles.settingsRow}>
                <Text style={styles.settingsLabel}>Tema</Text>
                <ThemeToggle />
              </View>
              <View style={[styles.settingsRow, styles.settingsRowBorder]}>
                <Text style={styles.settingsLabel}>{t.language}</Text>
                <View style={styles.langSeg}>
                  <TouchableOpacity
                    style={[styles.langItem, lang === "tr" && { backgroundColor: c.accent }]}
                    activeOpacity={0.8}
                    onPress={() => setLang("tr")}
                  >
                    <Text style={[styles.langText, lang === "tr" && styles.langTextOn]}>{t.langTurkish}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.langItem, lang === "en" && { backgroundColor: c.accent }]}
                    activeOpacity={0.8}
                    onPress={() => setLang("en")}
                  >
                    <Text style={[styles.langText, lang === "en" && styles.langTextOn]}>{t.langEnglish}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            <TouchableOpacity style={styles.logout} activeOpacity={0.8} onPress={handleLogout}>
              <Text style={styles.logoutText}>Çıkış yap</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
      </KeyboardAvoidingView>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.savedToast,
          { backgroundColor: c.accent, opacity: savedAnim, transform: [{ translateY: savedAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }] },
        ]}
      >
        <Text style={styles.savedToastText}>✓ Persona kaydedildi</Text>
      </Animated.View>
      <PaywallModal visible={paywall} onClose={() => setPaywall(false)} />

      {/* Persona once-a-month lock */}
      <Modal visible={lockModal} transparent animationType="fade" onRequestClose={() => setLockModal(false)}>
        <View style={styles.lockOverlay}>
          <View style={styles.lockModalCard}>
            <View style={styles.lockIcon}><Text style={styles.lockIconText}>🗓️</Text></View>
            <Text style={styles.lockModalTitle}>Persona ayda bir kez değişir</Text>
            <Text style={styles.lockBody}>
              Persona'nı {daysSince === Infinity ? "yakın zamanda" : `${daysSince} gün önce`} güncelledin.
              Kişisel stratejinin tutarlı kalması ve modelin senin sesini doğru öğrenebilmesi için sık değişiklik önermiyoruz.
            </Text>
            {nextEditDate ? <Text style={styles.lockNext}>Tekrar düzenleme: {nextEditDate}</Text> : null}
            <TouchableOpacity style={styles.lockBtn} activeOpacity={0.85} onPress={() => setLockModal(false)}>
              <Text style={styles.lockBtnText}>Anladım</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

/* ─────────── Editor (Düzenle görünümü) ─────────── */
function renderEditor(
  styles: ReturnType<typeof makeStyles>,
  c: Palette,
  primary: string,
  primaryGhost: string,
  primaryBorder: string,
  props: {
    nameDraft: string; setNameDraft: (v: string) => void;
    posDraft: string; setPosDraft: (v: string) => void;
    voiceDraft: string; setVoiceDraft: (v: string) => void;
    audienceDraft: string; setAudienceDraft: (v: string) => void;
    fieldDraft: string; setFieldDraft: (v: string) => void;
    goalDraft: string; setGoalDraft: (v: string) => void;
    linkedinDraft: string; setLinkedinDraft: (v: string) => void;
    helperDraft: string; setHelperDraft: (v: string) => void;
    savingPos: boolean; regenLoading: boolean;
    savePos: () => void; regeneratePersona: () => void; cancel: () => void;
  },
) {
  return (
    <View style={styles.posEditCard}>
      <Text style={styles.fieldLb}>İsim</Text>
      <TextInput style={styles.fieldInput} value={props.nameDraft} onChangeText={props.setNameDraft} placeholder="Görünen ismin" placeholderTextColor={c.text4} />

      <Text style={styles.fieldLb}>Konumlandırma</Text>
      <TextInput style={[styles.fieldInput, styles.fieldArea]} value={props.posDraft} onChangeText={props.setPosDraft} multiline placeholder="Tek cümlede seni en iyi anlatan konumlandırma…" placeholderTextColor={c.text4} textAlignVertical="top" />

      <Text style={styles.fieldLb}>Ses profili (virgülle ayır)</Text>
      <TextInput style={styles.fieldInput} value={props.voiceDraft} onChangeText={props.setVoiceDraft} placeholder="net, samimi, iddialı…" placeholderTextColor={c.text4} />

      <Text style={styles.fieldLb}>Hedef kitle</Text>
      <TextInput style={styles.fieldInput} value={props.audienceDraft} onChangeText={props.setAudienceDraft} placeholder="Kimin için yazıyorsun?" placeholderTextColor={c.text4} />

      <Text style={styles.fieldLb}>Alan / sektör</Text>
      <TextInput style={styles.fieldInput} value={props.fieldDraft} onChangeText={props.setFieldDraft} placeholder="örn. B2B SaaS, pazarlama…" placeholderTextColor={c.text4} />

      <Text style={styles.fieldLb}>Hedef</Text>
      <TextInput style={styles.fieldInput} value={props.goalDraft} onChangeText={props.setGoalDraft} placeholder="İçerikle ne başarmak istiyorsun?" placeholderTextColor={c.text4} />

      <Text style={styles.fieldLb}>LinkedIn profil linki</Text>
      <TextInput style={styles.fieldInput} value={props.linkedinDraft} onChangeText={props.setLinkedinDraft} placeholder="https://linkedin.com/in/…" placeholderTextColor={c.text4} autoCapitalize="none" autoCorrect={false} keyboardType="url" />

      <Text style={styles.fieldLb}>Yardımcı linkler / makaleler / notlar</Text>
      <TextInput style={[styles.fieldInput, styles.fieldArea]} value={props.helperDraft} onChangeText={props.setHelperDraft} multiline placeholder="Seni daha iyi tanımamız için yazıların, makalelerin veya bağlantıların… (AI yeniden üretiminde kullanılır)" placeholderTextColor={c.text4} textAlignVertical="top" autoCapitalize="none" />

      {/* Kaydet butonu kaldırıldı — kullanıcının önerisi. Manuel kayıt ile AI
          üretiminin ayrımı belirsizdi; kullanıcılar Kaydet'i "draft" sanıp basıyor,
          boş alanlarla persona kilitleniyordu. Şimdi tek yol: AI ile yeniden üret. */}
      <TouchableOpacity
        style={[
          styles.regenBtn,
          { borderColor: primary, backgroundColor: primary },
          props.regenLoading && { opacity: 0.5 },
        ]}
        onPress={props.regeneratePersona}
        disabled={props.regenLoading}
      >
        {props.regenLoading
          ? <ActivityIndicator color="#fff" />
          : <Text style={[styles.regenText, { color: "#fff" }]}>✨ AI ile Yeniden Üret</Text>}
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.posCancel, { marginTop: 8, alignSelf: "stretch", alignItems: "center", paddingVertical: 12 }]}
        onPress={props.cancel}
        disabled={props.regenLoading}
      >
        <Text style={styles.posCancelText}>İptal</Text>
      </TouchableOpacity>
      <Text style={styles.ruleHint}>
        ⓘ Değişiklikten sonra strateji 1 ay boyunca kilitlenir. Marka dilinin tutarlı kalması ve modelin
        senin sesini doğru öğrenebilmesi için sık değişiklik önermiyoruz — bir sonraki güncelleme 1 ay
        sonra yapılabilir.
      </Text>
    </View>
  );
}

/* ─────────── Platform info helper ─────────── */
function platformInfo(p: string): { name: string; short: string; bg: any; border: any; color: any } {
  const norm = p.toLowerCase();
  if (norm.includes("linkedin")) return { name: "LinkedIn", short: "in", bg: { backgroundColor: "rgba(10,102,194,0.12)" }, border: { borderColor: "rgba(10,102,194,0.2)" }, color: { color: "#4891d9" } };
  if (norm.includes("twitter") || norm.startsWith("x")) return { name: "X / Twitter", short: "𝕏", bg: { backgroundColor: "rgba(0,0,0,0.06)" }, border: { borderColor: "rgba(0,0,0,0.15)" }, color: { color: "#333" } };
  if (norm.includes("substack")) return { name: "Substack", short: "@", bg: { backgroundColor: "rgba(255,130,0,0.08)" }, border: { borderColor: "rgba(255,130,0,0.18)" }, color: { color: "#ff8200" } };
  if (norm.includes("medium")) return { name: "Medium", short: "M", bg: { backgroundColor: "rgba(0,0,0,0.06)" }, border: { borderColor: "rgba(0,0,0,0.15)" }, color: { color: "#111" } };
  return { name: p, short: p.charAt(0).toUpperCase(), bg: { backgroundColor: "rgba(0,0,0,0.06)" }, border: { borderColor: "rgba(0,0,0,0.15)" }, color: { color: "#555" } };
}

/* ─────────── Section header styles ─────────── */
function sectionHeaderStyles(c: Palette) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 20,
      marginBottom: 8,
    },
    left: { flexDirection: "row", alignItems: "center", gap: 8 },
    iconWrap: {
      width: 22,
      height: 22,
      borderRadius: 7,
      backgroundColor: c.accentGhost,
      borderWidth: 1,
      borderColor: c.mintBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    label: {
      fontSize: 10,
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: c.accent,
      fontWeight: "700",
    },
  });
}

/* ─────────── Main styles ─────────── */
function makeStyles(c: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.page },
    content: { paddingHorizontal: spacing.md, paddingTop: 56, paddingBottom: 130 },

    /* Header */
    top: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
    avatar: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    avatarText: { fontSize: 16, fontWeight: "700", color: "#fff" },
    info: { flex: 1 },
    name: { fontSize: 16, fontWeight: "700", color: c.text1, letterSpacing: -0.3 },
    role: { fontSize: 12, color: c.text3, marginTop: 2 },
    editProfileBtn: {
      paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
      backgroundColor: c.glassFill, borderWidth: 1, borderColor: c.glassBorder,
    },
    editProfileBtnText: { fontSize: 12, fontWeight: "600", color: c.text2 },

    loading: { paddingVertical: 40, alignItems: "center" },

    /* Lock card (Ücretsiz) */
    lockCard: {
      padding: 20, borderRadius: 18, borderWidth: 1, alignItems: "center", marginTop: 4, marginBottom: 6,
    },
    lockIconWrap: {
      width: 44, height: 44, borderRadius: 14, borderWidth: 1,
      alignItems: "center", justifyContent: "center", marginBottom: 12,
    },
    lockTitleNew: { fontSize: 17, fontWeight: "700", color: c.text1, letterSpacing: -0.3, marginBottom: 6 },
    lockSub: { fontSize: 12.5, color: c.text3, lineHeight: 18, marginBottom: 14, textAlign: "center", paddingHorizontal: 8 },
    lockBtnPrimary: {
      paddingHorizontal: 26, paddingVertical: 12, borderRadius: 12,
      shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
    },
    lockBtnPrimaryText: { fontSize: 14, fontWeight: "700", color: "#fff", letterSpacing: -0.2 },

    /* Blur teaser (Ücretsiz) */
    blurWrap: { position: "relative", marginTop: 8 },
    blurInner: { opacity: 0.6 },
    blurFade: {
      position: "absolute", left: 0, right: 0, bottom: 0, top: "40%",
      backgroundColor: "transparent",
    },

    /* Progress card (Pro·Eksik) */
    progCard: { padding: 14, borderRadius: 14, borderWidth: 1, marginTop: 4, marginBottom: 8 },
    progTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 },
    progTitle: { fontSize: 14, fontWeight: "700", color: c.text1, letterSpacing: -0.25 },
    progPct: { fontSize: 11, fontWeight: "600" },
    progBarWrap: { height: 5, borderRadius: 3, backgroundColor: c.glassBorder, overflow: "hidden", marginBottom: 8 },
    progBarFill: { height: "100%", borderRadius: 3 },
    progSub: { fontSize: 11, color: c.text3, lineHeight: 15 },

    /* Checklist */
    chkCard: { borderRadius: 14, backgroundColor: c.glassFill, borderWidth: 1, borderColor: c.glassBorder, overflow: "hidden", marginBottom: 4 },
    chkRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
    chkRowBorder: { borderBottomWidth: 1, borderBottomColor: c.glassBorder },
    chkIconDone: { width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
    chkIconTodo: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderStyle: "dashed" },
    chkTxtDone: { flex: 1, fontSize: 13, fontWeight: "500", color: c.text2 },
    chkTxt: { flex: 1, fontSize: 13, fontWeight: "600", color: c.text1 },
    chkAddBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100 },
    chkAddBtnText: { fontSize: 11, fontWeight: "700", color: "#fff" },

    /* CTA (Pro·Tam) */
    ctaCard: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, marginTop: 4, marginBottom: 4 },
    ctaTitle: { fontSize: 14, fontWeight: "700", color: c.text1, letterSpacing: -0.25 },
    ctaSub: { fontSize: 11, color: c.text3, marginTop: 2 },
    ctaBtn: {
      paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
      shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 3,
    },
    ctaBtnText: { fontSize: 13, fontWeight: "700", color: "#fff", letterSpacing: -0.2 },

    /* Positioning */
    posCardNew: { padding: 14, borderRadius: 14, borderWidth: 1 },
    posTxNew: { fontSize: 14, fontWeight: "600", color: c.text1, lineHeight: 20, letterSpacing: -0.2 },
    purposeTx: { fontSize: 12.5, color: c.text3, lineHeight: 18, marginTop: 8 },

    /* Section edit button */
    secEditBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
    secEditBtnText: { fontSize: 11, fontWeight: "600" },

    /* Pillars */
    pillarsCard: { borderRadius: 14, backgroundColor: c.glassFill, borderWidth: 1, borderColor: c.glassBorder, overflow: "hidden" },
    pillarItemNew: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
    pillarBorder: { borderBottomWidth: 1, borderBottomColor: c.glassBorder },
    pillarNumNew: { width: 22, height: 22, borderRadius: 7, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    pillarNumEmpty: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
    pillarNumTextNew: { fontSize: 10, fontWeight: "700" },
    pillarNameNew: { fontSize: 13, fontWeight: "600", color: c.text1 },
    pillarNameEmpty: { fontSize: 13, fontWeight: "600" },
    pillarDescNew: { fontSize: 11, color: c.text4, marginTop: 2, lineHeight: 15 },
    editBtnNew: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
    editBtnNewText: { fontSize: 11 },

    pillarEditRow: {
      marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: c.glassFill,
      borderWidth: 1, borderColor: c.glassBorder, gap: 8,
    },
    pillarInput: {
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
      borderRadius: radii.btn, paddingHorizontal: 12, paddingVertical: 10,
      fontSize: 14, color: c.text1,
    },
    pillarCancel: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: c.glassBorder },
    pillarCancelText: { fontSize: 12, fontWeight: "600", color: c.text2 },
    pillarAddBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
    pillarAddText: { fontSize: 12, fontWeight: "700", color: "#fff" },

    /* Voice */
    voiceCardNew: { padding: 12, borderRadius: 13, borderWidth: 1 },
    voiceRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    voiceLbl: { fontSize: 11, color: c.text4, fontWeight: "600", width: 40 },
    voiceDivider: { height: 1, marginVertical: 8 },
    vTagRowNew: { flexDirection: "row", flexWrap: "wrap", gap: 5, flex: 1 },
    vTagNew: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, borderWidth: 1 },
    vTagNewText: { fontSize: 11, fontWeight: "500" },
    vTagRed: {
      paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100,
      backgroundColor: "rgba(220,38,38,0.06)", borderWidth: 1, borderColor: "rgba(220,38,38,0.18)",
    },
    vTagRedText: { fontSize: 11, fontWeight: "500", color: "#dc2626" },

    /* Differentiation */
    diffCard: { flexDirection: "row", borderRadius: 13, borderWidth: 1, overflow: "hidden" },
    diffCol: { flex: 1, padding: 12, gap: 6 },
    diffDivider: { width: 1 },
    doTag: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, borderWidth: 1, marginBottom: 4 },
    doTagText: { fontSize: 10, fontWeight: "700" },
    dontTag: {
      alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100,
      backgroundColor: "rgba(220,38,38,0.06)", borderWidth: 1, borderColor: "rgba(220,38,38,0.18)", marginBottom: 4,
    },
    dontTagText: { fontSize: 10, fontWeight: "700", color: "#dc2626" },
    diffItemNew: { fontSize: 12, color: c.text2, lineHeight: 17 },
    diffItemRed: { fontSize: 12, color: "rgba(185,28,28,0.7)", lineHeight: 17 },

    /* Sample Post */
    samplePostCard: { padding: 12, borderRadius: 13, borderWidth: 1 },
    samplePostHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
    sampleAvatar: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center" },
    sampleAvatarText: { fontSize: 12, fontWeight: "700", color: "#fff" },
    sampleName: { fontSize: 12, fontWeight: "600", color: c.text1 },
    sampleMeta: { fontSize: 10, color: c.text4, marginTop: 1 },
    inBadge: {
      paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
      backgroundColor: "rgba(10,102,194,0.12)", borderWidth: 1, borderColor: "rgba(10,102,194,0.22)",
    },
    inBadgeText: { fontSize: 10, fontWeight: "700", color: "#4891d9" },
    sampleBody: { fontSize: 12, color: c.text2, lineHeight: 19 },

    /* Audience */
    audienceCard: { padding: 12, borderRadius: 13, borderWidth: 1, gap: 8 },
    audienceItem: { flexDirection: "row", alignItems: "center", gap: 8 },
    audienceDot: { width: 5, height: 5, borderRadius: 3 },
    audienceTxt: { fontSize: 13, color: c.text2, flex: 1 },

    /* Values */
    valuesRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    valueTag: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100, borderWidth: 1 },
    valueTagText: { fontSize: 12, fontWeight: "500" },

    /* Platforms */
    platformsCard: { borderRadius: 13, borderWidth: 1, overflow: "hidden" },
    platformRowNew: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 11 },
    platformIconNew: { width: 26, height: 26, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    platformIconText: { fontSize: 11, fontWeight: "700" },
    platformNameNew: { fontSize: 13, fontWeight: "600", color: c.text1 },
    platformPrimary: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 100, borderWidth: 1 },
    platformSecondary: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 100, borderWidth: 1 },
    platformBadgeText: { fontSize: 10, fontWeight: "700" },
    cadenceHint: { fontSize: 11, color: c.text3 },

    /* Usage (Pro) */
    usageCardNew: { padding: 12, borderRadius: 13, borderWidth: 1 },
    usageRowNew: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
    usageLblNew: { fontSize: 12, color: c.text3 },
    usageValNew: { fontSize: 13, fontWeight: "600", color: c.text1 },
    usageBarWrapNew: { height: 5, borderRadius: 3, overflow: "hidden", marginBottom: 8 },
    usageBarFillNew: { height: "100%", borderRadius: 3 },
    usagePlan: { fontSize: 11, fontWeight: "600" },

    /* Lock banner (persona kilit) */
    lockBanner: {
      padding: 12, borderRadius: 12, backgroundColor: c.amberGhost,
      borderWidth: 1, borderColor: c.amberBorder, marginBottom: 8,
    },
    lockBannerTitle: { fontSize: 12, fontWeight: "700", color: c.amber, marginBottom: 4 },
    lockBannerText: { fontSize: 12, color: c.text2, lineHeight: 17 },

    /* Editor */
    posEditCard: {
      borderRadius: radii.card, backgroundColor: c.glassFill,
      borderWidth: 1, borderColor: c.mintBorder, padding: 14, marginTop: 8,
    },
    fieldLb: { fontSize: 11, letterSpacing: 0.4, fontWeight: "600", color: c.text4, textTransform: "uppercase", marginTop: 12, marginBottom: 6 },
    fieldInput: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radii.btn, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: c.text1 },
    fieldArea: { minHeight: 70, textAlignVertical: "top" },
    regenBtn: { marginTop: 12, paddingVertical: 12, borderRadius: radii.btn, borderWidth: 1, alignItems: "center" },
    regenText: { fontSize: 13, fontWeight: "700" },
    posEditActions: { flexDirection: "row", gap: 8, marginTop: 10, justifyContent: "flex-end" },
    posCancel: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: radii.btn, borderWidth: 1, borderColor: c.glassBorder },
    posCancelText: { fontSize: 13, fontWeight: "600", color: c.text2 },
    posSave: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: radii.btn },
    posSaveText: { fontSize: 13, fontWeight: "700", color: "#fff" },
    ruleHint: { fontSize: 11, color: c.text4, marginTop: 6 },

    /* Common labels */
    stratLb: { fontSize: 10, letterSpacing: 0.8, color: c.text4, fontWeight: "600", marginBottom: 10, marginTop: 20 },

    /* Promo + Referral */
    promoRow: { flexDirection: "row", gap: 8, marginTop: 8 },
    promoInput: { flex: 1, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radii.btn, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, letterSpacing: 1, color: c.text1 },
    promoBtn: { paddingHorizontal: 18, borderRadius: radii.btn, alignItems: "center", justifyContent: "center" },
    promoBtnText: { fontSize: 14, fontWeight: "600", color: "#fff" },
    refInfo: { fontSize: 13, color: c.text3, lineHeight: 19, marginTop: 4 },
    refCodeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10, padding: 14, borderRadius: radii.card, borderWidth: 1 },
    refCode: { fontSize: 18, fontWeight: "700", letterSpacing: 3 },
    refStat: { fontSize: 12, color: c.text2 },

    /* Settings + Logout */
    settingsCard: { borderRadius: radii.card, backgroundColor: c.glassFill, borderWidth: 1, borderColor: c.glassBorder, paddingHorizontal: 14, marginTop: 8 },
    settingsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 },
    settingsRowBorder: { borderTopWidth: 1, borderTopColor: c.glassBorder },
    settingsLabel: { fontSize: 14, color: c.text1 },
    langSeg: { flexDirection: "row", backgroundColor: c.glassFill, borderWidth: 1, borderColor: c.glassBorder, borderRadius: radii.pill, padding: 3 },
    langItem: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radii.pill },
    langText: { fontSize: 12.5, fontWeight: "600", color: c.text3 },
    langTextOn: { color: "#fff" },
    logout: { marginTop: 12, paddingVertical: 14, borderRadius: radii.btn, borderWidth: 1, borderColor: c.glassBorder, alignItems: "center" },
    logoutText: { fontSize: 15, fontWeight: "600", color: c.error },

    /* Saved toast + Lock modal */
    savedToast: { position: "absolute", top: 64, alignSelf: "center", paddingHorizontal: 16, paddingVertical: 9, borderRadius: radii.pill, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
    savedToastText: { fontSize: 13, fontWeight: "700", color: "#fff" },

    lockOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 28 },
    lockModalCard: { width: "100%", maxWidth: 360, borderRadius: radii.card, backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder, padding: 22, alignItems: "center" },
    lockIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: c.amberGhost, borderWidth: 1, borderColor: c.amberBorder, alignItems: "center", justifyContent: "center", marginBottom: 14 },
    lockIconText: { fontSize: 24 },
    lockModalTitle: { fontSize: 17, fontWeight: "700", color: c.text1, textAlign: "center", marginBottom: 8 },
    lockBody: { fontSize: 13.5, color: c.text3, lineHeight: 20, textAlign: "center" },
    lockNext: { fontSize: 12.5, fontWeight: "600", color: c.accent, marginTop: 12 },
    lockBtn: { marginTop: 18, alignSelf: "stretch", paddingVertical: 13, borderRadius: radii.btn, backgroundColor: c.accent, alignItems: "center" },
    lockBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  });
}
