import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';

import { AppStateProvider } from '../../state/AppStateContext';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // State hydration now lives in AppStateProvider (Day 2+).
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) {
      void SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) return null;

  return (
    <AppStateProvider>
      <StatusBar style="light" />
      <Slot />
    </AppStateProvider>
  );
}
