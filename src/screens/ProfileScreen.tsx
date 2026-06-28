import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Animated, Easing, Modal, StyleSheet } from "react-native";
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

interface Props {
  onLogout: () => void;
}

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

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (u) setName(u.user_metadata?.display_name ?? u.email?.split("@")[0] ?? "");
    });
    getPersona()
      .then((p) => { setPersona(p); setPillars((p?.profile?.pillars ?? []).map((x) => x.title).filter(Boolean)); })
      .catch(() => setPersona(null));
    authedFetch("/api/usage").then((r) => r.json()).then((d) => { if (d?.monthly) setUsage(d); }).catch(() => {});
  }, []);

  const profile = persona?.profile ?? null;
  const positioning = profile?.positioning_statement;
  const voice = profile?.voice_profile ?? [];
  // Full strategy fields (read view)
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
  const toneVoice = profile?.tone?.voice;

  // Once-a-month persona change rule.
  const lastChanged = profile?.persona_changed_at ? new Date(profile.persona_changed_at).getTime() : 0;
  const daysSince = lastChanged ? Math.floor((Date.now() - lastChanged) / DAY) : Infinity;
  const canEditPersona = daysSince >= 30;
  const nextEditDate = lastChanged ? new Date(lastChanged + 30 * DAY).toLocaleDateString("tr-TR", { day: "2-digit", month: "long" }) : null;

  const flashSaved = () => {
    savedAnim.setValue(0);
    Animated.sequence([
      Animated.timing(savedAnim, { toValue: 1, duration: 220, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.delay(1100),
      Animated.timing(savedAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
  };

  const startEditPos = () => {
    if (!canEditPersona) {
      setLockModal(true);
      return;
    }
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
      try { await supabase.auth.updateUser({ data: { display_name: nameDraft.trim() } }); setName(nameDraft.trim()); } catch { /* ignore */ }
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
      const patch = {
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
      "AI ile yeniden üret?",
      "Girdiğin bilgilerle persona yeniden oluşturulup kaydedilecek ve bir ay boyunca kilitlenecek. Devam edilsin mi?",
      { confirmLabel: "Yeniden üret", cancelLabel: "Vazgeç", destructive: false },
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
      setEditingPos(false);
      flashSaved();
    } catch (e: any) {
      alertMsg("AI", e?.message ?? "Persona üretilemedi.");
    } finally {
      setRegenLoading(false);
    }
  };

  const persistPillars = async (next: string[]) => {
    setPillars(next);
    try { await savePillars(next.map((title) => ({ title }))); }
    catch { alertMsg("Kaydetme", "Pillar kaydedilemedi (persona tablosu gerekebilir)."); }
  };
  const addOrUpdatePillar = () => {
    const v = newPillar.trim();
    if (!v) { setEditingIdx(null); setNewPillar(""); return; }
    let next: string[];
    if (editingIdx != null) next = pillars.map((p, i) => (i === editingIdx ? v : p));
    else next = pillars.includes(v) ? pillars : [...pillars, v];
    persistPillars(next);
    setNewPillar("");
    setEditingIdx(null);
  };
  const removePillar = (i: number) => persistPillars(pillars.filter((_, idx) => idx !== i));

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
      if (!res.ok) {
        alertMsg("Promo", data.error || "Kod kullanılamadı.");
      } else {
        alertMsg("Tebrikler 🎉", `${data.duration_days} günlük Pro üyelik tanımlandı!`);
        setPromo("");
        getPersona().then(setPersona).catch(() => {});
      }
    } catch {
      alertMsg("Promo", "Bağlantı hatası.");
    } finally {
      setPromoLoading(false);
    }
  };
  const role = profile?.demographics
    ? [profile.demographics.industry, profile.demographics.role].filter(Boolean).join(" · ")
    : persona?.description || "";
  const initial = (name || "?").charAt(0).toUpperCase();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onLogout();
  };

  return (
    <>
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.top}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initial}</Text></View>
        <View style={styles.info}>
          <Text style={styles.name}>{name || "Profilim"}</Text>
          {!!role && <Text style={styles.role}>{role}</Text>}
        </View>
        <ThemeToggle />
      </View>

      {persona === undefined ? (
        <View style={styles.loading}><ActivityIndicator color={c.accent} /></View>
      ) : (
        <>
          <View style={styles.lbRow}>
            <Text style={styles.stratLb}>PERSONA & STRATEJİ</Text>
            {!editingPos && (
              <TouchableOpacity onPress={startEditPos} hitSlop={8}>
                <Text style={styles.editLink}>Düzenle</Text>
              </TouchableOpacity>
            )}
          </View>

          {editingPos ? (
            <View style={styles.posEditCard}>
              <Text style={styles.fieldLb}>İsim</Text>
              <TextInput style={styles.fieldInput} value={nameDraft} onChangeText={setNameDraft} placeholder="Görünen ismin" placeholderTextColor={c.text4} />

              <Text style={styles.fieldLb}>Konumlandırma</Text>
              <TextInput style={[styles.fieldInput, styles.fieldArea]} value={posDraft} onChangeText={setPosDraft} multiline placeholder="Tek cümlede seni en iyi anlatan konumlandırma…" placeholderTextColor={c.text4} textAlignVertical="top" />

              <Text style={styles.fieldLb}>Ses profili (virgülle ayır)</Text>
              <TextInput style={styles.fieldInput} value={voiceDraft} onChangeText={setVoiceDraft} placeholder="net, samimi, iddialı…" placeholderTextColor={c.text4} />

              <Text style={styles.fieldLb}>Hedef kitle</Text>
              <TextInput style={styles.fieldInput} value={audienceDraft} onChangeText={setAudienceDraft} placeholder="Kimin için yazıyorsun?" placeholderTextColor={c.text4} />

              <Text style={styles.fieldLb}>Alan / sektör</Text>
              <TextInput style={styles.fieldInput} value={fieldDraft} onChangeText={setFieldDraft} placeholder="örn. B2B SaaS, pazarlama…" placeholderTextColor={c.text4} />

              <Text style={styles.fieldLb}>Hedef</Text>
              <TextInput style={styles.fieldInput} value={goalDraft} onChangeText={setGoalDraft} placeholder="İçerikle ne başarmak istiyorsun?" placeholderTextColor={c.text4} />

              <Text style={styles.fieldLb}>LinkedIn profil linki</Text>
              <TextInput style={styles.fieldInput} value={linkedinDraft} onChangeText={setLinkedinDraft} placeholder="https://linkedin.com/in/…" placeholderTextColor={c.text4} autoCapitalize="none" autoCorrect={false} keyboardType="url" />

              <Text style={styles.fieldLb}>Yardımcı linkler / makaleler / notlar</Text>
              <TextInput style={[styles.fieldInput, styles.fieldArea]} value={helperDraft} onChangeText={setHelperDraft} multiline placeholder="Seni daha iyi tanımamız için yazıların, makalelerin veya bağlantıların… (AI yeniden üretiminde kullanılır)" placeholderTextColor={c.text4} textAlignVertical="top" autoCapitalize="none" />

              <View style={styles.posEditActions}>
                <TouchableOpacity style={styles.posCancel} onPress={() => setEditingPos(false)}>
                  <Text style={styles.posCancelText}>Vazgeç</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.posSave, savingPos && { opacity: 0.5 }]} onPress={savePos} disabled={savingPos || regenLoading}>
                  <Text style={styles.posSaveText}>{savingPos ? "Kaydediliyor…" : "Kaydet"}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={[styles.regenBtn, regenLoading && { opacity: 0.5 }]} onPress={regeneratePersona} disabled={savingPos || regenLoading}>
                {regenLoading ? <ActivityIndicator color={c.accent} /> : <Text style={styles.regenText}>✨ AI ile Personayı Yeniden Üret</Text>}
              </TouchableOpacity>
              <Text style={styles.ruleHint}>ⓘ Persona ayda yalnızca bir kez değişir — tutarlı strateji ve model verimliliği için.</Text>
            </View>
          ) : (
            <>
              {positioning ? (
                <View style={styles.posCard}><Text style={styles.posTx}>"{positioning}"</Text></View>
              ) : (
                <View style={styles.posCard}><Text style={[styles.posTx, { fontStyle: "normal", color: c.text4 }]}>Henüz konumlandırma yok — Düzenle ile ekle.</Text></View>
              )}
              {purpose ? <Text style={styles.purposeTx}>{purpose}</Text> : null}
              {profile?.linkedin_url ? <Text style={styles.linkedinTx}>in · {profile.linkedin_url}</Text> : null}
              {!canEditPersona && (
                <Text style={styles.ruleHint}>ⓘ Persona ayda bir değiştirilir{nextEditDate ? ` · sıradaki: ${nextEditDate}` : ""}</Text>
              )}
            </>
          )}

          <Text style={styles.stratLb}>İÇERİK PILLAR'LARI</Text>
          <View style={styles.pillarsCard}>
            {pillars.map((p, i) => {
              const desc = descFor(p);
              return (
                <View key={i} style={[styles.pillarItem, i > 0 && styles.pillarBorder]}>
                  <View style={styles.pillarHeadRow}>
                    <View style={styles.pillarNum}><Text style={styles.pillarNumText}>{i + 1}</Text></View>
                    <Text style={styles.pillarTxt} numberOfLines={2}>{p}</Text>
                    <TouchableOpacity onPress={() => { setEditingIdx(i); setNewPillar(p); }} hitSlop={8}>
                      <Text style={styles.pillarEdit}>✎</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removePillar(i)} hitSlop={8}>
                      <Text style={styles.pillarDel}>×</Text>
                    </TouchableOpacity>
                  </View>
                  {desc ? <Text style={styles.pillarDesc}>{desc}</Text> : null}
                </View>
              );
            })}
            <View style={[styles.pillarAddRow, pillars.length > 0 && styles.pillarBorder]}>
              <TextInput
                style={styles.pillarInput}
                value={newPillar}
                onChangeText={setNewPillar}
                placeholder={editingIdx != null ? "Pillar'ı düzenle…" : "Yeni pillar ekle…"}
                placeholderTextColor={c.text4}
                onSubmitEditing={addOrUpdatePillar}
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.pillarAddBtn} onPress={addOrUpdatePillar}>
                <Text style={styles.pillarAddText}>{editingIdx != null ? "Kaydet" : "Ekle"}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {voice.length > 0 && (
            <>
              <Text style={styles.stratLb}>SES PROFİLİ{toneStyle ? ` · ${toneStyle}` : ""}</Text>
              <View style={styles.vTagRow}>
                {voice.map((v, i) => (
                  <View key={v + i} style={styles.vTag}><Text style={styles.vTagText}>{v}</Text></View>
                ))}
              </View>
              {toneVoice ? <Text style={styles.stratBody}>{toneVoice}</Text> : null}
            </>
          )}

          {(diffDo.length > 0 || diffDont.length > 0) && (
            <>
              <Text style={styles.stratLb}>FARKLILAŞMA</Text>
              <View style={styles.diffRow}>
                <View style={styles.diffCol}>
                  <Text style={styles.diffDoLb}>✓ Yap</Text>
                  {diffDo.map((d, i) => <Text key={i} style={styles.diffItem}>• {d}</Text>)}
                </View>
                <View style={styles.diffCol}>
                  <Text style={styles.diffDontLb}>✕ Kaçın</Text>
                  {diffDont.map((d, i) => <Text key={i} style={styles.diffItem}>• {d}</Text>)}
                </View>
              </View>
            </>
          )}

          {audience ? (
            <>
              <Text style={styles.stratLb}>HEDEF KİTLE</Text>
              <View style={styles.stratCard}><Text style={styles.stratBody}>{audience}</Text></View>
            </>
          ) : null}

          {values.length > 0 && (
            <>
              <Text style={styles.stratLb}>DEĞERLER</Text>
              <View style={styles.vTagRow}>
                {values.map((v, i) => (<View key={v + i} style={styles.vTag}><Text style={styles.vTagText}>{v}</Text></View>))}
              </View>
            </>
          )}

          {samplePost ? (
            <>
              <Text style={styles.stratLb}>ÖRNEK POST</Text>
              <View style={styles.sampleCard}><Text style={styles.sampleTx}>{samplePost}</Text></View>
            </>
          ) : null}

          {(platforms.length > 0 || cadence) && (
            <>
              <Text style={styles.stratLb}>YAYIN PLANI</Text>
              {platforms.length > 0 && (
                <View style={styles.vTagRow}>
                  {platforms.map((p, i) => (<View key={p + i} style={styles.platTag}><Text style={styles.platTagText}>{p}</Text></View>))}
                </View>
              )}
              {cadence ? <Text style={[styles.stratBody, { marginTop: 8 }]}>📅 {cadence}</Text> : null}
            </>
          )}

        </>
      )}

      <Text style={styles.stratLb}>KULLANIM & ABONELİK</Text>
      <View style={styles.usageCard}>
        <View style={styles.usageTopRow}>
          <View style={[styles.planPill, profile?.subscription?.active ? styles.planPro : styles.planFree]}>
            <Text style={[styles.planPillText, profile?.subscription?.active ? styles.planProText : styles.planFreeText]}>
              {profile?.subscription?.active ? "Pro" : "Ücretsiz"}
            </Text>
          </View>
          {!profile?.subscription?.active && (
            <TouchableOpacity onPress={() => setPaywall(true)} hitSlop={8}>
              <Text style={styles.usageUpgrade}>Pro'ya Geç →</Text>
            </TouchableOpacity>
          )}
        </View>
        {usage ? (
          <>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${Math.min(100, Math.round((usage.monthly.current / Math.max(1, usage.monthly.limit)) * 100))}%` }]} />
            </View>
            <Text style={styles.usageMeta}>Bu ay {usage.monthly.current}/{usage.monthly.limit} üretim · {usage.monthly.remaining} hak kaldı</Text>
            <Text style={styles.usageMetaSub}>Günlük: {usage.daily.current}/{usage.daily.limit}</Text>
          </>
        ) : (
          <Text style={styles.usageMeta}>Kullanım bilgisi yükleniyor…</Text>
        )}
        <View style={styles.payRow}>
          <Text style={styles.payLabel}>Plan</Text>
          <Text style={styles.payValue}>{profile?.subscription?.active ? (profile.subscription.plan ?? "Pro") : "Ücretsiz"}</Text>
        </View>
        <View style={styles.payRow}>
          <Text style={styles.payLabel}>Ödemeler</Text>
          <Text style={styles.payValue}>{profile?.subscription?.active ? "Aktif abonelik" : "App Store / Google Play"}</Text>
        </View>
      </View>

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
        <TouchableOpacity style={[styles.promoBtn, promoLoading && { opacity: 0.5 }]} onPress={redeemPromo} disabled={promoLoading}>
          <Text style={styles.promoBtnText}>{promoLoading ? "…" : "Kullan"}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.stratLb}>DAVET ET & KAZAN</Text>
      <Text style={styles.refInfo}>Davet ettiğin kişi aylık üye olursa +1 ay, yıllık olursa +3 ay Pro hediye kazanırsın.</Text>
      {ref && (
        <>
          <View style={styles.refCodeRow}>
            <Text style={styles.refCode}>{ref.code}</Text>
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
              <TouchableOpacity style={styles.promoBtn} onPress={applyRef}>
                <Text style={styles.promoBtnText}>Uygula</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      {profile?.subscription?.active ? (
        <View style={styles.proBadge}>
          <Text style={styles.proBadgeText}>✓ Pro üye</Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.proBtn} activeOpacity={0.85} onPress={() => setPaywall(true)}>
          <Text style={styles.proBtnText}>Pro'ya Geç →</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.stratLb}>AYARLAR</Text>
      <View style={styles.settingsCard}>
        <View style={styles.settingsRow}>
          <Text style={styles.settingsLabel}>Tema</Text>
          <ThemeToggle />
        </View>
        <View style={[styles.settingsRow, styles.settingsRowBorder]}>
          <Text style={styles.settingsLabel}>{t.language}</Text>
          <View style={styles.langSeg}>
            <TouchableOpacity style={[styles.langItem, lang === "tr" && styles.langItemOn]} activeOpacity={0.8} onPress={() => setLang("tr")}>
              <Text style={[styles.langText, lang === "tr" && styles.langTextOn]}>{t.langTurkish}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.langItem, lang === "en" && styles.langItemOn]} activeOpacity={0.8} onPress={() => setLang("en")}>
              <Text style={[styles.langText, lang === "en" && styles.langTextOn]}>{t.langEnglish}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <TouchableOpacity style={styles.logout} activeOpacity={0.8} onPress={handleLogout}>
        <Text style={styles.logoutText}>Çıkış yap</Text>
      </TouchableOpacity>
    </ScrollView>
    <Animated.View
      pointerEvents="none"
      style={[styles.savedToast, { opacity: savedAnim, transform: [{ translateY: savedAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }] }]}
    >
      <Text style={styles.savedToastText}>✓ Persona kaydedildi</Text>
    </Animated.View>
    <PaywallModal visible={paywall} onClose={() => setPaywall(false)} />

    {/* Persona once-a-month lock — design-system popup */}
    <Modal visible={lockModal} transparent animationType="fade" onRequestClose={() => setLockModal(false)}>
      <View style={styles.lockOverlay}>
        <View style={styles.lockCard}>
          <View style={styles.lockIcon}><Text style={styles.lockIconText}>🗓️</Text></View>
          <Text style={styles.lockTitle}>Persona ayda bir kez değişir</Text>
          <Text style={styles.lockBody}>
            Persona'nı {daysSince === Infinity ? "yakın zamanda" : `${daysSince} gün önce`} güncelledin.
            Kişisel stratejinin tutarlı kalması ve modelin senin sesini doğru öğrenebilmesi için sık
            değişiklik önermiyoruz — çünkü her değişiklik içerik üretim kalitesini ciddi biçimde düşürür.
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

function makeStyles(c: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.page },
    content: { paddingHorizontal: spacing.md, paddingTop: 56, paddingBottom: 130 },

    lbRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    editLink: { fontSize: 12, fontWeight: "600", color: c.accent, marginTop: 20 },
    posEditCard: { borderRadius: radii.card, backgroundColor: c.glassFill, borderWidth: 1, borderColor: c.mintBorder, padding: 14, marginTop: 8 },
    posInput: { minHeight: 80, fontSize: 15, color: c.text1, lineHeight: 22, textAlignVertical: "top" },
    fieldLb: { fontSize: 11, letterSpacing: 0.4, fontWeight: "600", color: c.text4, textTransform: "uppercase", marginTop: 12, marginBottom: 6 },
    fieldInput: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radii.btn, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: c.text1 },
    fieldArea: { minHeight: 70, textAlignVertical: "top" },
    regenBtn: { marginTop: 12, paddingVertical: 12, borderRadius: radii.btn, borderWidth: 1, borderColor: c.mintBorder, backgroundColor: c.accentGhost, alignItems: "center" },
    regenText: { fontSize: 13, fontWeight: "700", color: c.accent },
    posEditActions: { flexDirection: "row", gap: 8, marginTop: 10, justifyContent: "flex-end" },
    posCancel: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: radii.btn, borderWidth: 1, borderColor: c.glassBorder },
    posCancelText: { fontSize: 13, fontWeight: "600", color: c.text2 },
    posSave: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: radii.btn, backgroundColor: c.accent },
    posSaveText: { fontSize: 13, fontWeight: "700", color: "#fff" },
    ruleHint: { fontSize: 11, color: c.text4, marginTop: 6 },

    usageCard: { borderRadius: radii.card, backgroundColor: c.glassFill, borderWidth: 1, borderColor: c.glassBorder, padding: 16, marginTop: 8 },
    usageTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
    planPill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: radii.pill, borderWidth: 1 },
    planPro: { backgroundColor: c.mintBg, borderColor: c.mintBorder },
    planFree: { backgroundColor: c.glassFill, borderColor: c.glassBorder },
    planPillText: { fontSize: 12, fontWeight: "700" },
    planProText: { color: c.accent },
    planFreeText: { color: c.text3 },
    usageUpgrade: { fontSize: 13, fontWeight: "700", color: c.accent },
    barTrack: { height: 8, borderRadius: 4, backgroundColor: c.glassFillStrong, overflow: "hidden", borderWidth: 1, borderColor: c.glassBorder },
    barFill: { height: "100%", borderRadius: 4, backgroundColor: c.accent },
    usageMeta: { fontSize: 12, color: c.text3, marginTop: 8 },
    usageMetaSub: { fontSize: 11, color: c.text4, marginTop: 3 },
    payRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.glassBorder },
    payLabel: { fontSize: 12, color: c.text3 },
    payValue: { fontSize: 12, fontWeight: "600", color: c.text2 },
    settingsCard: { borderRadius: radii.card, backgroundColor: c.glassFill, borderWidth: 1, borderColor: c.glassBorder, paddingHorizontal: 14, marginTop: 8 },
    settingsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 },
    settingsRowBorder: { borderTopWidth: 1, borderTopColor: c.glassBorder },
    settingsLabel: { fontSize: 14, color: c.text1 },
    langSeg: { flexDirection: "row", backgroundColor: c.glassFill, borderWidth: 1, borderColor: c.glassBorder, borderRadius: radii.pill, padding: 3 },
    langItem: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radii.pill },
    langItemOn: { backgroundColor: c.accent },
    langText: { fontSize: 12.5, fontWeight: "600", color: c.text3 },
    langTextOn: { color: "#fff" },

    savedToast: { position: "absolute", top: 64, alignSelf: "center", paddingHorizontal: 16, paddingVertical: 9, borderRadius: radii.pill, backgroundColor: c.accent, shadowColor: c.accent, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
    savedToastText: { fontSize: 13, fontWeight: "700", color: "#fff" },

    top: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 },
    avatar: { width: 52, height: 52, borderRadius: 14, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" },
    avatarText: { fontSize: 22, fontWeight: "700", color: "#fff" },
    info: { flex: 1 },
    name: { fontSize: 20, fontWeight: "700", color: c.text1, letterSpacing: -0.4 },
    role: { fontSize: 13, color: c.text3, marginTop: 2 },

    loading: { paddingVertical: 40, alignItems: "center" },

    stratLb: { fontSize: 10, letterSpacing: 0.8, color: c.text4, fontWeight: "600", marginBottom: 10, marginTop: 20 },
    posCard: { padding: 16, borderRadius: radii.card, backgroundColor: c.mintBg, borderWidth: 1, borderColor: c.mintBorder, marginTop: 8 },
    posTx: { fontSize: 15, color: c.text1, lineHeight: 22, fontStyle: "italic" },

    purposeTx: { fontSize: 13, color: c.text3, lineHeight: 20, marginTop: 8 },
    linkedinTx: { fontSize: 12, color: c.accent, marginTop: 6 },
    lockOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 28 },
    lockCard: { width: "100%", maxWidth: 360, borderRadius: radii.card, backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder, padding: 22, alignItems: "center" },
    lockIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: c.amberGhost, borderWidth: 1, borderColor: c.amberBorder, alignItems: "center", justifyContent: "center", marginBottom: 14 },
    lockIconText: { fontSize: 24 },
    lockTitle: { fontSize: 17, fontWeight: "700", color: c.text1, textAlign: "center", marginBottom: 8 },
    lockBody: { fontSize: 13.5, color: c.text3, lineHeight: 20, textAlign: "center" },
    lockNext: { fontSize: 12.5, fontWeight: "600", color: c.accent, marginTop: 12 },
    lockBtn: { marginTop: 18, alignSelf: "stretch", paddingVertical: 13, borderRadius: radii.btn, backgroundColor: c.accent, alignItems: "center" },
    lockBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
    pillarsCard: { borderRadius: radii.card, backgroundColor: c.glassFill, borderWidth: 1, borderColor: c.glassBorder, overflow: "hidden" },
    pillarRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 14 },
    pillarItem: { paddingVertical: 13, paddingHorizontal: 14 },
    pillarHeadRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    pillarDesc: { fontSize: 12.5, color: c.text3, lineHeight: 18, marginTop: 6, marginLeft: 34 },

    stratBody: { fontSize: 13.5, color: c.text2, lineHeight: 20 },
    stratCard: { padding: 14, borderRadius: radii.card, backgroundColor: c.glassFill, borderWidth: 1, borderColor: c.glassBorder, marginTop: 8 },
    diffRow: { flexDirection: "row", gap: 10, marginTop: 8 },
    diffCol: { flex: 1, padding: 12, borderRadius: radii.card, backgroundColor: c.glassFill, borderWidth: 1, borderColor: c.glassBorder },
    diffDoLb: { fontSize: 12, fontWeight: "700", color: c.accent, marginBottom: 6 },
    diffDontLb: { fontSize: 12, fontWeight: "700", color: c.error, marginBottom: 6 },
    diffItem: { fontSize: 12, color: c.text2, lineHeight: 18, marginBottom: 3 },
    sampleCard: { padding: 16, borderRadius: radii.card, backgroundColor: c.mintBg, borderWidth: 1, borderColor: c.mintBorder, marginTop: 8 },
    sampleTx: { fontSize: 14, color: c.text1, lineHeight: 22 },
    platTag: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radii.pill, backgroundColor: c.accentGhost, borderWidth: 1, borderColor: c.mintBorder },
    platTagText: { fontSize: 13, fontWeight: "600", color: c.accent },
    pillarBorder: { borderTopWidth: 1, borderTopColor: c.glassBorder },
    pillarNum: { width: 22, height: 22, borderRadius: 6, backgroundColor: c.accentGhost, alignItems: "center", justifyContent: "center" },
    pillarNumText: { fontSize: 11, fontWeight: "700", color: c.accent },
    pillarTxt: { fontSize: 14, color: c.text1, flex: 1 },
    pillarEdit: { fontSize: 16, color: c.text3, paddingHorizontal: 4 },
    pillarDel: { fontSize: 20, color: c.text3, paddingHorizontal: 4, lineHeight: 22 },
    pillarAddRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 14 },
    pillarInput: { flex: 1, paddingVertical: 6, fontSize: 14, color: c.text1 },
    pillarAddBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radii.pill, backgroundColor: c.accent },
    pillarAddText: { fontSize: 12, fontWeight: "600", color: "#fff" },

    vTagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    vTag: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radii.pill, backgroundColor: c.glassFill, borderWidth: 1, borderColor: c.glassBorder },
    vTagText: { fontSize: 13, color: c.text2 },

    proBtn: { marginTop: 24, paddingVertical: 15, borderRadius: radii.btn, backgroundColor: c.accent, alignItems: "center" },
    proBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
    refInfo: { fontSize: 13, color: c.text3, lineHeight: 19, marginTop: 4 },
    refCodeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10, padding: 14, borderRadius: radii.card, backgroundColor: c.accentGhost, borderWidth: 1, borderColor: c.mintBorder },
    refCode: { fontSize: 18, fontWeight: "700", letterSpacing: 3, color: c.accent },
    refStat: { fontSize: 12, color: c.text2 },
    promoRow: { flexDirection: "row", gap: 8, marginTop: 8 },
    promoInput: { flex: 1, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radii.btn, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, letterSpacing: 1, color: c.text1 },
    promoBtn: { paddingHorizontal: 18, borderRadius: radii.btn, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" },
    promoBtnText: { fontSize: 14, fontWeight: "600", color: "#fff" },
    proBadge: { marginTop: 24, paddingVertical: 13, borderRadius: radii.btn, backgroundColor: c.accentGhost, borderWidth: 1, borderColor: c.mintBorder, alignItems: "center" },
    proBadgeText: { fontSize: 14, fontWeight: "700", color: c.accent },
    logout: { marginTop: 12, paddingVertical: 14, borderRadius: radii.btn, borderWidth: 1, borderColor: c.glassBorder, alignItems: "center" },
    logoutText: { fontSize: 15, fontWeight: "600", color: c.error },
  });
}
