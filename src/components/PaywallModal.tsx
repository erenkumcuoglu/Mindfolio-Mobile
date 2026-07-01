import { useEffect, useRef, useState } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable, Animated, Easing } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { useTheme } from "../theme/ThemeContext";
import { radii, type Palette } from "../theme/tokens";

interface Props {
  visible: boolean;
  onClose: () => void;
}

type Plan = "monthly" | "yearly";

// Paywall pricing (Türkiye, App Store IAP — Apple Pay TR'de mevcut değil).
// Aylık ₺249,99 · Yıllık ₺1.899 (12 ay × 249,99 = 2.999,88 → ~%37 indirim).
const MONTHLY_PRICE = 249.99;
const YEARLY_PRICE = 1899;
const YEARLY_SAVE_PCT = Math.round((1 - YEARLY_PRICE / (MONTHLY_PRICE * 12)) * 100); // 37

const PLANS: { key: Plan; period: string; price: string; note: string; save?: string }[] = [
  { key: "yearly", period: "YILLIK", price: "₺1.899", note: "Yıllık fatura · ~₺158/ay", save: `%${YEARLY_SAVE_PCT} İNDİRİM` },
  { key: "monthly", period: "AYLIK", price: "₺249,99", note: "Aylık fatura" },
];

const BTN_LABEL: Record<Plan, string> = {
  monthly: "Aylık Aboneliği Başlat",
  yearly: "Yıllık Aboneliği Başlat",
};

/**
 * V2 logo — light variant.
 * Outer rect: açık emerald fill + ince border. CLAUDE.md spec.
 */
function PaywallLogo({ size = 30 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      <Rect width="26" height="26" rx="6.5" fill="rgba(5,150,105,0.09)" stroke="rgba(5,150,105,0.2)" strokeWidth="1" />
      <Rect x="1.5" y="10.5" width="2" height="5" rx="1" fill="#059669" opacity={0.55} />
      <Rect x="4.5" y="6.5" width="2" height="13" rx="1" fill="#059669" opacity={0.85} />
      <Rect x="7.5" y="5" width="2" height="16" rx="1" fill="#059669" />
      <Rect x="10.5" y="7" width="2" height="12" rx="1" fill="#059669" opacity={0.7} />
      <Rect x="15" y="9.5" width="7" height="1.7" rx={0.85} fill="#0a1409" opacity={0.58} />
      <Rect x="15" y="12.5" width="8.5" height="1.7" rx={0.85} fill="#0a1409" opacity={0.48} />
      <Rect x="15" y="15.5" width="5.5" height="1.7" rx={0.85} fill="#0a1409" opacity={0.4} />
    </Svg>
  );
}

/** Görsel header: LinkedIn/X kartları altta + AI yazıyor kartı üstte (kullanıcı isteği). */
function VisualHeader({ c }: { c: Palette }) {
  const floatA = useRef(new Animated.Value(0)).current;
  const floatC = useRef(new Animated.Value(0)).current;
  const bar1 = useRef(new Animated.Value(0.4)).current;
  const bar2 = useRef(new Animated.Value(0.4)).current;
  const bar3 = useRef(new Animated.Value(0.4)).current;
  const styles = makeStyles(c);

  useEffect(() => {
    const loop = (val: Animated.Value, range: [number, number], dur: number, delay = 0) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(val, { toValue: range[1], duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: false, delay }),
          Animated.timing(val, { toValue: range[0], duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        ])
      );
    loop(floatA, [0, -6], 2200).start();
    loop(floatC, [0, -8], 2600, 400).start();
    loop(bar1, [0.3, 1], 600).start();
    loop(bar2, [0.3, 1], 700, 120).start();
    loop(bar3, [0.3, 1], 800, 240).start();
  }, [floatA, floatC, bar1, bar2, bar3]);

  return (
    <View style={styles.vhWrap}>
      {/* AI yazıyor — ÜSTTE (kullanıcı isteği: LinkedIn/X'in yukarısına çıksın) */}
      <View style={styles.vhAI}>
        <View style={styles.vhAIDot} />
        <Text style={styles.vhAIText}>AI yazıyor</Text>
        <View style={styles.vhBars}>
          <Animated.View style={[styles.vhBar, { transform: [{ scaleY: bar1 }] }]} />
          <Animated.View style={[styles.vhBar, { transform: [{ scaleY: bar2 }] }]} />
          <Animated.View style={[styles.vhBar, { transform: [{ scaleY: bar3 }] }]} />
        </View>
      </View>
      {/* LinkedIn — sol alt */}
      <Animated.View style={[styles.vhCard, styles.vhCardLi, { transform: [{ translateY: floatA }] }]}>
        <Text style={styles.vhPlat}>in</Text>
        <View style={styles.vhLines}>
          <View style={[styles.vhLine, { width: 34 }]} />
          <View style={[styles.vhLine, { width: 22 }]} />
        </View>
      </Animated.View>
      {/* X — sağ alt */}
      <Animated.View style={[styles.vhCard, styles.vhCardX, { transform: [{ translateY: floatC }] }]}>
        <Text style={styles.vhPlatX}>X</Text>
        <View style={styles.vhLines}>
          <View style={[styles.vhLine, { width: 28 }]} />
          <View style={[styles.vhLine, { width: 18 }]} />
        </View>
      </Animated.View>
    </View>
  );
}

export function PaywallModal({ visible, onClose }: Props) {
  const { c } = useTheme();
  const styles = makeStyles(c);
  const [plan, setPlan] = useState<Plan>("yearly");

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />

          <VisualHeader c={c} />

          <View style={styles.logoRow}>
            <PaywallLogo size={30} />
          </View>

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
      paddingTop: 12,
      paddingBottom: 40,
      alignItems: "center",
    },
    handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: c.text4, marginBottom: 6 },

    // Görsel header
    vhWrap: { width: "100%", height: 116, position: "relative", marginTop: 4 },
    vhAI: {
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
    },
    vhAIDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.accent },
    vhAIText: { fontSize: 11, fontWeight: "600", color: c.text2, flex: 1 },
    vhBars: { flexDirection: "row", alignItems: "center", gap: 2, height: 12 },
    vhBar: { width: 2, height: 12, borderRadius: 1, backgroundColor: c.accent },

    vhCard: {
      position: "absolute",
      bottom: 0,
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
    },
    vhCardLi: { left: 12 },
    vhCardX: { right: 12 },
    vhPlat: { fontSize: 14, fontWeight: "700", color: "#0a66c2", width: 18 },
    vhPlatX: { fontSize: 14, fontWeight: "700", color: c.text1, width: 18 },
    vhLines: { gap: 4 },
    vhLine: { height: 4, borderRadius: 2, backgroundColor: c.text4 },

    logoRow: { marginTop: 8, marginBottom: 10 },

    h2: { fontSize: 24, fontWeight: "700", letterSpacing: -0.6, color: c.text1, textAlign: "center" },
    sub: { fontSize: 14, color: c.text3, marginTop: 6, marginBottom: 24 },

    plans: { flexDirection: "row", gap: 10, width: "100%", marginBottom: 20 },
    planCard: {
      flex: 1,
      paddingVertical: 18,
      paddingHorizontal: 10,
      borderRadius: radii.card,
      backgroundColor: c.glassFill,
      borderWidth: 1,
      borderColor: c.glassBorder,
      alignItems: "center",
      position: "relative",
    },
    planCardActive: { borderColor: c.accent, backgroundColor: c.accentGhost },
    saveBadge: { position: "absolute", top: -10, alignSelf: "center", paddingHorizontal: 10, paddingVertical: 3, borderRadius: radii.pill, backgroundColor: c.accent },
    saveBadgeText: { fontSize: 10, fontWeight: "700", color: "#fff", letterSpacing: 0.3 },
    planTop: { fontSize: 9, fontWeight: "700", letterSpacing: 1, color: c.text4 },
    planPeriod: { fontSize: 12, fontWeight: "600", color: c.text2, marginTop: 4 },
    planPrice: { fontSize: 22, fontWeight: "700", color: c.text1, marginTop: 8 },
    planNote: { fontSize: 10, color: c.text4, marginTop: 6, textAlign: "center" },

    subBtn: { width: "100%", paddingVertical: 16, borderRadius: 14, backgroundColor: c.accent, alignItems: "center" },
    subBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
    notNow: { fontSize: 14, color: c.text3, marginTop: 14 },
    cancelNote: { fontSize: 12, color: c.text4, marginTop: 10 },
    stars: { fontSize: 13, color: c.warning, marginTop: 12, letterSpacing: 2 },
  });
}
