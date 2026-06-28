import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { palettes, type Palette } from "./tokens";

type Scheme = "light" | "dark";

interface ThemeValue {
  c: Palette;
  scheme: Scheme;
  toggle: () => void;
  setScheme: (s: Scheme) => void;
}

const STORAGE_KEY = "mf-theme";
const ThemeContext = createContext<ThemeValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Light-first: light is the default. Dark only if the user explicitly chose
  // it. System preference is NOT followed.
  const [scheme, setSchemeState] = useState<Scheme>("light");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v === "light" || v === "dark") setSchemeState(v);
    });
  }, []);

  const setScheme = useCallback((s: Scheme) => {
    setSchemeState(s);
    AsyncStorage.setItem(STORAGE_KEY, s).catch(() => {});
  }, []);

  const toggle = useCallback(() => {
    setSchemeState((prev) => {
      const next: Scheme = prev === "dark" ? "light" : "dark";
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ c: palettes[scheme], scheme, toggle, setScheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
