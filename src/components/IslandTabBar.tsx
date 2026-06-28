import { useEffect, useRef } from "react";
import { View, TouchableOpacity, Animated, Easing, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../theme/ThemeContext";
import { TabStudioIcon, TabContentIcon, TabIdeasIcon, TabProfileIcon } from "./icons";

export type TabKey = "studio" | "content" | "ideas" | "profile";

const TABS: { key: TabKey; Icon: typeof TabStudioIcon }[] = [
  { key: "studio", Icon: TabStudioIcon },
  { key: "content", Icon: TabContentIcon },
  { key: "ideas", Icon: TabIdeasIcon },
  { key: "profile", Icon: TabProfileIcon },
];

const TAB_W = 54; // tab width
const TAB_GAP = 2; // gap between tabs
const STEP = TAB_W + TAB_GAP;

interface Props {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}

/** Shared floating glass island tab bar with a sliding active "bubble". */
export function IslandTabBar({ active, onChange }: Props) {
  const { c } = useTheme();
  const activeIndex = Math.max(0, TABS.findIndex((t) => t.key === active));
  const x = useRef(new Animated.Value(activeIndex * STEP)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(x, { toValue: activeIndex * STEP, useNativeDriver: true, friction: 9, tension: 120 }),
      Animated.sequence([
        Animated.timing(scale, { toValue: 0.86, duration: 90, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 140 }),
      ]),
    ]).start();
  }, [activeIndex, x, scale]);

  return (
    <>
      <View style={[styles.island, { backgroundColor: c.islandBg, borderColor: c.islandBorder }]}>
        {/* Glass sheen overlay */}
        <LinearGradient
          colors={["rgba(255,255,255,0.16)", "rgba(255,255,255,0.02)", "rgba(255,255,255,0.0)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.sheen}
          pointerEvents="none"
        />

        {/* Sliding active bubble */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.bubble,
            {
              backgroundColor: c.mintBg,
              borderColor: c.mintBorder,
              shadowColor: c.accent,
              transform: [{ translateX: x }, { scale }],
            },
          ]}
        />

        {TABS.map(({ key, Icon }) => {
          const isActive = key === active;
          return (
            <TouchableOpacity
              key={key}
              style={styles.tab}
              activeOpacity={0.7}
              accessibilityLabel={key}
              onPress={() => onChange(key)}
            >
              <Icon color={isActive ? c.accent : c.tabInactive} />
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={[styles.homeBar, { backgroundColor: c.homeIndicator }]} />
    </>
  );
}

const styles = StyleSheet.create({
  island: {
    position: "absolute",
    bottom: 22,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: TAB_GAP,
    padding: 7,
    borderRadius: 28,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  sheen: { position: "absolute", top: 0, left: 0, right: 0, height: "55%" },
  bubble: {
    position: "absolute",
    left: 7,
    top: 7,
    width: TAB_W,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  tab: { width: TAB_W, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  homeBar: {
    position: "absolute",
    bottom: 8,
    alignSelf: "center",
    width: 134,
    height: 5,
    borderRadius: 3,
  },
});
