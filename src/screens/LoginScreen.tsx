import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Easing,
} from "react-native";
import Svg, { Rect, Path } from "react-native-svg";
import { supabase, signInWithGoogle } from "../lib/supabase";
import { useTheme } from "../theme/ThemeContext";
import { ThemeToggle } from "../components/ThemeToggle";
import { radii, spacing, typography, type Palette } from "../theme/tokens";

interface Props {
  onLogin: () => void;
}

type Step = "welcome" | "form";

/**
 * Üst zone'da yüzen sosyal kartlar: LinkedIn (sol) + X (sağ) altta, AI yazıyor kartı üstte.
 * Kullanıcı isteği: "AI yazıyor animasyonu X ve LinkedIn'in üzerine yukarıya çıksın."
 */
function FloatingCards({ c }: { c: Palette }) {
  const styles = floatingStyles(c);
  const floatA = useRef(new Animated.Value(0)).current;
  const floatC = useRef(new Animated.Value(0)).current;
  const bar1 = useRef(new Animated.Value(0.4)).current;
  const bar2 = useRef(new Animated.Value(0.4)).current;
  const bar3 = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = (val: Animated.Value, range: [number, number], dur: number, delay = 0) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(val, { toValue: range[1], duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: false, delay }),
          Animated.timing(val, { toValue: range[0], duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        ])
      );
    loop(floatA, [0, -8], 2400).start();
    loop(floatC, [0, -10], 2800, 400).start();
    loop(bar1, [0.3, 1], 620).start();
    loop(bar2, [0.3, 1], 720, 120).start();
    loop(bar3, [0.3, 1], 820, 240).start();
  }, [floatA, floatC, bar1, bar2, bar3]);

  return (
    <View style={styles.wrap}>
      {/* AI yazıyor — ÜSTTE (LinkedIn + X'in yukarısına çıkıyor) */}
      <View style={styles.ai}>
        <View style={styles.aiDot} />
        <Text style={styles.aiText}>AI yazıyor</Text>
        <View style={styles.bars}>
          <Animated.View style={[styles.bar, { transform: [{ scaleY: bar1 }] }]} />
          <Animated.View style={[styles.bar, { transform: [{ scaleY: bar2 }] }]} />
          <Animated.View style={[styles.bar, { transform: [{ scaleY: bar3 }] }]} />
        </View>
      </View>
      {/* LinkedIn — sol alt */}
      <Animated.View style={[styles.card, styles.cardLi, { transform: [{ translateY: floatA }] }]}>
        <Text style={styles.platLi}>in</Text>
        <View style={styles.lines}>
          <View style={[styles.line, { width: 48 }]} />
          <View style={[styles.line, { width: 32 }]} />
        </View>
      </Animated.View>
      {/* X — sağ alt */}
      <Animated.View style={[styles.card, styles.cardX, { transform: [{ translateY: floatC }] }]}>
        <Text style={styles.platX}>X</Text>
        <View style={styles.lines}>
          <View style={[styles.line, { width: 40 }]} />
          <View style={[styles.line, { width: 24 }]} />
        </View>
      </Animated.View>
    </View>
  );
}

function floatingStyles(c: Palette) {
  return StyleSheet.create({
    wrap: { width: "100%", height: 170, position: "relative" },
    ai: {
      position: "absolute",
      top: 14,
      alignSelf: "center",
      left: "50%",
      transform: [{ translateX: -78 }],
      width: 156,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: c.glassFill,
      borderWidth: 1,
      borderColor: c.glassBorder,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      zIndex: 3,
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 12,
    },
    aiDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.accent },
    aiText: { fontSize: 12, fontWeight: "600", color: c.text2, flex: 1 },
    bars: { flexDirection: "row", alignItems: "center", gap: 2, height: 14 },
    bar: { width: 2, height: 14, borderRadius: 1, backgroundColor: c.accent },

    card: {
      position: "absolute",
      bottom: 4,
      width: 130,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 14,
      backgroundColor: c.glassFill,
      borderWidth: 1,
      borderColor: c.glassBorder,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    cardLi: { left: 16 },
    cardX: { right: 16 },
    platLi: { fontSize: 16, fontWeight: "700", color: "#0a66c2", width: 18 },
    platX: { fontSize: 16, fontWeight: "700", color: c.text1, width: 18 },
    lines: { gap: 5 },
    line: { height: 4, borderRadius: 2, backgroundColor: c.text4 },
  });
}

function BrandLogo({ c, size = 40 }: { c: Palette; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      <Rect width="26" height="26" rx="6.5" fill={c.mintBg} stroke={c.mintBorder} strokeWidth="1" />
      <Rect x="1.5" y="10.5" width="2" height="5" rx="1" fill={c.accent} opacity={0.55} />
      <Rect x="4.5" y="6.5" width="2" height="13" rx="1" fill={c.accent} opacity={0.85} />
      <Rect x="7.5" y="5" width="2" height="16" rx="1" fill={c.accent} />
      <Rect x="10.5" y="7" width="2" height="12" rx="1" fill={c.accent} opacity={0.7} />
      <Rect x="15" y="9.5" width="7" height="1.7" rx="0.85" fill={c.text1} opacity={0.55} />
      <Rect x="15" y="12.5" width="8.5" height="1.7" rx="0.85" fill={c.text1} opacity={0.45} />
      <Rect x="15" y="15.5" width="5.5" height="1.7" rx="0.85" fill={c.text1} opacity={0.38} />
    </Svg>
  );
}

export default function LoginScreen({ onLogin }: Props) {
  const { c } = useTheme();
  const styles = makeStyles(c);

  const [step, setStep] = useState<Step>("welcome");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) return;
    if (mode === "register") {
      if (!fullName.trim()) {
        Alert.alert("Ad soyad gerekli", "Lütfen ad ve soyadını yaz.");
        return;
      }
      if (password.length < 6) {
        Alert.alert("Şifre çok kısa", "Şifren en az 6 karakter olmalı.");
        return;
      }
      if (password !== confirmPassword) {
        Alert.alert("Şifreler uyuşmuyor", "Şifreni iki alana da aynı yaz.");
        return;
      }
    }
    setLoading(true);
    try {
      if (mode === "register") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: fullName.trim(), full_name: fullName.trim() } },
        });
        if (error) throw error;
        Alert.alert("E-postanı kontrol et", "Sana bir doğrulama bağlantısı gönderdik.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) {
          if (error.message.includes("Email not confirmed")) {
            Alert.alert("E-posta doğrulanmadı", "Önce gelen kutunu kontrol edip e-postanı doğrula.");
          } else {
            throw error;
          }
          return;
        }
        onLogin();
      }
    } catch (e: any) {
      Alert.alert("Hata", e?.message ?? "Bir şeyler ters gitti");
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    const res = await signInWithGoogle();
    if (!res.ok) {
      Alert.alert(
        "Google ile giriş",
        res.error === "native-unsupported"
          ? "Mobil uygulamada Google girişi yakında — şimdilik web'de veya e-posta ile devam et."
          : res.error ?? "Bir şeyler ters gitti"
      );
    }
    // On success the page redirects to Google; onAuthStateChange handles the return.
  };

  const appleSoon = () =>
    Alert.alert("Apple ile giriş", "Apple girişi için Apple Developer Program (yıllık $99) gerekiyor; hesap hazır olunca etkinleştireceğiz.");

  if (step === "welcome") {
    return (
      <View style={styles.root}>
        <View style={styles.toggleCorner}>
          <ThemeToggle />
        </View>

        {/* ScrollView ile sar — küçük ekranlarda alt zonun kesilmesini önler */}
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: 60, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          {/* Top zone — floating cards (LinkedIn + X), AI yazıyor üzerlerinde */}
          <View style={styles.thirdTop}>
            <FloatingCards c={c} />
          </View>

          {/* Middle zone — büyük logo (aşağı) + revize başlık + alt yazı */}
          <View style={styles.thirdMid}>
            <BrandLogo c={c} size={84} />
            <Text style={styles.brandName}>mindfolio</Text>
            <Text style={styles.h1}>Fikirlerini dünyayla paylaş.</Text>
            <Text style={styles.sub}>
              Stratejini oluştur, konuşarak anlat, Mindfolio senin elinden çıkmış bir içerik haline getirsin.
            </Text>
          </View>

          {/* Bottom zone — auth */}
          <View style={styles.thirdBottom}>
          <TouchableOpacity style={[styles.bb, styles.appleBtn]} activeOpacity={0.85} onPress={appleSoon}>
            <Svg width={15} height={18} viewBox="0 0 15 18" fill={c.appleText}>
              <Path d="M12.6 9.5c0-1.9 1.6-2.9 1.7-2.9a3.7 3.7 0 00-2.9-1.5c-1.2-.1-2.4.7-3 .7s-1.5-.7-2.5-.6C4.3 5.2 2.9 6.1 2.1 7.5 .5 10.4 1.7 14.7 3.2 17.1c.8 1.2 1.7 2.5 2.9 2.4 1.2-.1 1.6-.8 3-.8s1.8.8 3 .8c1.3 0 2.1-1.2 2.8-2.4.9-1.4 1.3-2.7 1.3-2.8s-2.7-1-2.6-3.8zM10.3 3.4c.6-.8 1-1.8 1-2.9-.9.1-2 .7-2.6 1.5-.6.7-1.1 1.8-.9 2.8.9 0 1.9-.6 2.5-1.4z" />
            </Svg>
            <Text style={[styles.bbText, { color: c.appleText }]}>Apple ile devam et</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.bb, styles.glassBtn]} activeOpacity={0.85} onPress={handleGoogle}>
            <Svg width={18} height={18} viewBox="0 0 48 48">
              <Path fill="#EA4335" d="M24 9.5c3.5 0 6.7 1.2 9.2 3.6l6.9-6.9C35.9 2.4 30.5 0 24 0 14.6 0 6.5 5.4 2.6 13.2l8 6.2C12.4 13.7 17.7 9.5 24 9.5z" />
              <Path fill="#4285F4" d="M47 24.5c0-1.6-.2-3.1-.4-4.5H24v9h13c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 7.1-10.4 7.1-17.7z" />
              <Path fill="#FBBC05" d="M10.5 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-8-6.2C.9 16.5 0 20.1 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.2z" />
              <Path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.2 1.5-5 2.3-8.2 2.3-6.3 0-11.6-4.2-13.5-9.9l-8 6.2C6.5 42.6 14.6 48 24 48z" />
            </Svg>
            <Text style={[styles.bbText, { color: c.text1 }]}>Google ile devam et</Text>
          </TouchableOpacity>

          <View style={styles.divRow}>
            <View style={styles.divLine} />
            <Text style={styles.divTxt}>veya</Text>
            <View style={styles.divLine} />
          </View>

          {/* Primary CTA — yeni kullanıcı için Hesap Oluştur (register modu) */}
          <TouchableOpacity
            style={[styles.bb, styles.emailBtn]}
            activeOpacity={0.85}
            onPress={() => { setMode("register"); setStep("form"); }}
          >
            <Svg width={16} height={13} viewBox="0 0 20 16" fill="none">
              <Rect x="1" y="1" width="18" height="14" rx="2.5" stroke={c.text3} strokeWidth="1.5" />
              <Path d="M1 4l9 6 9-6" stroke={c.text3} strokeWidth="1.5" strokeLinecap="round" />
            </Svg>
            <Text style={[styles.bbText, { color: c.text2 }]}>E-posta ile Hesap Oluştur</Text>
          </TouchableOpacity>

          <Text style={styles.footer}>
            Zaten hesabın var mı?{" "}
            <Text style={styles.link} onPress={() => { setMode("login"); setStep("form"); }}>
              Giriş yap
            </Text>
          </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.toggleCorner}>
        <ThemeToggle />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {(
            <View>
              <TouchableOpacity onPress={() => setStep("welcome")} activeOpacity={0.7}>
                <Text style={styles.back}>← Geri</Text>
              </TouchableOpacity>
              <Text style={styles.h2}>{mode === "login" ? "Giriş yap" : "Hesap Oluştur"}</Text>
              <Text style={styles.sub}>
                {mode === "login" ? "E-posta ve şifrenle devam et" : "Birkaç saniye sürer."}
              </Text>

              {mode === "register" && (
                <TextInput
                  style={styles.input}
                  placeholder="Ad ve soyad"
                  placeholderTextColor={c.text4}
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                  autoComplete="name"
                  returnKeyType="next"
                />
              )}
              <TextInput
                style={styles.input}
                placeholder="E-posta"
                placeholderTextColor={c.text4}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                autoComplete="email"
                returnKeyType="next"
              />
              <TextInput
                style={styles.input}
                placeholder={mode === "register" ? "Şifre (en az 6 karakter)" : "Şifre"}
                placeholderTextColor={c.text4}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                returnKeyType={mode === "register" ? "next" : "go"}
                onSubmitEditing={mode === "login" ? handleSubmit : undefined}
              />
              {mode === "register" && (
                <TextInput
                  style={styles.input}
                  placeholder="Şifreyi tekrar yaz"
                  placeholderTextColor={c.text4}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoComplete="new-password"
                  returnKeyType="go"
                  onSubmitEditing={handleSubmit}
                />
              )}

              <TouchableOpacity
                style={[styles.submit, loading && styles.submitDisabled]}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color={c.onAccent} />
                ) : (
                  <Text style={styles.submitText}>{mode === "login" ? "Giriş yap" : "Hesap Oluştur"}</Text>
                )}
              </TouchableOpacity>

              <Text style={styles.footer}>
                {mode === "login" ? "Hesabın yok mu? " : "Zaten hesabın var mı? "}
                <Text style={styles.link} onPress={() => setMode(mode === "login" ? "register" : "login")}>
                  {mode === "login" ? "Kayıt ol" : "Giriş yap"}
                </Text>
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    flex: { flex: 1 },
    toggleCorner: { position: "absolute", top: 56, right: 20, zIndex: 10 },
    scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 26, paddingVertical: 80 },

    // 3-zone welcome layout — top: floating cards, mid: logo+başlık, bottom: auth
    // ScrollView içinde flex çalışmadığı için sabit yükseklik veriyoruz
    thirdTop: { alignItems: "center", justifyContent: "flex-end", paddingTop: 12, minHeight: 180 },
    brandName: { ...typography.h1, color: c.text1, marginTop: 14, marginBottom: 18 },
    thirdMid: { alignItems: "center", justifyContent: "flex-start", paddingHorizontal: 28, paddingTop: 22 },
    thirdBottom: { paddingHorizontal: 26, paddingTop: 24, paddingBottom: 24 },

    h1: { ...typography.h1, color: c.text1, lineHeight: 34, marginBottom: 12, textAlign: "center" },
    h2: { ...typography.h1, color: c.text1, marginBottom: 6 },
    sub: { ...typography.body, color: c.text3, marginBottom: 20, textAlign: "center", lineHeight: 22 },

    bb: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      width: "100%",
      paddingVertical: 15,
      borderRadius: 14,
      marginBottom: 10,
    },
    bbText: { fontSize: 15, fontWeight: "600" },
    appleBtn: { backgroundColor: c.appleBg },
    glassBtn: { backgroundColor: c.glassFill, borderWidth: 1, borderColor: c.glassBorder },
    emailBtn: { borderWidth: 1, borderColor: c.glassBorder },

    divRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 8 },
    divLine: { flex: 1, height: 1, backgroundColor: c.border },
    divTxt: { fontSize: 12, color: c.text4 },

    footer: { marginTop: 18, textAlign: "center", fontSize: 13, color: c.text4 },
    link: { color: c.accent, fontWeight: "600" },
    back: { fontSize: 14, color: c.text3, marginBottom: 16 },

    input: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radii.btn,
      paddingHorizontal: spacing.md,
      paddingVertical: 14,
      fontSize: 16,
      color: c.text1,
      marginBottom: 12,
    },
    submit: {
      backgroundColor: c.accent,
      borderRadius: radii.btn,
      paddingVertical: 15,
      alignItems: "center",
      marginTop: 4,
    },
    submitDisabled: { opacity: 0.6 },
    submitText: { color: c.onAccent, fontSize: 16, fontWeight: "600" },
  });
}
