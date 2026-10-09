/**
 * ShareCardSheet — preview + share for milestone cards (spec §2.6).
 *
 * Shows the card at full beauty, lets the user pick the style
 * (`classic` free, `noir` premium-locked → paywall stub), then opens the
 * OS share sheet.
 *
 * Capture strategy: react-native-view-shot's captureRef is loaded with a
 * guarded require at call time — it ships native code that isn't in Expo
 * Go, so a static import would crash the whole app there. In Expo Go we
 * fall back to a text share; in dev/production builds the image path
 * works and is shared via expo-sharing.
 *
 * Monochrome reskin: the Sheet primitive, accent-selected style chips,
 * inverted Share primary.
 */
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ShareCard } from './ShareCard';
import { GlassButton } from './glass/GlassButton';
import { Sheet } from './glass/Sheet';
import type { QuitCategory, ShareCardStyle } from '../types/app';
import { radii, spacing, type } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

interface ShareCardSheetProps {
  visible: boolean;
  days: number;
  category: QuitCategory;
  customName?: string;
  /** Whether the sovereign_tier entitlement is active (noir unlock). */
  isPremium: boolean;
  initialStyle?: ShareCardStyle;
  onRequestPremium: () => void;
  onClose: () => void;
}

/** Guarded loader: returns captureRef or null when unavailable (Expo Go). */
function loadCaptureRef(): ((
  ref: object,
  opts?: object
) => Promise<string>) | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-view-shot') as {
      captureRef?: (ref: object, opts?: object) => Promise<string>;
    };
    return typeof mod.captureRef === 'function' ? mod.captureRef : null;
  } catch {
    return null;
  }
}

export function ShareCardSheet({
  visible,
  days,
  category,
  customName,
  isPremium,
  initialStyle = 'classic',
  onRequestPremium,
  onClose,
}: ShareCardSheetProps) {
  const theme = useTheme();
  const c = theme.colors;
  const cardRef = useRef<View>(null);
  const [style, setStyle] = useState<ShareCardStyle>(initialStyle);
  const [sharing, setSharing] = useState(false);

  const pickStyle = (next: ShareCardStyle) => {
    if (next === 'noir' && !isPremium) {
      onRequestPremium();
      return;
    }
    void Haptics.selectionAsync();
    setStyle(next);
  };

  const share = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const captureRef = loadCaptureRef();
      if (captureRef && cardRef.current) {
        const uri = await captureRef(cardRef.current, {
          format: 'png',
          quality: 1,
        });
        const available = await Sharing.isAvailableAsync();
        if (available) {
          await Sharing.shareAsync(uri, {
            dialogTitle: `${days} days clean — Sovereign`,
          });
          return;
        }
      }
      // Fallback (Expo Go / no capture): text share.
      await Share.share({
        message: `${days} ${days === 1 ? 'day' : 'days'} clean — tracked with Sovereign.`,
      });
    } catch {
      Alert.alert(
        'Sharing failed',
        'The share sheet could not be opened. Your streak is safe — try again.'
      );
    } finally {
      setSharing(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} dismissLabel="Close">
      <View style={styles.inner}>
        <Text style={[styles.title, { color: c.text }]}>
          Share your streak
        </Text>
        <ShareCard
          ref={cardRef}
          days={days}
          category={category}
          customName={customName}
          style={style}
        />
        <View style={styles.styleRow}>
          <StyleChip
            theme={theme}
            label="Classic"
            selected={style === 'classic'}
            onPress={() => pickStyle('classic')}
          />
          <StyleChip
            theme={theme}
            label={isPremium ? 'Noir' : 'Noir 🔒'}
            selected={style === 'noir'}
            onPress={() => pickStyle('noir')}
          />
        </View>
        {sharing ? (
          <ActivityIndicator color={c.accent} />
        ) : (
          <View style={styles.shareWrap}>
            <GlassButton title="Share" onPress={share} />
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          style={styles.close}
        >
          <Text style={[styles.closeText, { color: c.metadata }]}>Close</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

function StyleChip({
  label,
  selected,
  onPress,
  theme,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const c = theme.colors;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          borderColor: selected ? c.accent : c.hairline,
          backgroundColor: selected ? c.accentSoft : 'transparent',
        },
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.chipText,
          { color: selected ? c.text : c.metadata },
          selected && styles.chipTextSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inner: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  title: {
    ...type.title2,
  },
  styleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    minHeight: 44,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  chipText: {
    ...type.headline,
  },
  chipTextSelected: {
    fontWeight: '700',
  },
  shareWrap: { alignSelf: 'stretch' },
  close: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
    justifyContent: 'center',
  },
  closeText: {
    ...type.headline,
  },
});
