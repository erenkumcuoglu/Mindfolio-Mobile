import { useState } from "react";
import { View, StyleSheet } from "react-native";
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

export default function AppTabs({ onLogout }: Props) {
  const { c } = useTheme();
  const [tab, setTab] = useState<TabKey>("studio");
  const [recording, setRecording] = useState(false);
  const [uploadRec, setUploadRec] = useState<RecordingResult | null>(null);
  const [resumeDirect, setResumeDirect] = useState(false);

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

  return (
    <View style={[styles.root, { backgroundColor: c.page }]}>
      {tab === "studio" && (
        <StudioScreen
          onStartRecording={() => { setUploadRec(null); setResumeDirect(false); setRecording(true); }}
          onUploadAudio={(rec) => { setUploadRec(rec); setResumeDirect(false); setRecording(true); }}
          onResumeDraft={() => { setUploadRec(null); setResumeDirect(true); setRecording(true); }}
        />
      )}
      {tab === "content" && <ContentScreen />}
      {tab === "ideas" && <IdeasScreen />}
      {tab === "profile" && <ProfileScreen onLogout={onLogout} />}

      <IslandTabBar active={tab} onChange={setTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
