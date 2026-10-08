import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { AppStateProvider } from '../../state/AppStateContext';
import {
  initializePurchases,
  syncCustomerEntitlements,
} from '../../services/purchases';

import { useScheme } from '../../theme/useTheme';

void SplashScreen.preventAutoHideAsync();

/** StatusBar follows the resolved appearance (inside the provider). */
function ThemedStatusBar() {
  const scheme = useScheme();
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  useEffect(() => {
    // Splash hides right after mount (state hydration lives in
    // AppStateProvider); the purchase bridge warms in the background.
    void SplashScreen.hideAsync();
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

  return (
    <AppStateProvider>
      <ThemedStatusBar />
      <Slot />
    </AppStateProvider>
  );
}
