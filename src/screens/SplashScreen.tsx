import { useEffect, useRef } from "react";
import { View, Text, Animated, Easing, StyleSheet } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { useTheme } from "../theme/ThemeContext";
import { AnimatedWave } from "../components/AnimatedWave";
import { useT } from "../lib/i18n";
import { typography, type Palette } from "../theme/tokens";

function Mark({ c, size = 72 }: { c: Palette; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      <Rect width="26" height="26" rx="6.5" fill={c.mintBg} stroke={c.mintBorder} strokeWidth="1" />
      <Rect x="3" y="10.5" width="2.4" height="5" rx="1.2" fill={c.accent} opacity={0.55} />
      <Rect x="7" y="6.5" width="2.4" height="13" rx="1.2" fill={c.accent} opacity={0.85} />
      <Rect x="11" y="5" width="2.4" height="16" rx="1.2" fill={c.accent} />
      <Rect x="15" y="8" width="2.4" height="10" rx="1.2" fill={c.accent} opacity={0.7} />
      <Rect x="19" y="10.5" width="2.4" height="5" rx="1.2" fill={c.accent} opacity={0.5} />
    </Svg>
  );
}

/** Animated launch splash. Fades/scales the brand in, then calls onDone. */
export default function SplashScreen({ onDone }: { onDone?: () => void }) {
  const { c } = useTheme();
  const t = useT();
  const styles = makeStyles(c);
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.86)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 480, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }),
    ]).start();
    if (onDone) {
      const id = setTimeout(onDone, 1500);
      return () => clearTimeout(id);
    }
  }, [fade, scale, onDone]);

  return (
    <View style={styles.root}>
      <Animated.View style={{ alignItems: "center", opacity: fade, transform: [{ scale }] }}>
        <Mark c={c} />
        <Text style={styles.brand}>mindfolio</Text>
        <Text style={styles.tag}>{t.tagline}</Text>
        <View style={styles.wave}>
          <AnimatedWave color={c.accent} bars={13} height={34} width={150} />
        </View>
      </Animated.View>
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.page, alignItems: "center", justifyContent: "center" },
    brand: { ...typography.display, color: c.text1, marginTop: 18 },
    tag: { ...typography.body, color: c.text3, marginTop: 4 },
    wave: { marginTop: 28, opacity: 0.9 },
  });
}
