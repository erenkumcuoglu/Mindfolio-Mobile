import { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './src/lib/supabase';
import LoginScreen from './src/screens/LoginScreen';
import AppTabs from './src/screens/AppTabs';
import SplashScreen from './src/screens/SplashScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { LanguageProvider } from './src/lib/i18n';
import { DialogHost } from './src/components/DialogHost';
import { getPersona } from './src/lib/data';

function Gate() {
  const { scheme } = useTheme();
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  // null = bilinmiyor (kontrol ediliyor), true/false = onboarding tamam mı?
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);

  // Persona'yı kontrol et — onboarding tamamlanmış mı?
  const checkOnboarding = useCallback(async () => {
    try {
      const persona = await getPersona();
      setOnboardingComplete(!!persona?.onboarding_complete);
    } catch {
      // Persona row henüz yoksa: yeni kullanıcı → onboarding'e gir
      setOnboardingComplete(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
      if (data.session) checkOnboarding();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      // Sadece yeni oturum / çıkışta onboarding state'i yenile.
      // TOKEN_REFRESHED gibi olaylar onboarding'i SIFIRLAMAMALI (aksi halde başa sarar).
      if (event === "SIGNED_IN" && next) {
        setOnboardingComplete(null);
        checkOnboarding();
      } else if (event === "SIGNED_OUT") {
        setOnboardingComplete(null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [checkOnboarding]);

  // Splash stays until BOTH auth has resolved and the minimum splash time elapsed.
  if (!authReady || !splashDone) {
    return (
      <>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <SplashScreen onDone={() => setSplashDone(true)} />
      </>
    );
  }

  // Oturum varsa ama onboarding durumu bilinmiyor → kısa splash'ta bekle
  if (session && onboardingComplete === null) {
    return (
      <>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <SplashScreen />
      </>
    );
  }

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {!session ? (
        <LoginScreen onLogin={() => { /* handled by onAuthStateChange */ }} />
      ) : !onboardingComplete ? (
        <OnboardingScreen onComplete={() => setOnboardingComplete(true)} />
      ) : (
        <AppTabs onLogout={() => setSession(null)} />
      )}
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <Gate />
        <DialogHost />
      </LanguageProvider>
    </ThemeProvider>
  );
}
