import { useRef, useState } from "react";
import { View, StyleSheet, Animated, PanResponder, Dimensions } from "react-native";
import { useTheme } from "../theme/ThemeContext";
import type { RecordingResult } from "../lib/recorder";
import { IslandTabBar, type TabKey } from "../components/IslandTabBar";
import StudioScreen from "./StudioScreen";
import ContentScreen from "./ContentScreen";
import IdeasScreen from "./IdeasScreen";
import ProfileScreen from "./ProfileScreen";
import RecordingFlow from "./RecordingFlow";

interface Props {
  onLogout: () => void;
}

const TABS: TabKey[] = ["studio", "content", "ideas", "profile"];
const { width: SCREEN_W } = Dimensions.get("window");

/**
 * Instagram tarzı swipe navigasyon — 4 ekran yan yana render edilir, PanResponder
 * translateX'i güncelledikçe hem mevcut hem hedef ekran birlikte kayar. Threshold
 * aşınca spring ile snap; tab bar tıklamasında da aynı yumuşak geçiş uygulanır.
 * Bu, "eski ekran kayıp yeni pop-in" hissini ortadan kaldırır.
 */
export default function AppTabs({ onLogout }: Props) {
  const { c } = useTheme();
  const [tab, setTab] = useState<TabKey>("studio");
  const [recording, setRecording] = useState(false);
  const [uploadRec, setUploadRec] = useState<RecordingResult | null>(null);
  const [resumeDirect, setResumeDirect] = useState(false);

  // KRİTİK: PanResponder useRef ile bir kez oluşuyor → içinde `tab` state closure
  // olarak yakalanır ve hep ilk render'daki değer olur (Studio→Content'ten sonra
  // sonsuza kadar Studio'da kalır sanır). Bu yüzden ref ile canlı tutuyoruz.
  const tabRef = useRef<TabKey>("studio");
  const baseX = useRef(new Animated.Value(0)).current;

  const goToTab = (next: TabKey) => {
    const nextIdx = TABS.indexOf(next);
    // Tab bar (bubble) senk için: setTab'i spring'ten ÖNCE tetikle → anında güncellensin.
    tabRef.current = next;
    setTab(next);
    Animated.spring(baseX, {
      toValue: -nextIdx * SCREEN_W,
      useNativeDriver: true,
      friction: 14,
      tension: 100,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_e, g) => {
        const idx = TABS.indexOf(tabRef.current);
        const atLeftEdge = idx === 0 && g.dx > 0;
        const atRightEdge = idx === TABS.length - 1 && g.dx < 0;
        const damped = atLeftEdge || atRightEdge ? g.dx * 0.3 : g.dx;
        baseX.setValue(-idx * SCREEN_W + damped);
      },
      onPanResponderRelease: (_e, g) => {
        const THRESHOLD = SCREEN_W * 0.22;
        const idx = TABS.indexOf(tabRef.current);
        if (g.dx < -THRESHOLD && idx < TABS.length - 1) {
          goToTab(TABS[idx + 1]);
        } else if (g.dx > THRESHOLD && idx > 0) {
          goToTab(TABS[idx - 1]);
        } else {
          Animated.spring(baseX, {
            toValue: -idx * SCREEN_W,
            useNativeDriver: true,
            friction: 14,
            tension: 100,
          }).start();
        }
      },
    }),
  ).current;

  // Recording flow is full-screen and hides the tab bar.
  if (recording) {
    return (
      <View style={[styles.root, { backgroundColor: c.page }]}>
        <RecordingFlow
          initialUpload={uploadRec}
          resumeDirect={resumeDirect}
          onExit={() => { setRecording(false); setUploadRec(null); setResumeDirect(false); }}
        />
      </View>
    );
  }

  // 4 ekran yan yana. width = SCREEN_W * 4, translateX ile hangisi görünecek seçilir.
  return (
    <View style={[styles.root, { backgroundColor: c.page }]}>
      <Animated.View
        style={[
          styles.strip,
          {
            width: SCREEN_W * TABS.length,
            transform: [{ translateX: baseX }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={[styles.panel, { width: SCREEN_W }]}>
          <StudioScreen
            onStartRecording={() => { setUploadRec(null); setResumeDirect(false); setRecording(true); }}
            onUploadAudio={(rec) => { setUploadRec(rec); setResumeDirect(false); setRecording(true); }}
            onResumeDraft={() => { setUploadRec(null); setResumeDirect(true); setRecording(true); }}
          />
        </View>
        <View style={[styles.panel, { width: SCREEN_W }]}>
          <ContentScreen />
        </View>
        <View style={[styles.panel, { width: SCREEN_W }]}>
          <IdeasScreen />
        </View>
        <View style={[styles.panel, { width: SCREEN_W }]}>
          <ProfileScreen onLogout={onLogout} />
        </View>
      </Animated.View>

      <IslandTabBar active={tab} onChange={goToTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  strip: { flex: 1, flexDirection: "row" },
  panel: { flex: 1 },
});
