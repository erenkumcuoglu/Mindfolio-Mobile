import { useEffect, useRef } from "react";
import { View, Animated, Easing, StyleSheet } from "react-native";

interface Props {
  color: string;
  bars?: number;
  height?: number;
  width?: number | string;
}

/**
 * Always-on, gently breathing equalizer wave (idle/decorative).
 * Uses scaleY transforms (native-driver friendly) so it animates continuously
 * without blocking JS. Each bar runs its own staggered loop.
 */
export function AnimatedWave({ color, bars = 11, height = 40, width = "70%" }: Props) {
  const vals = useRef(Array.from({ length: bars }, () => new Animated.Value(0.3))).current;

  useEffect(() => {
    const loops = vals.map((v, i) => {
      const peak = 0.5 + ((i * 37) % 50) / 100; // pseudo-random peak per bar
      return Animated.loop(
        Animated.sequence([
          Animated.delay((i % 5) * 90),
          Animated.timing(v, { toValue: peak, duration: 520 + (i % 4) * 110, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.22, duration: 520 + (i % 3) * 130, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      );
    });
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [vals]);

  return (
    <View style={[styles.row, { height, width: width as number }]}>
      {vals.map((v, i) => (
        <Animated.View
          key={i}
          style={{
            flex: 1,
            marginHorizontal: 2,
            height,
            borderRadius: 999,
            backgroundColor: color,
            opacity: 0.85,
            transform: [{ scaleY: v }],
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
});
