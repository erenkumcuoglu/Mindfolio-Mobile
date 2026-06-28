import { Fragment } from "react";
import { View, Text, StyleSheet, type TextStyle } from "react-native";
import { useTheme } from "../theme/ThemeContext";
import type { Palette } from "../theme/tokens";

/** Inline parser: **bold**, __bold__, *italic*, _italic_. */
function renderInline(text: string, c: Palette, baseStyle?: TextStyle) {
  const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g).filter((s) => s.length > 0);
  return parts.map((tok, i) => {
    if ((tok.startsWith("**") && tok.endsWith("**")) || (tok.startsWith("__") && tok.endsWith("__"))) {
      return <Text key={i} style={[baseStyle, { fontWeight: "700", color: c.text1 }]}>{tok.slice(2, -2)}</Text>;
    }
    if ((tok.startsWith("*") && tok.endsWith("*")) || (tok.startsWith("_") && tok.endsWith("_"))) {
      return <Text key={i} style={[baseStyle, { fontStyle: "italic" }]}>{tok.slice(1, -1)}</Text>;
    }
    return <Fragment key={i}>{tok}</Fragment>;
  });
}

/** Minimal Markdown renderer for generated drafts (headings, bold, italics,
 *  blockquotes, bullets, "Başlık N:" title lines). */
export function Markdown({ text }: { text: string }) {
  const { c } = useTheme();
  const s = makeStyles(c);
  const lines = (text ?? "").replace(/\r/g, "").split("\n");

  return (
    <View>
      {lines.map((raw, i) => {
        const line = raw.trimEnd();
        if (!line.trim()) return <View key={i} style={s.gap} />;

        const h = line.match(/^(#{1,6})\s+(.*)$/);
        if (h) {
          const level = h[1].length;
          const style = level <= 1 ? s.h1 : level === 2 ? s.h2 : s.h3;
          return <Text key={i} style={style}>{renderInline(h[2], c, style)}</Text>;
        }
        if (/^>\s?/.test(line)) {
          return (
            <View key={i} style={s.quote}>
              <Text style={s.quoteText}>{renderInline(line.replace(/^>\s?/, ""), c, s.quoteText)}</Text>
            </View>
          );
        }
        if (/^Başlık\s*\d+\s*:/i.test(line)) {
          return <Text key={i} style={s.titleOpt}>{line}</Text>;
        }
        if (/^[-*•]\s+/.test(line)) {
          return (
            <View key={i} style={s.bulletRow}>
              <Text style={s.bulletDot}>•</Text>
              <Text style={s.body}>{renderInline(line.replace(/^[-*•]\s+/, ""), c, s.body)}</Text>
            </View>
          );
        }
        return <Text key={i} style={s.body}>{renderInline(line, c, s.body)}</Text>;
      })}
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    gap: { height: 10 },
    h1: { fontSize: 21, fontWeight: "800", color: c.text1, letterSpacing: -0.4, marginTop: 6, marginBottom: 6, lineHeight: 28 },
    h2: { fontSize: 18, fontWeight: "700", color: c.text1, letterSpacing: -0.3, marginTop: 6, marginBottom: 5, lineHeight: 25 },
    h3: { fontSize: 15.5, fontWeight: "700", color: c.text1, marginTop: 4, marginBottom: 4, lineHeight: 22 },
    body: { fontSize: 14.5, color: c.text1, lineHeight: 22 },
    titleOpt: { fontSize: 15, fontWeight: "700", color: c.accent, lineHeight: 24, marginBottom: 2 },
    quote: { borderLeftWidth: 3, borderLeftColor: c.accent, paddingLeft: 12, marginVertical: 4 },
    quoteText: { fontSize: 14.5, color: c.text2, fontStyle: "italic", lineHeight: 22 },
    bulletRow: { flexDirection: "row", gap: 8, paddingRight: 8 },
    bulletDot: { fontSize: 14.5, color: c.accent, lineHeight: 22 },
  });
}
