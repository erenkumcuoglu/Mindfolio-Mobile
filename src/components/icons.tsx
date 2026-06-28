/**
 * SVG icons ported 1:1 from the Mindfolio "App Screens v2" mockup.
 * Requires react-native-svg (expo install react-native-svg).
 */
import Svg, { Path, Rect, Circle, Line } from "react-native-svg";

type IconProps = { size?: number; color?: string };

/** Big mic glyph for the record hero (mockup lines 71–76). */
export function MicHeroIcon({ size = 24, color = "#fff" }: { size?: number; color?: string }) {
  const h = (size / 24) * 32;
  return (
    <Svg width={size} height={h} viewBox="0 0 28 36" fill="none">
      <Path d="M14 2a6 6 0 016 6v10a6 6 0 01-12 0V8a6 6 0 016-6z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M2 18v2a12 12 0 0024 0v-2" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1="14" y1="32" x2="14" y2="36" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1="8" y1="36" x2="20" y2="36" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

/** Small mic glyph for recording cards (mockup line 94). */
export function MicSmallIcon({ size = 14, color }: IconProps) {
  const w = (size / 14) * 11;
  return (
    <Svg width={w} height={size} viewBox="0 0 11 14" fill="none">
      <Path d="M5.5 1a2.5 2.5 0 012.5 2.5v5a2.5 2.5 0 01-5 0v-5A2.5 2.5 0 015.5 1z" stroke={color} strokeWidth={1.3} />
      <Path d="M1 7.5v.5a4.5 4.5 0 009 0v-.5" stroke={color} strokeWidth={1.3} strokeLinecap="round" />
    </Svg>
  );
}

/** "Metin Yaz" lines icon (mockup line 83). */
export function TextLinesIcon({ size = 13, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Path d="M2 3h10M2 7h7M2 11h9" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

/** "Dosya Yükle" upload icon (mockup line 84). */
export function UploadIcon({ size = 13, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Path d="M7 2v8M4 7l3 3 3-3" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M2 12h10" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

/** Free-tier lock badge icon (mockup line 115). */
export function LockIcon({ size = 11, color }: IconProps) {
  const w = (size / 13) * 11;
  return (
    <Svg width={w} height={size} viewBox="0 0 11 13" fill="none">
      <Rect x="1.5" y="5.5" width="8" height="7" rx="1.5" stroke={color} strokeWidth={1.3} />
      <Path d="M3.5 5.5V4A2 2 0 017.5 4v1.5" stroke={color} strokeWidth={1.3} strokeLinecap="round" />
    </Svg>
  );
}

/** Search glyph for the Ideas screen. */
export function SearchIcon({ size = 13, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 13 13" fill="none">
      <Circle cx="5.5" cy="5.5" r="4" stroke={color} strokeWidth={1.4} />
      <Path d="M9 9l3 3" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

/** Document outline for the Content empty state. */
export function DocIcon({ size = 26, color }: IconProps) {
  const h = (size / 26) * 32;
  return (
    <Svg width={size} height={h} viewBox="0 0 26 32" fill="none">
      <Path d="M3 4a2 2 0 012-2h12l6 6v20a2 2 0 01-2 2H5a2 2 0 01-2-2V4z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M17 2v8h6" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8 15h10M8 20h7M8 25h8" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

/** Lightbulb outline for the Ideas empty state. */
export function BulbIcon({ size = 24, color }: IconProps) {
  const h = (size / 24) * 32;
  return (
    <Svg width={size} height={h} viewBox="0 0 24 32" fill="none">
      <Path d="M12 2a9 9 0 019 9c0 4-2.3 7.4-5.7 9.1V24H8.7V20.1C5.3 18.4 3 15 3 11a9 9 0 019-9z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M8.7 24h6.6M9.3 27.5h5.4" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

/* ── Island tab-bar icons (mockup lines 606–619) ── */

export function TabStudioIcon({ size = 22, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      <Path d="M11 2a3.5 3.5 0 013.5 3.5v5A3.5 3.5 0 017.5 10.5v-5A3.5 3.5 0 0111 2z" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M5 10v1a6 6 0 0012 0v-1" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Line x1="11" y1="17" x2="11" y2="20" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

export function TabContentIcon({ size = 22, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      <Rect x="3" y="3" width="16" height="16" rx="2.5" stroke={color} strokeWidth={1.5} />
      <Path d="M7 8h8M7 11h5M7 14h6" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

export function TabIdeasIcon({ size = 22, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      <Path d="M11 3a5 5 0 015 5c0 2.2-1.3 4.1-3.2 5V16H9.2V13A5 5 0 0111 3z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9.2 16h3.6M9.8 18.5h2.4" stroke={color} strokeWidth={1.3} strokeLinecap="round" />
    </Svg>
  );
}

export function TabProfileIcon({ size = 22, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      <Circle cx="11" cy="8" r="3.5" stroke={color} strokeWidth={1.5} />
      <Path d="M3.5 19c0-4.1 3.4-7.5 7.5-7.5s7.5 3.4 7.5 7.5" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}
