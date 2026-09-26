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
 */
import * as Sharing from 'expo-sharing';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ShareCard } from './ShareCard';
import { GlassButton } from './glass/GlassButton';
import { GlassSurface } from './glass/GlassSurface';
import type { QuitCategory, ShareCardStyle } from '../types/app';
import { colors, radii, spacing, type } from '../theme/tokens';

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
  const cardRef = useRef<View>(null);
  const [style, setStyle] = useState<ShareCardStyle>(initialStyle);
  const [sharing, setSharing] = useState(false);

  const pickStyle = (next: ShareCardStyle) => {
    if (next === 'noir' && !isPremium) {
      onRequestPremium();
      return;
    }
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
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <GlassSurface
          style={styles.sheet}
          glassEffectStyle="clear"
          fallbackIntensity={90}
        >
          <View style={styles.inner}>
            <Text style={styles.title}>Share your streak</Text>
            <ShareCard
              ref={cardRef}
              days={days}
              category={category}
              customName={customName}
              style={style}
            />
            <View style={styles.styleRow}>
              <StyleChip
                label="Classic"
                selected={style === 'classic'}
                onPress={() => pickStyle('classic')}
              />
              <StyleChip
                label={isPremium ? 'Noir' : 'Noir 🔒'}
                selected={style === 'noir'}
                onPress={() => pickStyle('noir')}
              />
            </View>
            {sharing ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <GlassButton title="Share" onPress={share} />
            )}
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={styles.close}
            >
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>
        </GlassSurface>
      </View>
    </Modal>
  );
}

function StyleChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4,6,16,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  sheet: {
    width: '100%',
    maxWidth: 400,
    borderRadius: radii.xl,
    overflow: 'hidden',
    maxHeight: '92%',
  },
  inner: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  title: {
    ...type.headline,
    color: colors.text,
  },
  styleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  chipSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  chipText: {
    ...type.callout,
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: colors.text,
  },
  close: {
    paddingVertical: spacing.sm,
  },
  closeText: {
    ...type.body,
    color: colors.textSecondary,
  },
});
