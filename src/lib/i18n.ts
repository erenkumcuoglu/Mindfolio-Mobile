import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { NativeModules, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Bilingual (tr/en) strings. Language is auto-detected from the OS, can be
 * overridden by the user (persisted), and is reactive via <LanguageProvider> +
 * useT()/useLang(). A static `t` (OS default) is kept for non-React usage.
 */
export type Lang = "tr" | "en";
const STORE_KEY = "mindfolio.lang";

function osLang(): Lang {
  try {
    // Native locale detection — iOS ve Android'de doğru cihaz dilini oku.
    // navigator.language RN'de yoktur; web'de kalan bir fallback.
    let raw = "";
    if (Platform.OS === "ios") {
      const settings = (NativeModules as any).SettingsManager?.settings;
      raw = settings?.AppleLocale || settings?.AppleLanguages?.[0] || "";
    } else if (Platform.OS === "android") {
      raw = (NativeModules as any).I18nManager?.localeIdentifier || "";
    } else {
      const nav = (globalThis as unknown as { navigator?: { language?: string; languages?: readonly string[] } }).navigator;
      raw = nav?.language || nav?.languages?.[0] || Intl.DateTimeFormat().resolvedOptions().locale || "tr";
    }
    if (!raw) raw = "tr";
    // "en-US", "en_US", "en" → "en"; "tr", "tr-TR" → "tr"; herhangi başka dil → İngilizce
    const two = String(raw).slice(0, 2).toLowerCase();
    return two === "tr" ? "tr" : "en";
  } catch {
    return "tr";
  }
}

type Strings = {
  // Nav
  studioTitle: string; studioDesc: string;
  contentTitle: string; contentDesc: string;
  ideasTitle: string; ideasDesc: string;
  profileDesc: string;
  tagline: string;
  language: string; langTurkish: string; langEnglish: string;

  // Studio
  studioProduce: string; studioStart: string; studioTalkPrompt: string;
  studioTextWrite: string; studioAudioUpload: string;
  studioRecentTitle: string; studioEmptyTitle: string; studioEmptyDesc: string;
  studioFreeBadgeFmt: string; studioFreeBadgeFull: string;

  // Content
  contentEmptyTitle: string; contentEmptyDesc: string;
  contentSaveDraft: string; contentSaving: string;

  // Ideas
  ideasEmptyTitle: string; ideasEmptyDesc: string; ideasCta: string;
  ideasAddNew: string; ideasSearch: string;

  // Profile
  profilePro: string; profileFree: string; profileGoPro: string; profileLogout: string;

  // Common
  cancel: string; save: string; edit: string; delete: string; done: string;
};

const TR: Strings = {
  studioTitle: "Stüdyo", studioDesc: "Sesini içeriğe dönüştür",
  contentTitle: "İçerikler", contentDesc: "Tüm taslakların ve içeriklerin",
  ideasTitle: "Fikirler", ideasDesc: "İlham kaynakların",
  profileDesc: "Profilin ve stratejin",
  tagline: "Sesini içeriğe dönüştür",
  language: "Dil", langTurkish: "Türkçe", langEnglish: "English",

  studioProduce: "İçerik Üret", studioStart: "Kayıt Başlat",
  studioTalkPrompt: "Konuş, biz yazıya çevirelim",
  studioTextWrite: "Metin Yaz", studioAudioUpload: "Ses Dosyası Yükle",
  studioRecentTitle: "Son Kayıtlar",
  studioEmptyTitle: "İlk içeriğin bir tık uzakta.",
  studioEmptyDesc: "Mikrofona basıp doğal konuş — Mindfolio sesini içeriğe dönüştürür.",
  studioFreeBadgeFmt: "Ücretsiz · 30sn limit · {n} hak kaldı",
  studioFreeBadgeFull: "Ücretsiz · 30sn limit · Limit doldu",

  contentEmptyTitle: "Henüz içerik yok",
  contentEmptyDesc: "Stüdyo'dan bir kayıt yap, taslakların burada birikecek.",
  contentSaveDraft: "Taslağı Kaydet", contentSaving: "Kaydediliyor…",

  ideasEmptyTitle: "Henüz fikir yok",
  ideasEmptyDesc: "Bir bağlantı veya not ekle — ilham kaynakların burada görünsün.",
  ideasCta: "Fikir Ekle →", ideasAddNew: "Yeni Fikir", ideasSearch: "Fikirlerde ara…",

  profilePro: "Pro", profileFree: "Ücretsiz", profileGoPro: "Pro'ya Geç →", profileLogout: "Çıkış",

  cancel: "Vazgeç", save: "Kaydet", edit: "Düzenle", delete: "Sil", done: "Tamam",
};

const EN: Strings = {
  studioTitle: "Studio", studioDesc: "Turn your voice into content",
  contentTitle: "Content", contentDesc: "All your drafts and content",
  ideasTitle: "Ideas", ideasDesc: "Your inspiration sources",
  profileDesc: "Your profile and strategy",
  tagline: "Turn your voice into content",
  language: "Language", langTurkish: "Türkçe", langEnglish: "English",

  studioProduce: "Create Content", studioStart: "Start Recording",
  studioTalkPrompt: "Speak, we'll write it down",
  studioTextWrite: "Write Text", studioAudioUpload: "Upload Audio",
  studioRecentTitle: "Recent Recordings",
  studioEmptyTitle: "Your first piece is one tap away.",
  studioEmptyDesc: "Tap the mic and speak naturally — Mindfolio turns your voice into content.",
  studioFreeBadgeFmt: "Free · 30s limit · {n} left",
  studioFreeBadgeFull: "Free · 30s limit · Limit reached",

  contentEmptyTitle: "No content yet",
  contentEmptyDesc: "Record something in the Studio — your drafts will collect here.",
  contentSaveDraft: "Save Draft", contentSaving: "Saving…",

  ideasEmptyTitle: "No ideas yet",
  ideasEmptyDesc: "Add a link or note — your inspiration sources will show up here.",
  ideasCta: "Add Idea →", ideasAddNew: "New Idea", ideasSearch: "Search ideas…",

  profilePro: "Pro", profileFree: "Free", profileGoPro: "Go Pro →", profileLogout: "Sign out",

  cancel: "Cancel", save: "Save", edit: "Edit", delete: "Delete", done: "Done",
};

const DICT: Record<Lang, Strings> = { tr: TR, en: EN };

// Backward-compatible static export (OS default) for non-React code paths.
export const isTR = osLang() !== "en";
export const t: Strings = isTR ? TR : EN;

interface LangContextValue { lang: Lang; setLang: (l: Lang) => void; t: Strings; }
const LangContext = createContext<LangContextValue>({ lang: isTR ? "tr" : "en", setLang: () => {}, t });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(osLang());

  useEffect(() => {
    AsyncStorage.getItem(STORE_KEY).then((v) => {
      if (v === "tr" || v === "en") setLangState(v);
    }).catch(() => {});
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(STORE_KEY, l).catch(() => {});
  };

  return React.createElement(LangContext.Provider, { value: { lang, setLang, t: DICT[lang] } }, children);
}

export function useT(): Strings {
  return useContext(LangContext).t;
}

export function useLang(): { lang: Lang; setLang: (l: Lang) => void } {
  const { lang, setLang } = useContext(LangContext);
  return { lang, setLang };
}
