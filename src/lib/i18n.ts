import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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
    const nav = (globalThis as unknown as { navigator?: { language?: string; languages?: readonly string[] } }).navigator;
    const raw = nav?.language || nav?.languages?.[0] || Intl.DateTimeFormat().resolvedOptions().locale || "tr";
    return String(raw).slice(0, 2).toLowerCase() === "en" ? "en" : "tr";
  } catch {
    return "tr";
  }
}

type Strings = {
  studioTitle: string; studioDesc: string;
  contentTitle: string; contentDesc: string;
  ideasTitle: string; ideasDesc: string;
  profileDesc: string;
  tagline: string;
  language: string; langTurkish: string; langEnglish: string;
};

const TR: Strings = {
  studioTitle: "Stüdyo", studioDesc: "Sesini içeriğe dönüştür",
  contentTitle: "İçerikler", contentDesc: "Tüm taslakların ve içeriklerin",
  ideasTitle: "Fikirler", ideasDesc: "İlham kaynakların",
  profileDesc: "Profilin ve stratejin",
  tagline: "Sesini içeriğe dönüştür",
  language: "Dil", langTurkish: "Türkçe", langEnglish: "English",
};

const EN: Strings = {
  studioTitle: "Studio", studioDesc: "Turn your voice into content",
  contentTitle: "Content", contentDesc: "All your drafts and content",
  ideasTitle: "Ideas", ideasDesc: "Your inspiration sources",
  profileDesc: "Your profile and strategy",
  tagline: "Turn your voice into content",
  language: "Language", langTurkish: "Türkçe", langEnglish: "English",
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
