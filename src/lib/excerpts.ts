import AsyncStorage from "@react-native-async-storage/async-storage";
import type { GenFormat } from "./ai";

/**
 * Persists platform posts (LinkedIn / X / Substack) generated from a piece of
 * content, keyed by content id, so the user never loses an approved version and
 * we avoid re-calling the AI (which costs money).
 */
export type Excerpts = Partial<Record<GenFormat, string>>;

const key = (contentId: string) => `mindfolio.excerpts.${contentId}`;

export async function loadExcerpts(contentId: string): Promise<Excerpts> {
  try {
    const raw = await AsyncStorage.getItem(key(contentId));
    return raw ? (JSON.parse(raw) as Excerpts) : {};
  } catch {
    return {};
  }
}

export async function saveExcerpts(contentId: string, value: Excerpts): Promise<void> {
  try {
    await AsyncStorage.setItem(key(contentId), JSON.stringify(value));
  } catch {
    // non-critical
  }
}
