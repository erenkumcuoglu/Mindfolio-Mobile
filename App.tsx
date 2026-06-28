import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './src/lib/supabase';
import LoginScreen from './src/screens/LoginScreen';
import AppTabs from './src/screens/AppTabs';
import SplashScreen from './src/screens/SplashScreen';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { LanguageProvider } from './src/lib/i18n';
import { DialogHost } from './src/components/DialogHost';

function Gate() {
  const { scheme } = useTheme();
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Splash stays until BOTH auth has resolved and the minimum splash time elapsed.
  if (!authReady || !splashDone) {
    return (
      <>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <SplashScreen onDone={() => setSplashDone(true)} />
      </>
    );
  }

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {session ? (
        <AppTabs onLogout={() => setSession(null)} />
      ) : (
        <LoginScreen onLogin={() => { /* handled by onAuthStateChange */ }} />
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
