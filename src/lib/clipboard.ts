import { Platform } from "react-native";

/**
 * Cross-platform copy. Web uses the browser clipboard (works in Expo web).
 * Native uses expo-clipboard if installed (npx expo install expo-clipboard);
 * otherwise returns false so the caller can show a message.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (Platform.OS === "web") {
      const nav = (globalThis as { navigator?: { clipboard?: { writeText?: (t: string) => Promise<void> } } }).navigator;
      if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(text);
        return true;
      }
      return false;
    }
    // Native: optional dependency, loaded dynamically so the build doesn't
    // require it. eval-require avoids static module resolution.
    try {
      // eslint-disable-next-line no-eval
      const mod = (eval("require") as (id: string) => { setStringAsync?: (t: string) => Promise<boolean> })("expo-clipboard");
      if (mod?.setStringAsync) {
        await mod.setStringAsync(text);
        return true;
      }
    } catch {
      // not installed
    }
    return false;
  } catch {
    return false;
  }
}
