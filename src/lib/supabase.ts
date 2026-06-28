import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "http://localhost:54321";
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-key";

// Web API base. In production builds set EXPO_PUBLIC_API_BASE to the deployed
// URL (e.g. https://app.mindfolio.com); falls back to localhost for dev.
export const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "http://localhost:3000";

const isWeb = Platform.OS === "web";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // On web, parse the OAuth tokens returned in the redirect URL so Google
    // sign-in completes. On native this is handled via deep links instead.
    detectSessionInUrl: isWeb,
  },
});

/**
 * Google OAuth. On web (Expo web / react-native-web) this redirects the page
 * to Google and back; the session is parsed from the return URL.
 * Native deep-link sign-in is a follow-up (needs a custom URL scheme + dev build).
 */
export async function signInWithGoogle(): Promise<{ ok: boolean; error?: string }> {
  if (!isWeb) {
    return { ok: false, error: "native-unsupported" };
  }
  const redirectTo = window.location.origin;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function getSessionToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function authedFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getSessionToken();
  const isForm = typeof FormData !== "undefined" && options.body instanceof FormData;
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      // Let fetch set the multipart boundary for FormData uploads (audio).
      ...(isForm ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}
