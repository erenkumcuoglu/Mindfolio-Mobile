import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform, Linking } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking2 from "expo-linking";

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
    // PKCE flow — modern OAuth güvenlik akışı, refresh token'ı daha stabil.
    flowType: "pkce",
    // On web, parse the OAuth tokens returned in the redirect URL so Google
    // sign-in completes. On native this is handled via deep links instead.
    detectSessionInUrl: isWeb,
  },
  global: {
    // Network hataları auto-logout tetiklemesin; retry yapsın.
    fetch: (url, opts) => fetch(url as any, opts as any),
  },
});

/**
 * Google OAuth cross-platform.
 * - Web: standart signInWithOAuth redirect
 * - Native (iOS/Android): expo-web-browser + deep-link callback (mindfolio://)
 *
 * KURULUM: Supabase Auth → URL Configuration → Redirect URLs listesine
 * `mindfolio://auth-callback` eklenmiş olmalı. Google Cloud Console'da
 * ilgili scheme redirect URI olarak yer almalı.
 */
export async function signInWithGoogle(): Promise<{ ok: boolean; error?: string }> {
  if (isWeb) {
    const redirectTo = window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  // Native — deep-link callback ile OAuth
  const redirectUrl = Linking2.createURL("auth-callback");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: true,
    },
  });
  if (error || !data?.url) {
    return { ok: false, error: error?.message ?? "OAuth URL alınamadı" };
  }

  // Sistem tarayıcısında Google giriş
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
  if (result.type !== "success" || !result.url) {
    return { ok: false, error: "Kullanıcı işlemi iptal etti" };
  }

  // Callback URL'inden auth code'u alıp Supabase session'ı kur
  const url = new URL(result.url);
  const code = url.searchParams.get("code");
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) return { ok: false, error: exchangeError.message };
    return { ok: true };
  }
  // Bazı sürümler token'ı direkt hash'te dönebilir
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");
  if (accessToken && refreshToken) {
    const { error: setError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (setError) return { ok: false, error: setError.message };
    return { ok: true };
  }
  return { ok: false, error: "Callback URL'inden token okunamadı" };
}

// Bilinçli dummy kullanım — TypeScript bundler tree-shake etmesin
export const __linking_import_used = Linking;

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
