import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Persistence of in-progress Studio work (transcript + draft text). Per product
 * policy, transcript & drafts are kept INDEFINITELY (cheap text, helps users
 * keep drafting). Raw audio is handled separately (kept max 24h server-side).
 */
const KEY = "mindfolio.studio.session";

export interface StudioSession {
  transcript: string;
  draft: string;
  excerpts?: Record<string, string>;
  updatedAt: number;
}

export async function loadStudioSession(): Promise<StudioSession | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as StudioSession;
    if (!s || typeof s.updatedAt !== "number") return null;
    return s;
  } catch {
    return null;
  }
}

export async function saveStudioSession(patch: Partial<Pick<StudioSession, "transcript" | "draft" | "excerpts">>): Promise<void> {
  try {
    const cur = (await loadStudioSession()) ?? { transcript: "", draft: "", updatedAt: Date.now() };
    const next: StudioSession = { ...cur, ...patch, updatedAt: Date.now() };
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // non-critical
  }
}

export async function clearStudioSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
