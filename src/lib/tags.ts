/**
 * User's custom tag list, persisted on-device (AsyncStorage). Merged with the
 * tags actually used across their ideas to build the filter row.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "mf-custom-tags";

export async function getCustomTags(): Promise<string[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(KEY)) || "[]");
  } catch {
    return [];
  }
}

export async function saveCustomTags(tags: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(tags));
  } catch {
    /* ignore */
  }
}
