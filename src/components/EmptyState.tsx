import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { radii, type Palette } from "../theme/tokens";

interface Props {
  icon: React.ReactNode;
  title: string;
  motiv: string;
  ctaLabel: string;
  onCta?: () => void;
}

/** Centered empty-state: mint glass icon, title, motivation, emerald CTA. */
export function EmptyState({ icon, title, motiv, ctaLabel, onCta }: Props) {
  const { c } = useTheme();
  const styles = makeStyles(c);
  return (
    <View style={styles.center}>
      <View style={styles.icon}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.motiv}>{motiv}</Text>
      <TouchableOpacity style={styles.cta} activeOpacity={0.85} onPress={onCta}>
        <Text style={styles.ctaText}>{ctaLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    center: { alignItems: "center", justifyContent: "center", paddingVertical: 64, paddingHorizontal: 24 },
    icon: {
      width: 68,
      height: 68,
      borderRadius: 20,
      backgroundColor: c.mintBg,
      borderWidth: 1,
      borderColor: c.mintBorder,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 20,
    },
    title: { fontSize: 18, fontWeight: "700", letterSpacing: -0.5, color: c.text1, textAlign: "center", marginBottom: 10 },
    motiv: { fontSize: 14, color: c.text3, textAlign: "center", lineHeight: 21, marginBottom: 24 },
    cta: { paddingHorizontal: 22, paddingVertical: 13, borderRadius: radii.btn, backgroundColor: c.accent },
    ctaText: { fontSize: 15, fontWeight: "600", color: "#fff" },
  });
}
