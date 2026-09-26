import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';

import { AppStateProvider } from '../../state/AppStateContext';
import {
  initializePurchases,
  syncCustomerEntitlements,
} from '../../services/purchases';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // State hydration now lives in AppStateProvider (Day 2+).
    setReady(true);
    // Day 5: warm the RevenueCat bridge at launch and re-verify the
    // entitlement snapshot so gates reflect real subscription state.
    void initializePurchases()
      .then((ok) => {
        if (ok) void syncCustomerEntitlements();
      })
      .catch(() => {
        // Gating falls back to the trusted offline snapshot — never crash.
      });
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
