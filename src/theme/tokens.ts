/**
 * Mindfolio Design System v1.0 — mobile tokens.
 * Two palettes (dark-first + light), plus theme-independent scale.
 * Consumed through ThemeContext (useTheme); no logic here.
 */

export const darkColors = {
  bg: "#0a0f0a",
  bgVoid: "#050807",
  surface: "#0c1610",
  surfaceElevated: "#121e15",

  border: "rgba(255,255,255,0.09)",
  borderStrong: "rgba(255,255,255,0.14)",

  mintBg: "rgba(16,185,129,0.08)",
  mintBorder: "rgba(16,185,129,0.22)",

  accent: "#10b981",
  accentDeep: "#059669",
  accentText: "#34d399",
  accentGhost: "rgba(16,185,129,0.08)",
  onAccent: "#ffffff",

  text1: "#f0f0ee",
  text2: "rgba(240,240,238,0.65)",
  text3: "rgba(240,240,238,0.42)",
  text4: "rgba(240,240,238,0.24)",

  success: "#10b981",
  warning: "#fbbf24",
  error: "#f87171",
  info: "#7dd3fc",

  page: "#0a0f0a",
  glassFill: "rgba(255,255,255,0.054)",
  glassBorder: "rgba(255,255,255,0.09)",
  glassFillStrong: "rgba(255,255,255,0.08)",
  islandBg: "rgba(0,0,0,0.75)",
  islandBorder: "rgba(255,255,255,0.06)",
  tabInactive: "rgba(255,255,255,0.45)",
  amber: "#f59e0b",
  amberGhost: "rgba(245,158,11,0.08)",
  amberBorder: "rgba(245,158,11,0.22)",
  homeIndicator: "rgba(255,255,255,0.42)",

  appleBg: "#ffffff",
  appleText: "#0a0a0a",
};

export type Palette = typeof darkColors;

export const lightColors: Palette = {
  // Neutral iOS-style light surface (matches App Screens v2 light theme: #F2F2F7).
  bg: "#F2F2F7",
  bgVoid: "#e8e8ed",
  surface: "#ffffff",
  surfaceElevated: "#f7f7fa",

  border: "rgba(0,0,0,0.08)",
  borderStrong: "rgba(0,0,0,0.14)",

  mintBg: "rgba(5,150,105,0.07)",
  mintBorder: "rgba(5,150,105,0.2)",

  accent: "#059669",
  accentDeep: "#047857",
  accentText: "#047857",
  accentGhost: "rgba(5,150,105,0.08)",
  onAccent: "#ffffff",

  text1: "#0a0a0a",
  text2: "rgba(10,10,10,0.65)",
  text3: "rgba(10,10,10,0.44)",
  text4: "rgba(10,10,10,0.28)",

  success: "#059669",
  warning: "#d97706",
  error: "#dc2626",
  info: "#0284c7",

  page: "#F2F2F7",
  glassFill: "#ffffff",
  glassBorder: "rgba(0,0,0,0.06)",
  glassFillStrong: "#ffffff",
  islandBg: "rgba(255,255,255,0.9)",
  islandBorder: "rgba(0,0,0,0.06)",
  tabInactive: "rgba(0,0,0,0.35)",
  amber: "#d97706",
  amberGhost: "rgba(217,119,6,0.08)",
  amberBorder: "rgba(217,119,6,0.22)",
  homeIndicator: "rgba(0,0,0,0.24)",

  appleBg: "#0a0a0a",
  appleText: "#ffffff",
};

export const palettes = { light: lightColors, dark: darkColors };

/** Back-compat: default (dark) palette for any not-yet-themed screen. */
export const colors = darkColors;

export const radii = {
  sm: 10,
  btn: 12,
  card: 18,
  pill: 999,
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 36,
} as const;

export const typography = {
  display: { fontSize: 34, fontWeight: "700" as const, letterSpacing: -1 },
  h1: { fontSize: 28, fontWeight: "700" as const, letterSpacing: -0.6 },
  h2: { fontSize: 20, fontWeight: "600" as const, letterSpacing: -0.3 },
  bodyLg: { fontSize: 17, fontWeight: "400" as const, lineHeight: 28 },
  body: { fontSize: 15, fontWeight: "400" as const, lineHeight: 24 },
  caption: { fontSize: 12, fontWeight: "400" as const },
} as const;

export const cardShadow = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 16,
  elevation: 4,
} as const;
