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
  Easing,
} from "react-native";
import Svg, { Rect as SvgRect } from "react-native-svg";
import { authedFetch, supabase } from "../lib/supabase";
import { confirmAsync } from "../lib/confirm";
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
// İçerik-aware mesajlar: önceki cevaba göre değişir, boş alan için telafi metni içerir.

function getWarmup(prevId: string, a: Answers) {
  // Goal — kullanıcının amacına göre özelleşmiş cevap
  const goal: Record<string, [string, string]> = {
    brand: [
      "Kişisel marka, dijital itibarındır.",
      "Düzenli ve tutarlı içerikle adın senden önce konuşur. Bu yolda yanındayız.",
    ],
    visibility: [
      "Görünürlük şans değil, tutarlılıktır.",
      "Doğru ritmi birlikte kuracağız — alanında akılda kalan isim olacaksın.",
    ],
    inbound: [
      "İyi içerik fırsatları kapına getirir.",
      "Peşinden koşmadığın talepler içeriklerinle gelecek. Hedef tam bu.",
    ],
    audience: [
      "Kitle, değer veren içerikle büyür.",
      "Hangi konuda otorite kuracağını birlikte netleştirelim, sonra ölçeklendirelim.",
    ],
  };
  // Field — sektöre özel insight
  const fieldMsgs: Record<string, [string, string]> = {
    finance: [
      "Finans içerikleri, anlaşılır olduğunda güven yaratır.",
      "Jargonsuz, örnekli ve doğrudan bir ton kuracağız — okuyan kalır.",
    ],
    tech: [
      "Teknolojide 'neden' fark yaratır.",
      "Herkes 'ne' yaptığını anlatır; biz senin 'neden'ini öne çıkaracağız.",
    ],
    business: [
      "Girişimcilik, hikayeyle anlatıldığında güç kazanır.",
      "Yaşadıklarını, kararlarını ve kayıplarını içerik haline çevireceğiz.",
    ],
    creative: [
      "Yaratıcı işlerde süreç, sonuç kadar önemli.",
      "Düşünme biçimini görünür kılacağız — eseri değil, sanatçıyı satarsın.",
    ],
    science: [
      "Bilim, hikayeyle anlatıldığında dokunur.",
      "Sayıların ardındaki insan kıvılcımını çıkaracağız — kalıcı olur.",
    ],
    other: [
      "Niş senin için avantaj.",
      "Az ama derin bir kitle bulup onlara konuşacağız.",
    ],
  };
  // Audience — kime sesleniyor
  const audMsgs: Record<string, [string, string]> = {
    leaders: ["Yöneticiler az ama derin okur.", "Net, kanıtlı ve sonuç odaklı bir ton kuracağız."],
    founders: ["Girişimciler ham dürüstlük sever.", "Filtresiz tarafın burada en büyük avantajın olacak."],
    peers: ["Akranların seni 'içeriden biri' olarak görmeli.", "Saha jargonuyla, paylaştıkça güven kazanacaksın."],
    ic: ["IC'ler taktik içerik için gelir.", "Somut örnekler ve uygulanabilir öğütler işine yarayacak."],
    recruit: ["Kariyer başındakiler örnek arar.", "Yolculuğunu açık paylaşman onlara fener olacak."],
    public: ["Geniş kitleye konuşmak, sade dil ister.", "Karmaşığı basitleştiren tarafın seni öne çıkaracak."],
  };

  if (prevId === "goal" && a.goal && goal[a.goal]) {
    return { title: goal[a.goal][0], desc: goal[a.goal][1] };
  }
  if (prevId === "field") {
    if (!a.field) {
      return { title: "Alan boş kaldı.", desc: "Sorun değil — ama alanını paylaşırsan strateji çok daha keskin olur. Profilden sonradan ekleyebilirsin." };
    }
    if (fieldMsgs[a.field]) return { title: fieldMsgs[a.field][0], desc: fieldMsgs[a.field][1] };
  }
  if (prevId === "linkedin-url") {
    if (!(a["linkedin-url"] || "").trim()) {
      return { title: "LinkedIn boş kaldı.", desc: "Sonra Profil'den ekleyebilirsin. Profil bağlarsan AI tonunu çok daha doğru yakalar." };
    }
    return { title: "Profilin inceleniyor…", desc: "Yazı tonunu ve tekrar eden temalarını çıkarıyorum." };
  }
  if (prevId === "import-content") {
    if (!(a["import-content"] || "").trim()) {
      return { title: "Örnek metin yok — sorun değil.", desc: "Sıfırdan başlıyoruz. Sonradan istediğin zaman örnek paylaşarak personanı keskinleştirebilirsin." };
    }
    return { title: "Yazını okuyorum.", desc: "Tonunu, sık geçen temalarını ve düşünce biçimini çıkarıyorum." };
  }
  if (prevId === "voiceTraits") {
    if ((a.voiceTraits ?? []).length === 0) {
      return { title: "Seçim yapmadın.", desc: "Sorun değil — örnek metinlerinden tonunu yine de çıkarabilirim. Profilden sonra ayar yapabilirsin." };
    }
    const map: Record<string, string> = {
      casual: "Samimi", formal: "Resmi", story: "Hikaye anlatan", data: "Veri odaklı",
      sharp: "Kısa ve çarpıcı", deep: "Derin", humor: "Espirili", emotive: "Duygusal",
    };
    const traits = (a.voiceTraits ?? []).slice(0, 2).map((v) => map[v] ?? v).join(" + ");
    return { title: `${traits} bir ses — anladım.`, desc: "Bu kombinasyon, her platformda taslaklarını şekillendirecek." };
  }
  if (prevId === "audience") {
    if ((a.audience ?? []).length === 0) {
      return { title: "Kitle seçilmedi.", desc: "Sorun değil; varsayılan olarak alanındaki profesyonellere yazıyoruz. Sonra daraltabiliriz." };
    }
    for (const k of a.audience) {
      if (audMsgs[k]) return { title: audMsgs[k][0], desc: audMsgs[k][1] };
    }
  }
  if (prevId === "positioning") {
    if (!(a.positioning || "").trim()) {
      return { title: "Konumlandırma boş.", desc: "AI bunu seçimlerinden tahmin edecek — ama bir cümleyle yazarsan stratejin daha keskin olur." };
    }
    return { title: "İşte çekirdek bu.", desc: "Şimdi bunu gerçek bir stratejiye dönüştürüyorum…" };
  }
  if (prevId === "hotTakes") {
    if ((a.hotTakes ?? []).length === 0 || a.hotTakes?.includes("none")) {
      return { title: "Sorun değil, henüz net görüşün olmayabilir.", desc: "İçerik üretmeye başladıkça pozisyonun netleşir. Şimdilik gözlemlerinden başlayacağız." };
    }
    return { title: "Bunlar tezlerin oluyor.", desc: "Pillar'larını bu konular etrafında inşa edeceğim — savunabileceğin bir pozisyon." };
  }
  if (prevId === "hotTakesDetail") {
    if (!(a.hotTakesDetail || "").trim()) {
      return { title: "Boş bıraktın — sorun değil.", desc: "Detay vermek istemediysen bu bölüm zayıf kalabilir. Profil > Strateji'den istediğin zaman tezlerini güçlendirebilirsin." };
    }
    return { title: "Aldım. Bu görüş senin imzan olabilir.", desc: "Bu net duruşu pillar'lardan birinin merkezine yerleştireceğim." };
  }
  if (prevId === "cadence") {
    return { title: "Tempo kuruldu.", desc: "İçerik takvimini bu sıklığa göre planlayacağım — abartılı değil, sürdürülebilir." };
  }
  if (prevId === "antiposition") {
    return { title: "Sınırların net.", desc: "Bu kaçındığın ton ve klişeler her çıktıdan elenecek. Sesin temiz kalacak." };
  }
  if (prevId === "inspiration") {
    if ((a.inspiration ?? []).length === 0) {
      return { title: "İlham kaynağı seçmedin.", desc: "Sorun değil — orijinal sesin için bağımsız bir alandan başlıyoruz." };
    }
    return { title: "Üçgenleme tamam.", desc: "Beğendiğin yazarların güçlü yanlarını referans alıp senin sesinde harmanlayacağım." };
  }
  if (prevId === "differentiator") {
    return { title: "Farkın belirlendi.", desc: "Pillar'larını bu farklılık üzerine kuracağım — sığ alan yerine güçlü olduğun saha." };
  }
  if (prevId === "goals") {
    if ((a.goals ?? []).length === 0) {
      return { title: "Hedef yok.", desc: "Sorun değil — varsayılan olarak görünürlük + topluluk hedefliyoruz." };
    }
    return { title: "Hedeflerin not edildi.", desc: "İçerik takvimini ve örnek post tonunu bu hedeflere göre kalibre ediyorum." };
  }
  // Fallback — her seferinde farklı hissetsin
  const fallbacks: [string, string][] = [
    ["Not aldım.", "Bir sonraki soruda devam edelim."],
    ["Hesaba katıldı.", "Stratejine doğrudan etki edecek."],
    ["Anladım.", "Bu cevap önemli — pillar'larına yansıyacak."],
  ];
  const i = (prevId.length + (a.goal?.length || 0)) % fallbacks.length;
  return { title: fallbacks[i][0], desc: fallbacks[i][1] };
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
  // (hasContent sorusu kaldırıldı — sonraki iki adım (linkedin-url + import-content) zaten opsiyonel)
  // 5.1 — LinkedIn URL (opsiyonel, skip'lenebilir)
  {
    id: "linkedin-url",
    type: "input",
    part: 1,
    title: "LinkedIn profilin var mı?",
    description: "Paylaşırsan içerik stratejini profilinden besleyebilirim. Boş bırakabilirsin.",
    placeholder: "linkedin.com/in/kullaniciadi",
    validate: () => true,
  },
  // 5.2 — İçerik içe aktar (opsiyonel, skip'lenebilir)
  {
    id: "import-content",
    type: "input",
    part: 1,
    title: "Daha önce bir şeyler yazdın mı?",
    description: "Blog, makale veya LinkedIn yazısı — link veya metin yapıştır. Boş bırakabilirsin.",
    placeholder: "https://medium.com/... veya yazı örneklerini yapıştır",
    validate: () => true,
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
];

// Part 2 sorular kaldırıldı — kullanıcının Part 1'de verdiği bilgi yeterli.
// Aşağıdaki dizi artık STEPS akışına eklenmiyor; ileride ihtiyaç halinde kullanmak için tutuluyor.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _RESERVED_PART2_QUESTIONS: Step[] = [
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
    title: "Hangi konuda farklı düşünüyorsun?",
    description: "Yukarıda seçtiğin alanlarda 'çoğunluğun katılmadığı ama senin doğru bulduğun' bir görüşünü 1-2 cümleyle yaz. Bu görüşleri içerik pillar'larına dönüştüreceğiz, sahiplenebileceğin tezler haline getireceğiz.",
    placeholder: "Örn: 'Çoğu erken aşama startup'ın asıl sorunu ürün değil, dağıtım. Engineer'lar bunu ürün kalitesiyle çözemez.'",
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
  {
    id: "generating-teaser",
    type: "loader" as const,
    part: 1,
    title: "Stratejin oluşturuluyor…",
    description: "Cevaplarını analiz ediyorum: ses profilin, içerik pillar'ların ve konumlandırma cümlen hazırlanıyor.",
  },
  // Part 1 reveal'ları KALDIRILDI — kullanıcının kendi yazdığını echo etmek yerine
  // tam stratejiyi Part 2 sonrasında AI ile gerçek bir kalite seviyesinde göstereceğiz.
  // generating-teaser → paywall (teaser persona arka planda kaydediliyor, post-paywall'da gerçek strateji)
  { id: "paywall", type: "paywall" as const, part: 1, title: "Personan hazır. Sıra tam stratejine.", description: "Konumlandırma + pillar'lar + ses profili + örnek post — Pro ile hepsi açılıyor." },
  // ─── Paywall sonrası — Part 2 ────────────────────────────────────────────
  // ÖNEMLİ: Kullanıcının Part 1'de verdiği bilgi zaten yeterli. Yeniden soru sormak
  // "aynı şeyleri tekrar soruyorsun" hissi yaratıyor ve inanılırlığı düşürüyor.
  // Bu yüzden Part 2 hızlı ve etkileyici: welcome → generating-full → 4 reveal → 3 hızlı setup → done.
  // PART2_QUESTIONS (hotTakes, cadence, antiposition, inspiration) + differentiator + goals
  // KALDIRILDI. AI zaten Part 1 cevaplarından çıkarım yapıyor.
  {
    id: "p2-intro",
    type: "message",
    part: 2,
    title: "Ödemen alındı. Şimdi sıra sende.",
    description: "Verdiğin bilgilerle tam stratejini AI ile derliyorum. Bir saniyede önündesin.",
  },
  { id: "generating-full", type: "loader" as const, part: 2, title: "Stratejin oluşturuluyor...", description: "Konumlandırma, pillar'lar, ses profili ve örnek post — hepsi seninkine özel." },
  { id: "reveal-full-positioning", type: "reveal" as const, part: 2, title: "İşte sen busun.", description: "Tam stratejin." },
  { id: "reveal-full-pillars", type: "reveal" as const, part: 2, title: "Pillar'ların", description: "Detaylı başlıklar." },
  { id: "reveal-full-voice", type: "reveal" as const, part: 2, title: "Ses profili", description: "Farklılaşma stratejisi." },
  { id: "reveal-full-sample", type: "reveal" as const, part: 2, title: "Örnek post", description: "Yayına hazır." },
  // Deep setup — kullanıcıyı bağla, AI entegrasyonu sonraki sürümde derinleşecek
  {
    id: "voice-calibrate",
    type: "input",
    part: 2,
    title: "Sesini kalibre edelim",
    description: "Geçmişte yazdığın 2-3 yazıyı yapıştır — AI sesini hassaslaştırsın. Boş bırakabilirsin.",
    placeholder: "Önceki yazılarından örnekler...",
    validate: () => true,
  },
  {
    id: "first-content",
    type: "input",
    part: 2,
    title: "İlk içeriğini oluştur",
    description: "Mindfolio senin sesinde bir taslak yazsın. Konu yaz veya boş bırak.",
    placeholder: "İlk içerik konusu...",
    validate: () => true,
  },
  {
    id: "reminder-setup",
    type: "single",
    part: 2,
    title: "Hatırlatıcı kur",
    description: "İçerik üretmeyi unutmaman için ne sıklıkla hatırlatalım?",
    options: [
      { id: "daily", emoji: "🔔", label: "Her gün" },
      { id: "weekdays", emoji: "📅", label: "Hafta içi her gün" },
      { id: "weekly", emoji: "📆", label: "Haftada bir" },
      { id: "none", emoji: "✕", label: "Hatırlatma istemiyorum" },
    ],
    validate: () => true,
  },
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
  "linkedin-url": "",
  "import-content": "",
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

// ── Staged loader — "yaşayan" işliyor hissi (her ~1.5sn bir maddeyi tikler) ──

function LoaderStages({ c, stages }: { c: Palette; stages: string[] }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    setIdx(0);
    const t = setInterval(() => setIdx((i) => Math.min(i + 1, stages.length)), 1500);
    return () => clearInterval(t);
  }, [stages.join("|")]);

  return (
    <View style={{ width: "100%", gap: 8, marginTop: 4 }}>
      {stages.map((label, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10, opacity: done ? 1 : active ? 0.95 : 0.4 }}>
            <Text style={{ width: 18, color: done ? c.accent : c.text4, fontWeight: "700" }}>{done ? "✓" : active ? "›" : "·"}</Text>
            <Text style={{ flex: 1, fontSize: 13, color: done ? c.text1 : c.text2 }}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Marka logosu (V2) — onboarding kartlarında "✦" yerine kullanılır ──
// Sebep: ✦ four-pointed star Google Gemini sparkle'a benziyor; marka karışıklığını önle.

function MarkLogo({ c, size = 48 }: { c: Palette; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      <SvgRect width="26" height="26" rx="6.5" fill={c.mintBg} stroke={c.mintBorder} strokeWidth="1" />
      <SvgRect x="1.5" y="10.5" width="2" height="5" rx="1" fill={c.accent} opacity={0.55} />
      <SvgRect x="4.5" y="6.5" width="2" height="13" rx="1" fill={c.accent} opacity={0.85} />
      <SvgRect x="7.5" y="5" width="2" height="16" rx="1" fill={c.accent} />
      <SvgRect x="10.5" y="7" width="2" height="12" rx="1" fill={c.accent} opacity={0.7} />
      <SvgRect x="15" y="9.5" width="7" height="1.7" rx={0.85} fill={c.text1} opacity={0.55} />
      <SvgRect x="15" y="12.5" width="8.5" height="1.7" rx={0.85} fill={c.text1} opacity={0.45} />
      <SvgRect x="15" y="15.5" width="5.5" height="1.7" rx={0.85} fill={c.text1} opacity={0.38} />
    </Svg>
  );
}

// ── Onboarding paywall — design system'a uygun (Aylık + Yıllık, V2 logo, görsel header) ──

const ONB_MONTHLY = 249.99;
const ONB_YEARLY = 1899;
const ONB_SAVE_PCT = Math.round((1 - ONB_YEARLY / (ONB_MONTHLY * 12)) * 100); // 37

function OnboardingPaywall(props: {
  c: Palette;
  s: any;
  loading: boolean;
  selectedPlan: "monthly" | "yearly";
  onSelectPlan: (p: "monthly" | "yearly") => void;
  onSubscribe: () => void;
  onSkip: () => void;
  title: string;
  description?: string;
}) {
  const { c, s, loading, selectedPlan, onSelectPlan, onSubscribe, onSkip, title, description } = props;
  const floatA = useRef(new Animated.Value(0)).current;
  const floatC = useRef(new Animated.Value(0)).current;
  const bar1 = useRef(new Animated.Value(0.4)).current;
  const bar2 = useRef(new Animated.Value(0.4)).current;
  const bar3 = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = (v: Animated.Value, range: [number, number], dur: number, delay = 0) =>
      Animated.loop(Animated.sequence([
        Animated.timing(v, { toValue: range[1], duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: false, delay }),
        Animated.timing(v, { toValue: range[0], duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ]));
    loop(floatA, [0, -6], 2200).start();
    loop(floatC, [0, -8], 2600, 400).start();
    loop(bar1, [0.3, 1], 600).start();
    loop(bar2, [0.3, 1], 700, 120).start();
    loop(bar3, [0.3, 1], 800, 240).start();
  }, [floatA, floatC, bar1, bar2, bar3]);

  return (
    <View style={s.stepContent}>
      {/* Görsel header — LinkedIn/X kartları altta, AI yazıyor üstte */}
      <View style={{ width: "100%", height: 116, position: "relative", marginBottom: 14 }}>
        <View
          style={{
            position: "absolute",
            top: 4,
            alignSelf: "center",
            left: "50%",
            transform: [{ translateX: -64 }],
            width: 128,
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 12,
            backgroundColor: c.glassFill,
            borderWidth: 1,
            borderColor: c.glassBorder,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            zIndex: 3,
          }}
        >
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.accent }} />
          <Text style={{ fontSize: 11, fontWeight: "600", color: c.text2, flex: 1 }}>AI yazıyor</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 2, height: 12 }}>
            {[bar1, bar2, bar3].map((b, i) => (
              <Animated.View key={i} style={{ width: 2, height: 12, borderRadius: 1, backgroundColor: c.accent, transform: [{ scaleY: b }] }} />
            ))}
          </View>
        </View>
        <Animated.View
          style={{
            position: "absolute",
            bottom: 0,
            left: 12,
            width: 92,
            paddingVertical: 10,
            paddingHorizontal: 10,
            borderRadius: 12,
            backgroundColor: c.glassFill,
            borderWidth: 1,
            borderColor: c.glassBorder,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            transform: [{ translateY: floatA }],
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: "700", color: "#0a66c2", width: 18 }}>in</Text>
          <View style={{ gap: 4 }}>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: c.text4, width: 34 }} />
            <View style={{ height: 4, borderRadius: 2, backgroundColor: c.text4, width: 22 }} />
          </View>
        </Animated.View>
        <Animated.View
          style={{
            position: "absolute",
            bottom: 0,
            right: 12,
            width: 92,
            paddingVertical: 10,
            paddingHorizontal: 10,
            borderRadius: 12,
            backgroundColor: c.glassFill,
            borderWidth: 1,
            borderColor: c.glassBorder,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            transform: [{ translateY: floatC }],
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: "700", color: c.text1, width: 18 }}>X</Text>
          <View style={{ gap: 4 }}>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: c.text4, width: 28 }} />
            <View style={{ height: 4, borderRadius: 2, backgroundColor: c.text4, width: 18 }} />
          </View>
        </Animated.View>
      </View>

      {/* V2 logo — light variant */}
      <View style={{ alignItems: "center", marginBottom: 10 }}>
        <Svg width={30} height={30} viewBox="0 0 26 26" fill="none">
          <SvgRect width="26" height="26" rx="6.5" fill="rgba(5,150,105,0.09)" stroke="rgba(5,150,105,0.2)" strokeWidth="1" />
          <SvgRect x="1.5" y="10.5" width="2" height="5" rx="1" fill="#059669" opacity={0.55} />
          <SvgRect x="4.5" y="6.5" width="2" height="13" rx="1" fill="#059669" opacity={0.85} />
          <SvgRect x="7.5" y="5" width="2" height="16" rx="1" fill="#059669" />
          <SvgRect x="10.5" y="7" width="2" height="12" rx="1" fill="#059669" opacity={0.7} />
          <SvgRect x="15" y="9.5" width="7" height="1.7" rx={0.85} fill="#0a1409" opacity={0.58} />
          <SvgRect x="15" y="12.5" width="8.5" height="1.7" rx={0.85} fill="#0a1409" opacity={0.48} />
          <SvgRect x="15" y="15.5" width="5.5" height="1.7" rx={0.85} fill="#0a1409" opacity={0.4} />
        </Svg>
      </View>

      <Text style={[s.heading, { textAlign: "center" }]}>{title}</Text>
      {description ? <Text style={[s.body, { textAlign: "center", marginBottom: 14 }]}>{description}</Text> : null}

      {/* Plan seçim — yıllık önerilen, %37 indirim badge'i */}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 8, marginBottom: 14 }}>
        {(["yearly", "monthly"] as const).map((p) => {
          const active = selectedPlan === p;
          const isYearly = p === "yearly";
          return (
            <TouchableOpacity
              key={p}
              onPress={() => onSelectPlan(p)}
              activeOpacity={0.85}
              style={{
                flex: 1,
                paddingVertical: 18,
                paddingHorizontal: 10,
                borderRadius: 16,
                borderWidth: active ? 2 : 1,
                borderColor: active ? c.accent : c.glassBorder,
                backgroundColor: active ? c.accentGhost : c.glassFill,
                alignItems: "center",
                position: "relative",
              }}
            >
              {isYearly && (
                <View
                  style={{
                    position: "absolute",
                    top: -10,
                    alignSelf: "center",
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                    borderRadius: 999,
                    backgroundColor: c.accent,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: "700", color: "#fff", letterSpacing: 0.3 }}>%{ONB_SAVE_PCT} İNDİRİM</Text>
                </View>
              )}
              <Text style={{ fontSize: 9, fontWeight: "700", letterSpacing: 1, color: c.text4 }}>PRO</Text>
              <Text style={{ fontSize: 12, fontWeight: "600", color: active ? c.accent : c.text2, marginTop: 4 }}>
                {isYearly ? "YILLIK" : "AYLIK"}
              </Text>
              <Text style={{ fontSize: 22, fontWeight: "700", color: active ? c.accent : c.text1, marginTop: 8 }}>
                {isYearly ? "₺1.899" : "₺249,99"}
              </Text>
              <Text style={{ fontSize: 10, color: c.text4, marginTop: 6, textAlign: "center" }}>
                {isYearly ? "Yıllık fatura · ~₺158/ay" : "Aylık fatura"}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity style={[s.continueBtn, { marginTop: 4 }]} onPress={onSubscribe} disabled={loading} activeOpacity={0.85}>
        <Text style={s.continueText}>
          {loading ? "Hazırlanıyor..." : selectedPlan === "yearly" ? "Yıllık Aboneliği Başlat" : "Aylık Aboneliği Başlat"}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onSkip} style={{ marginTop: 12 }}>
        <Text style={{ color: c.text4, fontSize: 13, textAlign: "center", textDecorationLine: "underline" }}>
          Belki sonra — personamı kaydet
        </Text>
      </TouchableOpacity>
      <Text style={{ fontSize: 11, color: c.text4, textAlign: "center", marginTop: 10 }}>
        İstediğin zaman iptal et · Personan kaydedildi
      </Text>
    </View>
  );
}

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
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("yearly");
  // AI çağrısının sonucu: "ok" | "fallback" | null
  const [aiStatus, setAiStatus] = useState<"ok" | "fallback" | null>(null);
  const [aiErrorMsg, setAiErrorMsg] = useState<string>("");
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

  /**
   * Geri butonu — sadece kullanıcı-girdi adımlarında (multi/single/input).
   * Kural: AI sorgusundan (loader) SONRA gelen ilk kullanıcı-girdi adımına dönmek
   * yeni bir AI sorgusu tetikleyeceği için, back sadece bir önceki loader'ın
   * ÖNCESİNE kadar gidebilir. Yani back button, önceki loader'ı geçemez.
   */
  const canGoBack = useCallback((): boolean => {
    if (stepIndex === 0) return false;
    const cur = STEPS[stepIndex];
    if (!cur) return false;
    // Sadece bu adım türlerinde geri butonu göster
    if (!["multi", "single", "input"].includes(cur.type)) return false;
    // Bu adımdan geriye doğru bak; bir loader varsa önce ona takıl
    for (let i = stepIndex - 1; i >= 0; i--) {
      const s = STEPS[i];
      if (!s) break;
      if (s.type === "loader") return false; // AI sorgusu sonrası ilk ekrandayız
      if (["multi", "single", "input"].includes(s.type)) return true; // hedef bulundu
    }
    return false;
  }, [stepIndex]);

  const goBack = useCallback(() => {
    if (!canGoBack()) return;
    // Önceki kullanıcı-girdi adımına dön (warmup/message/motivation'ları atla)
    for (let i = stepIndex - 1; i >= 0; i--) {
      const s = STEPS[i];
      if (!s) break;
      if (s.type === "loader") return; // güvenlik
      if (["multi", "single", "input"].includes(s.type)) {
        setStepIndex(i);
        fadeTransition();
        return;
      }
    }
  }, [stepIndex, canGoBack]);

  const setAnswer = useCallback((key: keyof Answers, value: any) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Auto-advance — kullanıcıya okuma fırsatı için 7s
  useEffect(() => {
    if (step?.type === "warmup") {
      const t = setTimeout(goNext, 7000);
      return () => clearTimeout(t);
    }
    if (step?.type === "motivation") {
      const t = setTimeout(goNext, 7000);
      return () => clearTimeout(t);
    }
  }, [step?.id, step?.type]);

  // Generate teaser persona — minimum 5sn dramatic delay + fallback persona if AI fails
  useEffect(() => {
    if (step?.id === "generating-teaser") {
      setLoading(true);
      const startTs = Date.now();
      const MIN_MS = 7500; // staged messages (4 × 1.5s) tamamlansın diye min 7.5s
      const gLabel = GOAL_LABELS[answers.goal] ?? answers.goal;
      const fLabel = FIELD_LABELS[answers.field] ?? answers.field;
      const vLabel = answers.voiceTraits.map((v) => VOICE_LABELS[v] ?? v).join(", ");
      const aLabel = answers.audience.map((a: string) => AUDIENCE_LABELS[a] ?? a).join(", ");

      // 5.1 + 5.2 — yeni opsiyonel girdiler
      const linkedinUrl = (answers["linkedin-url"] || "").trim();
      const importExtra = (answers["import-content"] || "").trim();
      const combinedImport = [importExtra, answers.importedContent].filter(Boolean).join("\n\n").trim();

      // Fallback persona — AI çağrısı başarısız olursa kullanıcı verisinden zengin bir taslak üretir.
      // Pillar isimleri jenerik DEĞİL: alan + tutum + ses kombinasyonuna göre branded isimler.
      const fallbackPersona: PersonaProfile = (() => {
        const positioning = (answers.positioning || "").trim();
        const voiceLabels = (answers.voiceTraits ?? []).map((v) => VOICE_LABELS[v] ?? v).filter(Boolean);
        const audienceLabel = (answers.audience ?? []).map((x) => AUDIENCE_LABELS[x] ?? x).filter(Boolean).join(", ");
        const fieldKey = answers.field || "other";

        // Alana özel pillar setleri — branded, vivid, savunulabilir
        const pillarsByField: Record<string, { title: string; description: string }[]> = {
          tech: [
            { title: "Builder's Journal", description: "Geliştirirken aldığın kararlar, denediğin yaklaşımlar ve ders aldığın hatalar — ham, dürüst." },
            { title: "Tool Reality Check", description: "Yeni AI/dev araçlarını gerçekten kullanarak değerlendir; hype ile gerçek arasındaki farkı göster." },
            { title: "Türk Tech Sahnesi", description: "Yerel ekosistemden içeriden bakış: trendler, fırsatlar, ezberlenmiş ama yanlış kabuller." },
            { title: "Frameworks", description: "Karmaşık problemleri sadeleştiren karar şemaları — paylaşılabilir, kaydedilebilir, geri dönülen içerik." },
          ],
          business: [
            { title: "Executive Reality Check", description: "Klişe yönetim tavsiyelerini parçala. Senin yaşadığın sahadan örneklerle yeniden kur." },
            { title: "Founder Stories", description: "Kurucu olarak yaşadığın inişler, anlaşmazlıklar, kazanılan ve kaybedilen turlar — süslemesiz." },
            { title: "Strategy Unplugged", description: "Strateji jargonsuz nasıl anlatılır? Sahadan örneklerle." },
            { title: "Career Stories", description: "Kariyerinin dönüm noktaları — niye, nasıl, hangi pahasına." },
          ],
          creative: [
            { title: "Süreç Açık", description: "Yaratıcı süreci görünür kıl: brief'ten yayına, krizden çözüme — herkesin kapalı tuttuğunu aç." },
            { title: "Tarz Tarihi", description: "Bir tasarım/medya akımının kökeni ve bugün nasıl yankılandığı — eğitici, paylaşılır." },
            { title: "Eleştiri Notu", description: "İzlediğin/okuduğun/baktığın işler üzerine 'neden işe yaradı/yaramadı' analizleri." },
          ],
          science: [
            { title: "Sahanın İçinden", description: "Bilimsel literatürün arkasındaki insan hikayesi, deney gerçeği, başarısızlığın değeri." },
            { title: "Anlaşılır Bilim", description: "Karmaşık bir kavramı 200 kelimede anlat — uzmanın sade tarafını ortaya çıkar." },
            { title: "Klinik/Saha Notları", description: "Bilim ile gerçek dünya arasındaki sürtünme noktaları, gözlemler, ders alınanlar." },
          ],
          finance: [
            { title: "Sayıların Arkası", description: "Tablolar ve oranlar değil, kararın hikayesi: neyi, neden, hangi varsayımla yaptın?" },
            { title: "Mit Yıkımı", description: "Finans dünyasında yaygın ama yanlış olan kabulleri kanıtla yık. Tek mit, tek post." },
            { title: "Risk Düşüncesi", description: "Risk ve fırsatı anlatan vaka çalışmaları — emin değil, dürüst." },
          ],
          other: [
            { title: "Saha Notları", description: "Yaptığın işten içeride neler oluyor — kimsenin paylaşmadığı taraf." },
            { title: "Karar Anları", description: "Hayatının dönüm noktaları ve onları nasıl yönettiğin." },
            { title: "Aykırı Düşünce", description: "Alanında doğru kabul edilen ama senin sorguladığın şey." },
          ],
        };

        // Konumlandırma cümlesi — kullanıcı yazdıysa onunla; yazmadıysa cevaplardan dokunmuş bir cümle
        const fallbackPositioning =
          positioning ||
          `${fLabel || "Alanında"} ${voiceLabels.length ? voiceLabels.slice(0, 2).join(" ve ").toLowerCase() : "deneyimli"} biriyim; ${audienceLabel || "alanımdaki profesyonellere"} ${gLabel ? gLabel.toLowerCase() : "değer üretmek"} için içerik üretiyorum.`;

        // Örnek post — kullanıcının positioning + ilk pillar üzerinden gerçek bir hook
        const firstPillar = (pillarsByField[fieldKey] ?? pillarsByField.other)[0];
        const samplePost =
          [
            `${firstPillar.title} — bugünden bir not:`,
            "",
            positioning
              ? `${positioning}`
              : `${fLabel || "Bu alanda"} çalışırken fark ettiğim şey şu: çoğunluk doğru bilineni tekrar ediyor.`,
            "",
            "Geçen hafta bir konuda farklı düşünmem gereken bir an oldu. Eski refleks: 'herkes böyle yapıyor, doğrudur.' Yeni refleks: 'durup soralım — gerçekten işe yarıyor mu?'",
            "",
            "Sonuç: ezberden değil, gözlemden konuşmak çok daha pahalı ama çok daha kalıcı.",
            "",
            "(Bu yalnızca taslak — tam strateji oluştuğunda senin sesinle yeniden yazacağız.)",
          ].join("\n");

        return {
          purpose: gLabel || "",
          topics: [],
          professional_background: "",
          linkedin_url: linkedinUrl || "",
          demographics: { industry: fLabel || "", role: "", experience: "" },
          tone: {
            style: voiceLabels.slice(0, 2).join(" + ") || "Samimi ve doğrudan",
            formality: "Yarı resmi",
            humor: "Hafif",
            voice: "Birinci tekil şahıs, deneyime dayalı.",
          },
          writing_samples: [],
          values: ["Dürüstlük", "Pragmatizm", "Süreklilik"],
          audience: audienceLabel || "Alanımdaki profesyoneller",
          positioning_statement: fallbackPositioning,
          pillars: pillarsByField[fieldKey] ?? pillarsByField.other,
          voice_profile: voiceLabels.length ? voiceLabels : ["Samimi", "Doğrudan"],
          differentiation: {
            do: ["Gerçek vakalardan örnek ver", "Net bir bakış al", "Süreci açık paylaş"],
            dont: ["Klişe motivasyon yazma", "Jargon arkasına saklanma", "Herkesi memnun etmeye çalışma"],
          },
          sample_post: samplePost,
          suggested_platforms: ["LinkedIn", "X (Twitter)", "Substack"],
          cadence: "Haftada 2-3 gönderi",
        };
      })();

      const finish = (profile: PersonaProfile | null, status: "ok" | "fallback", errMsg = "") => {
        const persisted = profile ?? fallbackPersona;
        setPersonaData(persisted);
        setAiStatus(status);
        setAiErrorMsg(errMsg);
        // Fallback durumunda da persona'yı Supabase'e yaz — profil boş kalmasın,
        // "belki sonra" seçilirse yarım strateji görünsün.
        if (status === "fallback") {
          authedFetch("/api/personas", {
            method: "PUT",
            body: JSON.stringify({
              name: (gLabel || "My Persona").slice(0, 60),
              profile: persisted,
              onboarding_complete: false,
            }),
          }).catch(() => {});
        }
        const elapsed = Date.now() - startTs;
        const delay = Math.max(MIN_MS - elapsed, 300);
        setTimeout(() => { setLoading(false); goNext(); }, delay);
      };

      authedFetch("/api/ai/analyze-persona", {
        method: "POST",
        body: JSON.stringify({
          goal: gLabel,
          field: fLabel,
          hasContent: answers.hasContent,
          voiceTraits: vLabel,
          audience: aLabel,
          positioning: answers.positioning,
          linkedinUrl: linkedinUrl || undefined,
          importedContent: combinedImport || undefined,
        }),
      })
        .then(async (r) => {
          const data = await r.json().catch(() => ({}));
          if (!r.ok) {
            const msg = data?.error || `HTTP ${r.status}`;
            // eslint-disable-next-line no-console
            console.warn("[teaser] AI fail:", r.status, msg);
            finish(null, "fallback", msg);
            return;
          }
          if (data?.profile) {
            const profileWithLinkedin = linkedinUrl ? { ...data.profile, linkedin_url: linkedinUrl } : data.profile;
            authedFetch("/api/personas", {
              method: "PUT",
              body: JSON.stringify({
                name: gLabel.slice(0, 60) || "My Persona",
                profile: profileWithLinkedin,
                onboarding_complete: false,
              }),
            }).catch(() => {});
            finish(profileWithLinkedin, "ok");
          } else {
            // eslint-disable-next-line no-console
            console.warn("[teaser] AI dönüşü profile içermiyor:", data);
            finish(null, "fallback", "AI boş yanıt döndü");
          }
        })
        .catch((e) => {
          // eslint-disable-next-line no-console
          console.warn("[teaser] AI network error:", e?.message ?? e);
          finish(null, "fallback", e?.message || "Bağlantı hatası");
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

      const linkedinUrl = (answers["linkedin-url"] || "").trim();
      const importExtra = (answers["import-content"] || "").trim();
      const voiceCalibrate = (answers["voice-calibrate"] || "").trim();
      const combinedImport = [importExtra, voiceCalibrate, answers.importedContent].filter(Boolean).join("\n\n").trim();

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
          linkedinUrl: linkedinUrl || undefined,
          importedContent: combinedImport || undefined,
        }),
      })
        .then(async (r) => {
          const data = await r.json().catch(() => ({}));
          if (!r.ok) {
            // eslint-disable-next-line no-console
            console.warn("[full] AI fail:", r.status, data?.error);
            setAiStatus("fallback");
            setAiErrorMsg(data?.error || `HTTP ${r.status}`);
            return;
          }
          if (data?.profile) {
            setPersonaData(data.profile);
            setAiStatus("ok");
            setAiErrorMsg("");
            authedFetch("/api/personas", {
              method: "PUT",
              body: JSON.stringify({
                name: gLabel.slice(0, 60) || "My Persona",
                profile: data.profile,
                onboarding_complete: false,
              }),
            }).catch(() => {});
          } else {
            // eslint-disable-next-line no-console
            console.warn("[full] AI dönüşü boş:", data);
            setAiStatus("fallback");
            setAiErrorMsg("AI boş yanıt döndü");
          }
        })
        .catch((e) => {
          // eslint-disable-next-line no-console
          console.warn("[full] AI network error:", e?.message ?? e);
          setAiStatus("fallback");
          setAiErrorMsg(e?.message || "Bağlantı hatası");
        })
        .finally(() => {
          setLoading(false);
          setTimeout(goNext, 600);
        });
    }
  }, [step?.id]);

  // Paywall → subscribe (Aylık ₺249,99 / Yıllık ₺1.899 — kullanıcı seçimine göre)
  const handleSubscribe = async () => {
    setLoading(true);
    await authedFetch("/api/personas", {
      method: "PUT",
      body: JSON.stringify({ subscription: { active: true, plan: selectedPlan, mock: true, subscribed_at: new Date().toISOString() } }),
    }).catch(() => {});
    setSubscribed(true);
    setLoading(false);
    // Jump to Part 2 (paying user → derin strateji için Part 2)
    const p2 = STEPS.findIndex((s) => s.part === 2);
    setStepIndex(p2);
    fadeTransition();
  };

  // Paywall skip ("belki sonra") → Part 2 pas geçilir + onboarding tamamlanır → Studio.
  // Kullanıcı stratejisini ödeme yapmadan görüp deneyimlemeye başlayacak;
  // profil "Ücretsiz" state ile yarım strateji + Pro'ya Geç göstermeli.
  const handleSkipPaywall = async () => {
    setLoading(true);
    try {
      // KRİTİK: persona satırının var olduğundan emin ol (AI fail olduysa bile personaData dolu),
      // ardından onboarding_complete=true yaz. Aksi halde Gate persona'yı bulamayıp onboarding'i baştan başlatır.
      const bodyToSend: Record<string, unknown> = {
        name: (GOAL_LABELS[answers.goal] ?? answers.goal ?? "My Persona").slice(0, 60),
        onboarding_complete: true,
      };
      if (personaData) bodyToSend.profile = personaData;
      const res = await authedFetch("/api/personas", {
        method: "PUT",
        body: JSON.stringify(bodyToSend),
      });
      if (!res.ok) {
        // eslint-disable-next-line no-console
        console.warn("[skip-paywall] PUT persona başarısız:", res.status);
      } else {
        // eslint-disable-next-line no-console
        console.info("[skip-paywall] Persona kaydedildi + onboarding_complete:true");
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[skip-paywall] PUT persona exception:", e);
    }
    setLoading(false);
    onComplete(); // → App.tsx Gate → AppTabs (Studio)
  };

  // Done → complete (+ reminder + voice-calibrate + first-content kalıcılaştır)
  useEffect(() => {
    if (step?.id === "done") {
      const reminder = answers["reminder-setup"] || "";
      const voiceSample = (answers["voice-calibrate"] || "").trim();
      const firstContentTopic = (answers["first-content"] || "").trim();
      // Persona setup alanına reminder + writing_samples ekle
      const personaPatch: Record<string, unknown> = { onboarding_complete: true };
      if (reminder || voiceSample) {
        personaPatch.profile = {
          ...(reminder ? { setup: { reminder } } : {}),
          ...(voiceSample ? { writing_samples: [voiceSample] } : {}),
        };
      }
      authedFetch("/api/personas", {
        method: "PUT",
        body: JSON.stringify(personaPatch),
      }).catch(() => {});
      // first-content varsa içeriği oluştur (basit taslak; AI sonra zenginleştirir)
      if (firstContentTopic) {
        authedFetch("/api/content", {
          method: "POST",
          body: JSON.stringify({
            title: firstContentTopic.slice(0, 80),
            body: "",
            source: "text",
            status: "draft",
          }),
        }).catch(() => {});
      }
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
      {/* Header — [← Geri] · Part etiketi · adım sayısı · Çıkış */}
      <View style={s.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          {canGoBack() ? (
            <TouchableOpacity
              onPress={goBack}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 999,
                backgroundColor: c.glassFill,
                borderWidth: 1,
                borderColor: c.glassBorder,
              }}
            >
              <Text style={{ fontSize: 12, color: c.accent, fontWeight: "700" }}>← Geri</Text>
            </TouchableOpacity>
          ) : null}
          <Text style={s.partLabel}>Part {step?.part ?? 1}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Text style={s.stepCount}>
            {STEPS.filter((s) => s.part === (step?.part ?? 1)).findIndex((s) => s.id === step?.id) + 1}
            /{STEPS.filter((s) => s.part === (step?.part ?? 1)).length}
          </Text>
          <TouchableOpacity
            onPress={async () => {
              const ok = await confirmAsync(
                "Oturumu sıfırla?",
                "Çıkış yapacaksın. Giriş ekranına döneceksin ve yeniden kayıt olabilir ya da farklı bir hesapla devam edebilirsin.",
                { confirmLabel: "Çıkış yap", cancelLabel: "Vazgeç" }
              );
              if (!ok) return;
              try { await supabase.auth.signOut(); } catch { /* ignore */ }
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={{ fontSize: 11, color: c.text4, textDecorationLine: "underline" }}>Çıkış</Text>
          </TouchableOpacity>
        </View>
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
        {/* Motivation — 7s otomatik geçer, ama tıklarsan hemen geçer */}
        {step?.type === "motivation" && (
          <TouchableOpacity activeOpacity={0.85} onPress={goNext}>
            <View style={s.centerContent}>
              <Text style={s.emojiLarge}>💬</Text>
              <Text style={s.motivationTitle}>{step.title}</Text>
              <Text style={s.motivationDesc}>{step.description}</Text>
              <Text style={s.tapHint}>Otomatik geçer · tıklayarak atla</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Generic message (welcome dışındaki tüm "message" tipleri için) */}
        {step?.type === "message" && step.id !== "welcome" && (
          <View style={s.centerContent}>
            <View style={{ marginBottom: 16 }}><MarkLogo c={c} size={56} /></View>
            <Text style={s.heading}>{step.title}</Text>
            <Text style={s.body}>{step.description}</Text>
            <TouchableOpacity style={[s.continueBtn, { marginTop: 20, alignSelf: "stretch" }]} onPress={goNext} activeOpacity={0.85}>
              <Text style={s.continueText}>Devam →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Welcome */}
        {step?.id === "welcome" && (
          <View style={s.centerContent}>
            <View style={{ marginBottom: 16 }}><MarkLogo c={c} size={56} /></View>
            <Text style={s.heading}>{step.title}</Text>
            <Text style={s.body}>{step.description}</Text>

            <View style={s.codeWrap}>
              <Text style={s.codeLb}>Davet / promo kodun var mı? <Text style={{ color: c.text4 }}>(opsiyonel)</Text></Text>
              <View style={s.codeRow}>
                <TextInput
                  style={s.codeInput}
                  value={inviteCode}
                  onChangeText={(v) => setInviteCode(v.toUpperCase())}
                  placeholder="KOD"
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

            {/* Devam butonu — kod boş veya geçersiz olsa bile geçilebilir */}
            <TouchableOpacity style={[s.continueBtn, { marginTop: 20, alignSelf: "stretch" }]} onPress={goNext} activeOpacity={0.85}>
              <Text style={s.continueText}>Sorulara Başla →</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={goNext} style={{ marginTop: 10 }}>
              <Text style={[s.body, { fontSize: 12, color: c.text4, textAlign: "center" }]}>Kodun yoksa atla</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Warmup — 7s otomatik geçer, tıkla erken geç */}
        {step?.type === "warmup" && warmupInfo && (
          <TouchableOpacity activeOpacity={0.9} onPress={goNext}>
            <View style={s.centerContent}>
              <View style={s.pulse}>
                <View style={s.pulseInner} />
              </View>
              <Text style={s.warmupTitle}>{warmupInfo.title}</Text>
              <Text style={s.warmupDesc}>{warmupInfo.desc}</Text>
              <Text style={s.tapHint}>Devam etmek için tıkla</Text>
            </View>
          </TouchableOpacity>
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
            {/* Devam butonu footer'da render edilir — burada tekrar etmiyoruz */}
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

        {/* Loader — staged messages + V2 logo + spinner */}
        {step?.type === "loader" && (
          <View style={s.centerContent}>
            <View style={{ marginBottom: 18 }}><MarkLogo c={c} size={64} /></View>
            <Text style={s.heading}>{step.title}</Text>
            <Text style={s.body}>{step.description}</Text>
            <View style={{ marginTop: 18, marginBottom: 18 }}>
              <ActivityIndicator size="small" color={c.accent} />
            </View>
            <LoaderStages c={c} stages={
              step.id === "generating-teaser"
                ? ["Cevapların analiz ediliyor", "Ses profilin çıkarılıyor", "İçerik pillar'ları taslaklanıyor", "Konumlandırma cümlen yazılıyor"]
                : step.id === "generating-full"
                  ? ["Part 1 verilerin birleştiriliyor", "Aykırı görüşlerin işleniyor", "Pillar'lar derinleştiriliyor", "Örnek post yazılıyor"]
                  : step.id === "warmup-enrich"
                    ? ["Profil verilerin okunuyor", "Tonun haritalanıyor", "Tema kümeleri çıkarılıyor"]
                    : ["İşliyorum", "Birazdan…"]
            } />
          </View>
        )}

        {/* Reveal — personaData null olsa bile yine render et (akış kilitlenmesin) */}
        {step?.type === "reveal" && (
          <View style={s.stepContent}>
            <Text style={s.emojiLarge}>
              {step.id.includes("pillar") ? "📚" : step.id.includes("voice") ? "🎯" : step.id.includes("sample") ? "✍️" : "📍"}
            </Text>
            <Text style={s.heading}>{step.title}</Text>
            <Text style={s.body}>{step.description}</Text>
            {/* AI fail durumu görünür — kullanıcı fallback'i AI zannetmesin */}
            {aiStatus === "fallback" && (
              <View style={{
                marginTop: 10, padding: 12, borderRadius: 12,
                backgroundColor: c.amberGhost, borderWidth: 1, borderColor: c.amberBorder,
              }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: c.amber, marginBottom: 4 }}>AI şu an ulaşılamıyor</Text>
                <Text style={{ fontSize: 12, color: c.text2, lineHeight: 17 }}>
                  Aşağıda geçici bir taslak gösteriliyor. Profil ekranında &ldquo;AI ile Yeniden Üret&rdquo; ile gerçek stratejini oluşturabilirsin.
                  {aiErrorMsg ? `\n\nHata: ${aiErrorMsg}` : ""}
                </Text>
              </View>
            )}
            {step.id.includes("positioning") && (
              <View style={s.highlightCard}>
                <Text style={s.italicText}>
                  &ldquo;{personaData?.positioning_statement ?? "Konumlandırma cümlen birazdan hazır olacak."}&rdquo;
                </Text>
              </View>
            )}
            {step.id.includes("pillar") && (
              <View style={{ gap: 8 }}>
                {((personaData?.pillars ?? []) as { title: string; description: string }[]).map((p, i) => (
                  <View key={i} style={s.pillarCard}>
                    <Text style={s.pillarTitle}>{i + 1}. {p.title}</Text>
                    <Text style={s.pillarDesc}>{p.description}</Text>
                  </View>
                ))}
                {(!personaData?.pillars || personaData.pillars.length === 0) && (
                  <Text style={s.body}>Pillar'ların bir sonraki adımda hazırlanıyor.</Text>
                )}
              </View>
            )}
            {step.id.includes("voice") && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {((personaData?.voice_profile ?? []) as string[]).map((t) => (
                  <View key={t} style={s.tag}>
                    <Text style={s.tagText}>{t}</Text>
                  </View>
                ))}
                {(!personaData?.voice_profile || personaData.voice_profile.length === 0) && (
                  <Text style={s.body}>Ses profilin işleniyor.</Text>
                )}
              </View>
            )}
            {step.id.includes("sample") && (
              <View style={s.sampleCard}>
                <Text style={s.sampleText}>
                  {personaData?.sample_post ?? "Örnek post tam strateji üretildikten sonra senin sesinle yazılacak."}
                </Text>
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

        {/* Paywall — Aylık ₺249,99 / Yıllık ₺1.899 (%37 indirim), V2 logo, görsel header */}
        {step?.type === "paywall" && (
          <OnboardingPaywall
            c={c}
            s={s}
            loading={loading}
            selectedPlan={selectedPlan}
            onSelectPlan={setSelectedPlan}
            onSubscribe={handleSubscribe}
            onSkip={handleSkipPaywall}
            title={step.title}
            description={step.description}
          />
        )}

        {/* Done */}
        {step?.type === "done" && (
          <View style={s.centerContent}>
            <View style={{ marginBottom: 16 }}><MarkLogo c={c} size={64} /></View>
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
  tapHint: { fontSize: 11, color: c.text4, textAlign: "center", marginTop: 18, letterSpacing: 0.5, textTransform: "uppercase" },
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
