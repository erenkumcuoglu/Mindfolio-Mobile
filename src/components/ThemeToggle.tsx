import { TouchableOpacity, StyleSheet } from "react-native";
import Svg, { Circle, Path, Line } from "react-native-svg";
import { useTheme } from "../theme/ThemeContext";

interface Props {
  style?: object;
}

/** Corner sun/moon toggle. Tapping flips the persisted theme. */
export function ThemeToggle({ style }: Props) {
  const { c, scheme, toggle } = useTheme();
  const isDark = scheme === "dark";

  return (
    <TouchableOpacity
      onPress={toggle}
      activeOpacity={0.7}
      accessibilityLabel={isDark ? "Light temaya geç" : "Dark temaya geç"}
      style={[
        styles.btn,
        { backgroundColor: c.glassFill, borderColor: c.glassBorder },
        style,
      ]}
    >
      {isDark ? (
        <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
          <Circle cx="8" cy="8" r="3.2" stroke={c.text2} strokeWidth={1.4} />
          <Line x1="8" y1="0.8" x2="8" y2="2.6" stroke={c.text2} strokeWidth={1.4} strokeLinecap="round" />
          <Line x1="8" y1="13.4" x2="8" y2="15.2" stroke={c.text2} strokeWidth={1.4} strokeLinecap="round" />
          <Line x1="0.8" y1="8" x2="2.6" y2="8" stroke={c.text2} strokeWidth={1.4} strokeLinecap="round" />
          <Line x1="13.4" y1="8" x2="15.2" y2="8" stroke={c.text2} strokeWidth={1.4} strokeLinecap="round" />
          <Line x1="2.8" y1="2.8" x2="4.1" y2="4.1" stroke={c.text2} strokeWidth={1.4} strokeLinecap="round" />
          <Line x1="11.9" y1="11.9" x2="13.2" y2="13.2" stroke={c.text2} strokeWidth={1.4} strokeLinecap="round" />
          <Line x1="13.2" y1="2.8" x2="11.9" y2="4.1" stroke={c.text2} strokeWidth={1.4} strokeLinecap="round" />
          <Line x1="4.1" y1="11.9" x2="2.8" y2="13.2" stroke={c.text2} strokeWidth={1.4} strokeLinecap="round" />
        </Svg>
      ) : (
        <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
          <Path
            d="M13 9.5A5.5 5.5 0 016 3a5.7 5.7 0 00-.6.04A5.5 5.5 0 1013.5 10 5.5 5.5 0 0113 9.5z"
            fill={c.text2}
          />
        </Svg>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
