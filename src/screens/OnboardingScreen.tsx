import { useState, useEffect, useCallback, useReducer, useRef, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Alert,
} from "react-native";
import { authedFetch } from "../lib/supabase";
import type { Answers, Step, PersonaProfile, Option } from "../types";
import { useTheme } from "../theme/ThemeContext";
import { radii, type Palette } from "../theme/tokens";

// ── Label maps ──

const GOAL_LABELS: Record<string, string> = {
  visibility: "Görünürlük — alanımda bilinmek",
  inbound: "Inbound — işime/fikirlerime talep yaratmak",
  brand: "Kişisel marka — kendi adımı inşa etmek",
  audience: "Kitle — takipçi ve topluluk oluşturmak",
};

const FIELD_LABELS: Record<string, string> = {
  tech: "Teknoloji / Yazılım / AI",
  business: "İş / Girişimcilik / Strateji",
  creative: "Yaratıcı / Tasarım / Medya",
  science: "Bilim / Sağlık / Akademi",
  finance: "Finans / Yatırım / Ekonomi",
  other: "Diğer",
};

const VOICE_LABELS: Record<string, string> = {
  casual: "Samimi / Günlük dil",
  formal: "Resmi / Profesyonel",
  story: "Hikaye anlatan",
  data: "Veri odaklı",
  sharp: "Kısa / Çarpıcı",
  deep: "Derin / Kapsamlı",
  humor: "Espri / Oyunbaz",
  emotive: "Duygusal / İlham verici",
};

const AUDIENCE_LABELS: Record<string, string> = {
  peers: "Alanımdaki profesyoneller",
  founders: "Girişimciler",
  leaders: "Yöneticiler / Karar alıcılar",
  ic: "Ürün/mühendislik ekipleri",
  recruit: "Öğrenciler / Kariyer başı",
  public: "Genel kamu",
};

const HOTTAKE_LABELS: Record<string, string> = {
  industry: "Sektör trendleri/dogmaları",
  tools: "Araçlar/metodolojiler",
  culture: "İş kültürü/yönetim",
  future: "Gelecek/teknoloji/toplum",
  none: "Henüz net aykırı görüşüm yok",
};

const FORMAT_LABELS: Record<string, string> = {
  long: "Uzun yazı / makale",
  short: "Kısa post",
  video: "Video script",
  carousel: "Carousel / slayt",
  audio: "Sesli / podcast",
};

const CADENCE_LABELS: Record<string, string> = {
  daily: "Hemen her gün",
  weekly: "Haftada 2-3 kez",
  biweekly: "Haftada 1 kez",
  monthly: "Ayda 2-3 kez",
};

const ANTIPOSITION_LABELS: Record<string, string> = {
  clickbait: "Tık tuzağı",
  corpo: "Kurumsal jargon",
  toxic: "Negatif/polemik",
  fluff: "Yüzeysel içerik",
  expert: "Ukalalık",
  hype: "Abartılı iyimserlik",
};

const INSPIRATION_LABELS: Record<string, string> = {
  elon: "Teknik founder'lar",
  pg: "Essayist'ler",
  lenny: "Newsletter yazarları",
  altman: "Tech thinker'lar",
  naval: "Felsefi iş yazarları",
  seth: "Pazarlama yazarları",
  other: "Başka",
};

// ── Warmup ──

function getWarmup(prevId: string, a: Answers) {
  const goal: Record<string, [string, string]> = {
    brand: [
      "Kişisel marka bir gecede olmaz.",
      "Kişisel marka çoğu zaman düzenli frekansta ve spesifik dikeylerde içerik üretmeyi gerektirir.",
    ],
    visibility: [
      "Görünürlük şans değil, tutarlılıktır.",
      "Doğru ritmi birlikte kuracağız.",
    ],
    inbound: [
      "İyi içerik fırsatları kapına getirir.",
      "Peşinden koşmadığın fırsatları kapına getirir. Hedefimiz tam bu.",
    ],
    audience: [
      "Kitle, değer veren içerikle büyür.",
      "Neyi iyi yaptığını bulup ölçekleyelim.",
    ],
  };
  const fieldMsgs: Record<string, [string, string]> = {
    finance: [
      "Finans içerikleri zor sayılır.",
      "Sıkıcı, anlaşılması güç bulunur. Oysa öyle olmak zorunda değil.",
    ],
    tech: [
      "Teknolojide 'neden' fark yaratır.",
      "Herkes 'ne' yaptığını anlatır; biz 'neden'ini öne çıkaracağız.",
    ],
    business: [
      "Pazarlamacının kendi pazarlaması en zorudur.",
      "Sana da bir stratejist lazım — işte buradayız.",
    ],
  };
  const audMsgs: Record<string, [string, string]> = {
    leaders: [
      "Yöneticiler az ama derin okur.",
      "Net ve kanıtlı bir ton kuracağız.",
    ],
    founders: [
      "Girişimciler ham dürüstlük sever.",
      "Filtresiz tarafın burada işine yarayacak.",
    ],
  };
  if (prevId === "goal" && a.goal && goal[a.goal]) {
    return { title: goal[a.goal][0], desc: goal[a.goal][1] };
  }
  if (prevId === "field" && a.field && fieldMsgs[a.field]) {
    return { title: fieldMsgs[a.field][0], desc: fieldMsgs[a.field][1] };
  }
  if (prevId === "hasContent") {
    return a.hasContent === "yes"
      ? { title: "Harika, sıfırdan başlamıyorsun.", desc: "İçeriklerini incelediğimde tonunu anlamam çok daha kolay olacak." }
      : { title: "Sorun değil, buradayız.", desc: "Sıfırdan birlikte kuracağız." };
  }
  if (prevId === "voiceTraits") {
    return { title: "Sesini duymaya başladım bile.", desc: "Bunu kalıcı hale getireceğiz." };
  }
  if (prevId === "audience") {
    for (const k of a.audience) {
      if (audMsgs[k]) return { title: audMsgs[k][0], desc: audMsgs[k][1] };
    }
  }
  if (prevId === "positioning") {
    return { title: "İşte çekirdek bu.", desc: "Şimdi bunu gerçek bir stratejiye dönüştürüyorum…" };
  }
  return { title: "Harika cevap.", desc: "Birazdan seni şaşırtacak bir profil çıkaracağız." };
}

// ── Steps ──

const MOTIVATION: Step[] = [
  {
    id: "m1",
    type: "motivation",
    part: 1,
    title: '"Neden içerik üretmeliyim ki?"',
    description: "İçerik üretmek, uzmanlığını görünür kılmanın en güçlü yolu.",
  },
  {
    id: "m2",
    type: "motivation",
    part: 1,
    title: '"Doğru bir karar mı?"',
    description: "En iyi zaman dünmüş; ikincisi şu an.",
  },
  {
    id: "m3",
    type: "motivation",
    part: 1,
    title: '"Vakit / emek korkusu"',
    description: "Konuş, biz yazıya dökelim. Senin işin düşünmek.",
  },
  {
    id: "m4",
    type: "motivation",
    part: 1,
    title: '"Yapabilir miyim / yeterli miyim?"',
    description: "Bilgin ve potansiyelin zaten var. Mindfolio bunu maksimize etmek için burada.",
  },
];

const QUESTIONS: Step[] = [
  {
    id: "goal",
    type: "single",
    part: 1,
    title: "Seni buraya ne getirdi?",
    description: "İçerik hedefin ne?",
    options: [
      { id: "visibility", emoji: "👁", label: "Görünürlük" },
      { id: "inbound", emoji: "🎯", label: "Inbound — talep yaratmak" },
      { id: "brand", emoji: "💎", label: "Kişisel marka" },
      { id: "audience", emoji: "📡", label: "Kitle oluşturmak" },
    ],
    validate: (a: any) => (a as Answers).goal.length > 0,
  },
  {
    id: "field",
    type: "single",
    part: 1,
    title: "Hangi alandasın?",
    description: "Uzmanlık alanın ne?",
    options: [
      { id: "tech", emoji: "💻", label: "Teknoloji / Yazılım / AI" },
      { id: "business", emoji: "📊", label: "İş / Girişimcilik" },
      { id: "creative", emoji: "🎨", label: "Yaratıcı / Tasarım" },
      { id: "science", emoji: "🔬", label: "Bilim / Sağlık / Akademi" },
      { id: "finance", emoji: "💰", label: "Finans / Yatırım" },
      { id: "other", emoji: "🌍", label: "Diğer" },
    ],
    validate: (a: any) => (a as Answers).field.length > 0,
  },
  {
    id: "hasContent",
    type: "single",
    part: 1,
    title: "Geçmiş içeriğin var mı?",
    options: [
      { id: "yes", emoji: "📚", label: "Evet" },
      { id: "no", emoji: "✨", label: "Hayır — sıfırdan" },
    ],
    validate: (a: any) => (a as Answers).hasContent.length > 0,
  },
  {
    id: "voiceTraits",
    type: "multi",
    part: 1,
    title: "Yazı sesin nasıl?",
    description: "En fazla 2 seç.",
    options: [
      { id: "casual", label: "Samimi / Günlük dil" },
      { id: "formal", label: "Resmi / Profesyonel" },
      { id: "story", label: "Hikaye anlatan" },
      { id: "data", label: "Veri odaklı" },
      { id: "sharp", label: "Kısa / Çarpıcı" },
      { id: "deep", label: "Derin / Kapsamlı" },
      { id: "humor", label: "Espri / Oyunbaz" },
      { id: "emotive", label: "Duygusal / İlham verici" },
    ],
    multiMax: 2,
    validate: (a: any) => (a as Answers).voiceTraits.length >= 1,
  },
  {
    id: "audience",
    type: "multi",
    part: 1,
    title: "Kime sesleniyorsun?",
    description: "Birden fazla seçebilirsin.",
    options: [
      { id: "peers", emoji: "🤝", label: "Alanımdaki profesyoneller" },
      { id: "founders", emoji: "🚀", label: "Girişimciler / Kurucular" },
      { id: "leaders", emoji: "👔", label: "Yöneticiler" },
      { id: "ic", emoji: "⚙", label: "Ürün/mühendislik ekipleri" },
      { id: "recruit", emoji: "🎓", label: "Öğrenciler" },
      { id: "public", emoji: "🌐", label: "Genel kamu" },
    ],
    validate: (a: any) => (a as Answers).audience.length >= 1,
  },
  {
    id: "positioning",
    type: "input",
    part: 1,
    title: "Ne ile bilinmek istersin?",
    description: "Bir cümleyle: İnsanlar seni neyle hatırlasın?",
    placeholder: "e.g., Yapay zekayı iş dünyası için anlaşılır kılan...",
    validate: (a: any) => (a.positioning as string)?.trim().length > 0,
  },
  // Part 2
  {
    id: "hotTakes",
    type: "multi",
    part: 2,
    title: "Hangi konularda güçlü görüşlerin var?",
    description: "Seni farklılaştıran konular.",
    options: [
      { id: "industry", emoji: "🏭", label: "Sektör trendleri / dogmalar" },
      { id: "tools", emoji: "🔧", label: "Araçlar / metodolojiler" },
      { id: "culture", emoji: "🏛", label: "İş kültürü / yönetim" },
      { id: "future", emoji: "🔮", label: "Gelecek / teknoloji" },
      { id: "none", emoji: "🤷", label: "Net bir görüşüm yok" },
    ],
  },
  {
    id: "hotTakesDetail",
    type: "input",
    part: 2,
    title: "Biraz daha açar mısın?",
    description: "Görüşünü kısaca açıkla.",
    placeholder: "e.g., Çoğu AI girişiminin asıl sorunu dağıtım stratejisi...",
  },
  {
    id: "format",
    type: "multi",
    part: 2,
    title: "Hangi içerik türü sana yakın?",
    options: [
      { id: "long", emoji: "📝", label: "Uzun yazı / makale" },
      { id: "short", emoji: "💬", label: "Kısa post" },
      { id: "video", emoji: "🎬", label: "Video script" },
      { id: "carousel", emoji: "🎠", label: "Carousel" },
      { id: "audio", emoji: "🎙", label: "Sesli / podcast" },
    ],
    validate: (a: any) => (a as Answers).format.length >= 1,
  },
  {
    id: "cadence",
    type: "single",
    part: 2,
    title: "Ne sıklıkla üretebilirsin?",
    options: [
      { id: "daily", emoji: "🔥", label: "Hemen her gün" },
      { id: "weekly", emoji: "📅", label: "Haftada 2-3 kez" },
      { id: "biweekly", emoji: "📆", label: "Haftada 1 kez" },
      { id: "monthly", emoji: "🌙", label: "Ayda 2-3 kez" },
    ],
    validate: (a: any) => (a as Answers).cadence.length > 0,
  },
  {
    id: "antiposition",
    type: "multi",
    part: 2,
    title: "Ne OLMAK İSTEMEZSİN?",
    description: "Kaçındığın klişe/ton.",
    options: [
      { id: "clickbait", emoji: "🪤", label: "Tık tuzağı" },
      { id: "corpo", emoji: "👔", label: "Kurumsal jargon" },
      { id: "toxic", emoji: "☠", label: "Negatif / polemik" },
      { id: "fluff", emoji: "🫧", label: "Yüzeysel içerik" },
      { id: "expert", emoji: "🎓", label: "Ukalalık" },
      { id: "hype", emoji: "📢", label: "Abartılı iyimserlik" },
    ],
  },
  {
    id: "inspiration",
    type: "multi",
    part: 2,
    title: "Kimlerin içeriğini beğeniyorsun?",
    description: "İsteğe bağlı.",
    options: [
      { id: "elon", emoji: "⚡", label: "Teknik founder'lar" },
      { id: "pg", emoji: "✍️", label: "Essayist'ler" },
      { id: "lenny", emoji: "📬", label: "Newsletter yazarları" },
      { id: "altman", emoji: "🧠", label: "Tech thinker'lar" },
      { id: "naval", emoji: "🧘", label: "Felsefi iş yazarları" },
      { id: "seth", emoji: "🎯", label: "Pazarlama yazarları" },
      { id: "other", emoji: "📖", label: "Başka" },
    ],
  },
];

const STEPS: Step[] = [
  ...MOTIVATION,
  { id: "welcome", type: "message" as const, part: 1, title: "Hadi yazı kişiliğini oluşturalım", description: "Birkaç soru ile sana özel bir yazı kişiliği oluşturacağım." },
  ...QUESTIONS.flatMap((q) => {
    const wId = `warmup-${q.id}`;
    return [q, { id: wId, type: "warmup" as const, part: q.part as 1 | 2, title: "", description: "" }];
  }),
  { id: "generating-teaser", type: "loader" as const, part: 1, title: "Personan oluşturuluyor...", description: "Cevapların analiz ediliyor." },
  { id: "reveal-positioning", type: "reveal" as const, part: 1, title: "İşte sen busun.", description: "Konumlandırma stratejin." },
  { id: "reveal-pillars", type: "reveal" as const, part: 1, title: "İçerik pillar'ların", description: "Ana başlıkların." },
  { id: "reveal-voice", type: "reveal" as const, part: 1, title: "Ses profili", description: "Yazı sesin ve farklılaşma." },
  { id: "reveal-sample", type: "reveal" as const, part: 1, title: "Örnek post", description: "Senin sesinden bir örnek." },
  { id: "paywall", type: "paywall" as const, part: 1, title: "Personan hazır. Sıra stratejide.", description: "Tam içerik stratejini aç." },
  { id: "differentiator", type: "single", part: 2, title: "Bakış açını farklı kılan ne?", description: "Seni en iyi tanımlayan ifade.", options: [
    { id: "exp-founder", emoji: "🏗", label: "Sıfırdan inşa ettim" },
    { id: "deep-expert", emoji: "🔬", label: "Derin uzmanlık" },
    { id: "contrarian", emoji: "⚡", label: "Ezberleri sorguluyorum" },
    { id: "connector", emoji: "🔗", label: "Bağlantılar kuruyorum" },
  ]},
  { id: "goals", type: "multi", part: 2, title: "İçeriğinle neyi başarmak istiyorsun?", options: [
    { id: "audience", emoji: "📈", label: "Kitle inşa etmek" },
    { id: "leads", emoji: "💼", label: "Talep yaratmak" },
    { id: "authority", emoji: "🎓", label: "Düşünce liderliği" },
    { id: "network", emoji: "🤝", label: "Bağlantı kurmak" },
    { id: "monetize", emoji: "💰", label: "Gelir elde etmek" },
    { id: "legacy", emoji: "📝", label: "Miras bırakmak" },
  ]},
  { id: "generating-full", type: "loader" as const, part: 2, title: "Stratejin oluşturuluyor...", description: "Konumlandırma, pillar'lar, ses profili ve örnek post." },
  { id: "reveal-full-positioning", type: "reveal" as const, part: 2, title: "İşte sen busun.", description: "Tam stratejin." },
  { id: "reveal-full-pillars", type: "reveal" as const, part: 2, title: "Pillar'ların", description: "Detaylı başlıklar." },
  { id: "reveal-full-voice", type: "reveal" as const, part: 2, title: "Ses profili", description: "Farklılaşma stratejisi." },
  { id: "reveal-full-sample", type: "reveal" as const, part: 2, title: "Örnek post", description: "Yayına hazır." },
  { id: "done", type: "done" as const, part: 2, title: "Her şey hazır!", description: "Studio'ya yönlendiriliyorsun..." },
];

// ── Default answers ──

const defaults: Answers = {
  goal: "",
  field: "",
  hasContent: "",
  voiceTraits: [],
  audience: [],
  positioning: "",
  hotTakes: [],
  hotTakesDetail: "",
  format: [],
  cadence: "",
  antiposition: [],
  inspiration: [],
  importedContent: "",
  differentiator: "",
  goals: [],
  "voice-calibrate": "",
  "first-content": "",
  "reminder-setup": "",
};

function canProceed(step: Step, a: Answers): boolean {
  if (["message", "motivation", "warmup", "reveal", "loader", "paywall", "done"].includes(step.type)) return true;
  if (step.validate) return step.validate(a as any);
  return true;
}

// ── Theme ──


// ── Shared UI Components ──

function OptionButton({
  opt,
  selected,
  onPress,
  disabled,
  multi,
}: {
  opt: Option;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  multi?: boolean;
}) {
  const { c } = useTheme();
  const localStyles = useMemo(() => makeLocalStyles(c), [c]);
  return (
    <TouchableOpacity
      style={[
        localStyles.option,
        selected && localStyles.optionSelected,
        disabled && !selected && localStyles.optionDisabled,
      ]}
      onPress={onPress}
      disabled={disabled && !selected}
    >
      <Text style={localStyles.optionEmoji}>{opt.emoji ?? ""}</Text>
      <Text style={[localStyles.optionLabel, selected && localStyles.optionLabelSelected]}>
        {opt.label}
      </Text>
      {multi && (
        <View style={[localStyles.checkbox, selected && localStyles.checkboxSelected]}>
          {selected && <Text style={localStyles.checkmark}>✓</Text>}
        </View>
      )}
    </TouchableOpacity>
  );
}

const makeLocalStyles = (c: Palette) => StyleSheet.create({
  option: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  optionSelected: {
    borderColor: c.accent,
    backgroundColor: c.accentGhost,
  },
  optionDisabled: { opacity: 0.4 },
  optionEmoji: { fontSize: 18 },
  optionLabel: { fontSize: 15, color: c.text1, flex: 1 },
  optionLabelSelected: { fontWeight: "600" },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: c.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: { backgroundColor: c.accent, borderColor: c.accent },
  checkmark: { color: "#fff", fontSize: 14, fontWeight: "700" },
});

// ── Onboarding Screen ──

interface Props {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: Props) {
  const { c } = useTheme();
  const s = useMemo(() => makeS(c), [c]);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({ ...defaults });
  const [personaData, setPersonaData] = useState<PersonaProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [applyingCode, setApplyingCode] = useState(false);
  const [codeStatus, setCodeStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const applyInviteCode = useCallback(async () => {
    const code = inviteCode.trim();
    if (!code) return;
    setApplyingCode(true);
    setCodeStatus(null);
    try {
      // Try a referral code first, then fall back to a promo code.
      let res = await authedFetch("/api/referral", { method: "POST", body: JSON.stringify({ code }) });
      if (!res.ok) res = await authedFetch("/api/promo/redeem", { method: "POST", body: JSON.stringify({ code }) });
      const d = await res.json().catch(() => ({}));
      setCodeStatus(res.ok ? { ok: true, msg: "Kod uygulandı 🎉 Ek hakların tanımlandı." } : { ok: false, msg: d.error || "Kod geçersiz." });
    } catch {
      setCodeStatus({ ok: false, msg: "Bağlantı hatası." });
    } finally {
      setApplyingCode(false);
    }
  }, [inviteCode]);

  const step = STEPS[stepIndex];
  const prevStep = STEPS[stepIndex - 1];

  const fadeTransition = () => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  };

  const goNext = useCallback(() => {
    setStepIndex((i) => i + 1);
    fadeTransition();
  }, []);

  const setAnswer = useCallback((key: keyof Answers, value: any) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Auto-advance for warmup, motivation, single
  useEffect(() => {
    if (step?.type === "warmup") {
      const t = setTimeout(goNext, 1200);
      return () => clearTimeout(t);
    }
    if (step?.type === "motivation") {
      const t = setTimeout(goNext, 3000);
      return () => clearTimeout(t);
    }
  }, [step?.id, step?.type]);

  // Generate teaser persona
  useEffect(() => {
    if (step?.id === "generating-teaser") {
      setLoading(true);
      const gLabel = GOAL_LABELS[answers.goal] ?? answers.goal;
      const fLabel = FIELD_LABELS[answers.field] ?? answers.field;
      const vLabel = answers.voiceTraits.map((v) => VOICE_LABELS[v] ?? v).join(", ");
      const aLabel = answers.audience.map((a: string) => AUDIENCE_LABELS[a] ?? a).join(", ");

      authedFetch("/api/ai/analyze-persona", {
        method: "POST",
        body: JSON.stringify({
          goal: gLabel,
          field: fLabel,
          hasContent: answers.hasContent,
          voiceTraits: vLabel,
          audience: aLabel,
          positioning: answers.positioning,
          importedContent: answers.importedContent || undefined,
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data?.profile) {
            setPersonaData(data.profile);
            authedFetch("/api/personas", {
              method: "PUT",
              body: JSON.stringify({
                name: gLabel.slice(0, 60) || "My Persona",
                profile: data.profile,
                onboarding_complete: false,
              }),
            }).catch(() => {});
          }
        })
        .catch(() => {})
        .finally(() => {
          setLoading(false);
          setTimeout(goNext, 600);
        });
    }
  }, [step?.id]);

  // Generate full strategy
  useEffect(() => {
    if (step?.id === "generating-full") {
      setLoading(true);
      const gLabel = GOAL_LABELS[answers.goal] ?? answers.goal;
      const fLabel = FIELD_LABELS[answers.field] ?? answers.field;
      const vLabel = answers.voiceTraits.map((v) => VOICE_LABELS[v] ?? v).join(", ");
      const aLabel = answers.audience.map((a: string) => AUDIENCE_LABELS[a] ?? a).join(", ");
      const htLabel = answers.hotTakes.map((h) => HOTTAKE_LABELS[h] ?? h).join(", ");
      const fmtLabel = answers.format.map((f) => FORMAT_LABELS[f] ?? f).join(", ");
      const cadLabel = CADENCE_LABELS[answers.cadence] ?? answers.cadence;
      const antiLabel = answers.antiposition.map((a) => ANTIPOSITION_LABELS[a] ?? a).join(", ");
      const inspLabel = answers.inspiration.map((i) => INSPIRATION_LABELS[i] ?? i).join(", ");

      authedFetch("/api/ai/analyze-persona", {
        method: "POST",
        body: JSON.stringify({
          goal: gLabel,
          field: fLabel,
          hasContent: answers.hasContent,
          voiceTraits: vLabel,
          audience: aLabel,
          positioning: answers.positioning,
          hotTakes: htLabel,
          hotTakesDetail: answers.hotTakesDetail,
          format: fmtLabel,
          cadence: cadLabel,
          antiposition: antiLabel,
          inspiration: inspLabel,
          importedContent: answers.importedContent || undefined,
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data?.profile) {
            setPersonaData(data.profile);
            authedFetch("/api/personas", {
              method: "PUT",
              body: JSON.stringify({
                name: gLabel.slice(0, 60) || "My Persona",
                profile: data.profile,
                onboarding_complete: false,
              }),
            }).catch(() => {});
          }
        })
        .catch(() => {})
        .finally(() => {
          setLoading(false);
          setTimeout(goNext, 600);
        });
    }
  }, [step?.id]);

  // Paywall → subscribe
  const handleSubscribe = async () => {
    setLoading(true);
    await authedFetch("/api/personas", {
      method: "PUT",
      body: JSON.stringify({ subscription: { active: true, plan: "monthly", mock: true, subscribed_at: new Date().toISOString() } }),
    }).catch(() => {});
    setSubscribed(true);
    setLoading(false);
    // Jump to Part 2
    const p2 = STEPS.findIndex((s) => s.part === 2);
    setStepIndex(p2);
    fadeTransition();
  };

  // Done → complete
  useEffect(() => {
    if (step?.id === "done") {
      authedFetch("/api/personas", {
        method: "PUT",
        body: JSON.stringify({ onboarding_complete: true }),
      }).catch(() => {});
      setTimeout(onComplete, 1500);
    }
  }, [step?.id]);

  // ── Render ──

  const warmupInfo = step?.type === "warmup" && prevStep ? getWarmup(prevStep.id, answers) : null;

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={s.header}>
        <Text style={s.partLabel}>Part {step?.part ?? 1}</Text>
        <Text style={s.stepCount}>
          {STEPS.filter((s) => s.part === (step?.part ?? 1)).findIndex((s) => s.id === step?.id) + 1}
          /{STEPS.filter((s) => s.part === (step?.part ?? 1)).length}
        </Text>
      </View>

      {/* Progress bar */}
      {step && !["message", "motivation", "warmup", "reveal", "loader", "paywall", "done"].includes(step.type) && (
        <View style={s.progressBg}>
          <View
            style={[
              s.progressFill,
              {
                width: `${
                  ((STEPS.filter((s) => s.part === step.part).findIndex((s) => s.id === step.id) + 1) /
                    STEPS.filter((s) => s.part === step.part).length) *
                  100
                }%`,
              },
            ]}
          />
        </View>
      )}

      {/* Card */}
      <Animated.View style={[s.card, { opacity: fadeAnim }]}>
        {/* Motivation */}
        {step?.type === "motivation" && (
          <View style={s.centerContent}>
            <Text style={s.emojiLarge}>💬</Text>
            <Text style={s.motivationTitle}>{step.title}</Text>
            <Text style={s.motivationDesc}>{step.description}</Text>
          </View>
        )}

        {/* Welcome */}
        {step?.id === "welcome" && (
          <View style={s.centerContent}>
            <Text style={s.emojiLarge}>✦</Text>
            <Text style={s.heading}>{step.title}</Text>
            <Text style={s.body}>{step.description}</Text>

            <View style={s.codeWrap}>
              <Text style={s.codeLb}>Davet / promo kodun var mı?</Text>
              <View style={s.codeRow}>
                <TextInput
                  style={s.codeInput}
                  value={inviteCode}
                  onChangeText={(v) => setInviteCode(v.toUpperCase())}
                  placeholder="KOD (opsiyonel)"
                  placeholderTextColor={c.text4}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  onSubmitEditing={applyInviteCode}
                  returnKeyType="go"
                />
                <TouchableOpacity
                  style={[s.codeBtn, (applyingCode || !inviteCode.trim()) && { opacity: 0.5 }]}
                  onPress={applyInviteCode}
                  disabled={applyingCode || !inviteCode.trim()}
                >
                  <Text style={s.codeBtnText}>{applyingCode ? "…" : "Uygula"}</Text>
                </TouchableOpacity>
              </View>
              {codeStatus && <Text style={[s.codeMsg, { color: codeStatus.ok ? c.accent : c.error }]}>{codeStatus.msg}</Text>}
            </View>
          </View>
        )}

        {/* Warmup */}
        {step?.type === "warmup" && warmupInfo && (
          <View style={s.centerContent}>
            <View style={s.pulse}>
              <View style={s.pulseInner} />
            </View>
            <Text style={s.warmupTitle}>{warmupInfo.title}</Text>
            <Text style={s.warmupDesc}>{warmupInfo.desc}</Text>
          </View>
        )}

        {/* Single select */}
        {step?.type === "single" && step.options && (
          <View style={s.stepContent}>
            <Text style={s.heading}>{step.title}</Text>
            {step.description && <Text style={s.body}>{step.description}</Text>}
            <View style={{ gap: 8 }}>
              {step.options.map((opt) => (
                <OptionButton
                  key={opt.id}
                  opt={opt}
                  selected={answers[step.id as keyof Answers] === opt.id}
                  onPress={() => {
                    setAnswer(step.id as keyof Answers, opt.id);
                    setTimeout(goNext, 350);
                  }}
                />
              ))}
            </View>
          </View>
        )}

        {/* Multi select */}
        {step?.type === "multi" && step.options && step.options.length > 0 && (
          <View style={s.stepContent}>
            <Text style={s.heading}>{step.title}</Text>
            {step.description && <Text style={s.body}>{step.description}</Text>}
            {step.multiMax && <Text style={s.hint}>En fazla {step.multiMax} seçim</Text>}
            <View style={{ gap: 8 }}>
              {step.options.map((opt) => {
                const key = step.id as keyof Answers;
                const current = (answers[key] as string[]) ?? [];
                const sel = current.includes(opt.id);
                const atMax = !!step.multiMax && current.length >= step.multiMax;
                return (
                  <OptionButton
                    key={opt.id}
                    opt={opt}
                    selected={sel}
                    multi
                    disabled={atMax}
                    onPress={() => {
                      if (sel) {
                        setAnswer(key, current.filter((x: string) => x !== opt.id));
                      } else if (!atMax) {
                        setAnswer(key, [...current, opt.id]);
                      }
                    }}
                  />
                );
              })}
            </View>
            <TouchableOpacity style={s.continueBtn} onPress={goNext} disabled={!canProceed(step, answers)}>
              <Text style={s.continueText}>Devam</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Input */}
        {step?.type === "input" && (
          <View style={s.stepContent}>
            <Text style={s.heading}>{step.title}</Text>
            {step.description && <Text style={s.body}>{step.description}</Text>}
            <TextInput
              style={s.textArea}
              value={(answers[step.id as keyof Answers] as string) ?? ""}
              onChangeText={(text) => setAnswer(step.id as keyof Answers, text)}
              placeholder={step.placeholder}
              placeholderTextColor="rgba(10,20,9,0.4)"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        )}

        {/* Loader */}
        {step?.type === "loader" && (
          <View style={s.centerContent}>
            <ActivityIndicator size="large" color={c.accent} />
            <Text style={s.heading}>{step.title}</Text>
            <Text style={s.body}>{step.description}</Text>
          </View>
        )}

        {/* Reveal */}
        {step?.type === "reveal" && personaData && (
          <View style={s.stepContent}>
            <Text style={s.emojiLarge}>
              {step.id.includes("positioning") ? "✦" : step.id.includes("pillar") ? "📚" : step.id.includes("voice") ? "🎯" : "✍️"}
            </Text>
            <Text style={s.heading}>{step.title}</Text>
            <Text style={s.body}>{step.description}</Text>
            {step.id.includes("positioning") && (
              <View style={s.highlightCard}>
                <Text style={s.italicText}>
                  &ldquo;{personaData.positioning_statement ?? "Henüz oluşturulmadı."}&rdquo;
                </Text>
              </View>
            )}
            {step.id.includes("pillar") && (personaData.pillars ?? []).length > 0 && (
              <View style={{ gap: 8 }}>
                {(personaData.pillars as { title: string; description: string }[]).map((p, i) => (
                  <View key={i} style={s.pillarCard}>
                    <Text style={s.pillarTitle}>{i + 1}. {p.title}</Text>
                    <Text style={s.pillarDesc}>{p.description}</Text>
                  </View>
                ))}
              </View>
            )}
            {step.id.includes("voice") && (personaData.voice_profile ?? []).length > 0 && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {(personaData.voice_profile as string[]).map((t) => (
                  <View key={t} style={s.tag}>
                    <Text style={s.tagText}>{t}</Text>
                  </View>
                ))}
              </View>
            )}
            {step.id.includes("sample") && personaData.sample_post && (
              <View style={s.sampleCard}>
                <Text style={s.sampleText}>{personaData.sample_post}</Text>
              </View>
            )}
            <Text style={s.editNote}>Bunu sonra düzenleyebilirsin.</Text>
            <TouchableOpacity style={s.continueBtn} onPress={goNext}>
              <Text style={s.continueText}>
                {step.id === "reveal-sample" ? "Tam Stratejiyi Gör →" : "Devam"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Paywall */}
        {step?.type === "paywall" && (
          <View style={s.stepContent}>
            <Text style={s.emojiLarge}>💎</Text>
            <Text style={s.heading}>{step.title}</Text>
            <Text style={s.body}>{step.description}</Text>

            <View style={s.priceCard}>
              <Text style={s.price}>$19</Text>
              <Text style={s.priceSub}>/ay · iptal özgür</Text>
              <View style={{ gap: 10, marginTop: 16 }}>
                {[
                  "Konumlandırma stratejisi",
                  "3–5 içerik pillar'ı",
                  "Ses profili + farklılaşma",
                  "Yayına hazır örnek post",
                  "Önerilen yayın takvimi",
                  "Sınırsız düzenleme",
                ].map((f) => (
                  <View key={f} style={{ flexDirection: "row", gap: 8 }}>
                    <Text style={{ fontSize: 16 }}>✦</Text>
                    <Text style={{ fontSize: 14, color: c.text1 }}>{f}</Text>
                  </View>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={[s.continueBtn, { marginTop: 16 }]}
              onPress={handleSubscribe}
              disabled={loading}
            >
              <Text style={s.continueText}>
                {loading ? "Hazırlanıyor..." : "Aboneliği Başlat — $19/ay"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={goNext} style={{ marginTop: 12 }}>
              <Text style={{ color: "rgba(10,20,9,0.4)", fontSize: 13, textAlign: "center", textDecorationLine: "underline" }}>
                Belki sonra — personamı kaydet
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Done */}
        {step?.type === "done" && (
          <View style={s.centerContent}>
            <Text style={s.emojiLarge}>✦</Text>
            <Text style={s.heading}>{step.title}</Text>
            <Text style={s.body}>{step.description}</Text>
          </View>
        )}
      </Animated.View>

      {/* Footer: Continue button for non-auto steps */}
      {step && !["message", "motivation", "warmup", "reveal", "loader", "paywall", "done", "single"].includes(step.type) && (
        <TouchableOpacity
          style={[s.continueBtn, !canProceed(step, answers) && s.continueBtnDisabled]}
          onPress={goNext}
          disabled={!canProceed(step, answers)}
        >
          <Text style={[s.continueText, !canProceed(step, answers) && { opacity: 0.5 }]}>Devam</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

// ── Styles ──

const makeS = (c: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.page },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  partLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, color: c.accent },
  stepCount: { fontSize: 11, color: c.text4 },
  progressBg: { height: 4, backgroundColor: c.border, borderRadius: 2, marginBottom: 16, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: c.accent, borderRadius: 2 },
  card: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  centerContent: { alignItems: "center", gap: 12, paddingVertical: 20 },
  codeWrap: { alignSelf: "stretch", marginTop: 24, gap: 8 },
  codeLb: { fontSize: 13, color: c.text2, fontWeight: "600", textAlign: "center" },
  codeRow: { flexDirection: "row", gap: 8 },
  codeInput: { flex: 1, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radii.btn, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, letterSpacing: 1, color: c.text1 },
  codeBtn: { paddingHorizontal: 18, borderRadius: radii.btn, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" },
  codeBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  codeMsg: { fontSize: 12, textAlign: "center" },
  stepContent: { gap: 12 },
  emojiLarge: { fontSize: 36, marginBottom: 4 },
  heading: { fontSize: 22, fontWeight: "700", color: c.text1, textAlign: "center" },
  body: { fontSize: 15, color: c.text3, textAlign: "center", lineHeight: 22 },
  motivationTitle: { fontSize: 22, fontWeight: "700", color: c.text1, textAlign: "center", fontStyle: "italic" },
  motivationDesc: { fontSize: 16, color: c.text3, textAlign: "center", lineHeight: 24 },
  warmupTitle: { fontSize: 18, fontWeight: "700", color: c.text1, textAlign: "center" },
  warmupDesc: { fontSize: 14, color: c.text3, textAlign: "center", lineHeight: 20 },
  hint: { fontSize: 12, color: c.text4 },
  textArea: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: c.text1,
    minHeight: 100,
  },
  continueBtn: {
    backgroundColor: c.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  continueBtnDisabled: { opacity: 0.5 },
  continueText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  highlightCard: {
    backgroundColor: c.accentGhost,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: c.mintBorder,
  },
  italicText: { fontSize: 16, fontStyle: "italic", color: c.text1, lineHeight: 22, textAlign: "center" },
  pillarCard: {
    backgroundColor: c.surfaceElevated,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: c.border,
  },
  pillarTitle: { fontSize: 14, fontWeight: "700", color: c.text1, marginBottom: 2 },
  pillarDesc: { fontSize: 13, color: c.text3 },
  tag: {
    backgroundColor: c.accentGhost,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagText: { fontSize: 13, color: c.accent, fontWeight: "500" },
  sampleCard: {
    backgroundColor: c.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: c.border,
  },
  sampleText: { fontSize: 14, color: c.text1, lineHeight: 20 },
  editNote: { fontSize: 12, color: c.text4, textAlign: "center" },
  priceCard: {
    backgroundColor: c.accentGhost,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: c.mintBorder,
    alignItems: "center",
  },
  price: { fontSize: 40, fontWeight: "800", color: c.text1 },
  priceSub: { fontSize: 14, color: c.text3 },
  pulse: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: c.accentGhost,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: c.accent,
  },
});
