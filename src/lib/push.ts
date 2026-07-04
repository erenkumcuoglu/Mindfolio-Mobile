/**
 * Push notification — STUB (devre dışı).
 *
 * Apple Personal Team ($99/yıl olmadan) push capability'sini desteklemediği
 * için build'in geçmesi için stub'a çevrildi. Kod tarafında bu dosyayı
 * import eden yerler no-op çağrı yapar, hata almazlar.
 *
 * Push'u geri açmak için:
 * 1. `npm install expo-notifications@~56.0.4`
 * 2. app.json → plugins → `["expo-notifications", { "icon": "./assets/icon.png", "color": "#F5B70B" }]`
 * 3. Bu dosyayı Git history'den restore et (gerçek Expo Notifications entegrasyonu)
 * 4. `npx expo prebuild --clean && cd ios && pod install`
 * 5. Xcode → Signing → Apple Developer Program ile imzala
 */

export async function registerForPushAsync(): Promise<{ ok: boolean; token?: string; error?: string }> {
  return { ok: false, error: "push disabled (Personal Team)" };
}

export async function refreshPushTokenIfGranted(): Promise<void> {
  return;
}
