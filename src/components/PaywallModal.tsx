import { useState } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { radii, type Palette } from "../theme/tokens";

interface Props {
  visible: boolean;
  onClose: () => void;
}

type Plan = "weekly" | "yearly" | "monthly";

const PLANS: { key: Plan; period: string; price: string; note: string; save?: string }[] = [
  { key: "weekly", period: "HAFTALIK", price: "₺89,99", note: "Haftalık fatura" },
  { key: "yearly", period: "YILLIK", price: "₺1.699", note: "Yıllık fatura", save: "SAVE 43%" },
  { key: "monthly", period: "AYLIK", price: "₺249,99", note: "Aylık fatura" },
];

const BTN_LABEL: Record<Plan, string> = {
  weekly: "Haftalık Aboneliği Başlat",
  yearly: "Yıllık Aboneliği Başlat",
  monthly: "Aylık Aboneliği Başlat",
};

export function PaywallModal({ visible, onClose }: Props) {
  const { c } = useTheme();
  const styles = makeStyles(c);
  const [plan, setPlan] = useState<Plan>("yearly");

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.proBadge}><Text style={styles.proBadgeText}>PRO</Text></View>
          <Text style={styles.h2}>Sınırsız İçerik Üretimi</Text>
          <Text style={styles.sub}>Stratejini tam güce taşı.</Text>

          <View style={styles.plans}>
            {PLANS.map((p) => {
              const selected = plan === p.key;
              return (
                <TouchableOpacity
                  key={p.key}
                  style={[styles.planCard, selected && styles.planCardActive]}
                  activeOpacity={0.85}
                  onPress={() => setPlan(p.key)}
                >
                  {p.save && (
                    <View style={styles.saveBadge}><Text style={styles.saveBadgeText}>{p.save}</Text></View>
                  )}
                  <Text style={styles.planTop}>PRO</Text>
                  <Text style={[styles.planPeriod, selected && { color: c.accent }]}>{p.period}</Text>
                  <Text style={[styles.planPrice, selected && { color: c.accent }]}>{p.price}</Text>
                  <Text style={styles.planNote}>{p.note}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={styles.subBtn} activeOpacity={0.85} onPress={onClose}>
            <Text style={styles.subBtnText}>{BTN_LABEL[plan]}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.notNow}>Şimdi değil</Text>
          </TouchableOpacity>
          <Text style={styles.cancelNote}>İstediğin zaman iptal et.</Text>
          <Text style={styles.stars}>★ ★ ★ ★ ★</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: c.bg,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 22,
      paddingTop: 28,
      paddingBottom: 40,
      alignItems: "center",
    },
    proBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: radii.pill, backgroundColor: c.accentGhost, borderWidth: 1, borderColor: c.mintBorder, marginBottom: 14 },
    proBadgeText: { fontSize: 11, fontWeight: "700", letterSpacing: 1, color: c.accent },
    h2: { fontSize: 24, fontWeight: "700", letterSpacing: -0.6, color: c.text1, textAlign: "center" },
    sub: { fontSize: 14, color: c.text3, marginTop: 6, marginBottom: 24 },

    plans: { flexDirection: "row", gap: 8, width: "100%", marginBottom: 20 },
    planCard: {
      flex: 1,
      paddingVertical: 16,
      paddingHorizontal: 8,
      borderRadius: radii.card,
      backgroundColor: c.glassFill,
      borderWidth: 1,
      borderColor: c.glassBorder,
      alignItems: "center",
      position: "relative",
    },
    planCardActive: { borderColor: c.accent, backgroundColor: c.accentGhost },
    saveBadge: { position: "absolute", top: -9, alignSelf: "center", paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.pill, backgroundColor: c.accent },
    saveBadgeText: { fontSize: 9, fontWeight: "700", color: "#fff", letterSpacing: 0.3 },
    planTop: { fontSize: 9, fontWeight: "700", letterSpacing: 1, color: c.text4 },
    planPeriod: { fontSize: 11, fontWeight: "600", color: c.text2, marginTop: 4 },
    planPrice: { fontSize: 18, fontWeight: "700", color: c.text1, marginTop: 6 },
    planNote: { fontSize: 9, color: c.text4, marginTop: 4, textAlign: "center" },

    subBtn: { width: "100%", paddingVertical: 16, borderRadius: 14, backgroundColor: c.accent, alignItems: "center" },
    subBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
    notNow: { fontSize: 14, color: c.text3, marginTop: 14 },
    cancelNote: { fontSize: 12, color: c.text4, marginTop: 10 },
    stars: { fontSize: 13, color: c.warning, marginTop: 12, letterSpacing: 2 },
  });
}
