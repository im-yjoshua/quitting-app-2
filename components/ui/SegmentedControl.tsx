/**
 * SegmentedControl — glass container with a sliding selection pill.
 *
 * iOS segmented pattern (Week / Month / All time): the selected segment is
 * the accent pill, unselected labels are metadata. Selection fires a
 * selection haptic at animation start; the pill travels on the standard
 * spring (instant under Reduce Motion). Segments are equal-width.
 */
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { motion, radii, type as typeScale } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { GlassView } from './GlassView';

interface SegmentedControlProps {
  segments: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  accessibilityLabel?: string;
  testID?: string;
}

const CONTAINER_PADDING = 4;
const SEGMENT_HEIGHT = 32;

export function SegmentedControl({
  segments,
  selectedIndex,
  onChange,
  accessibilityLabel,
  testID,
}: SegmentedControlProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const [containerWidth, setContainerWidth] = useState(0);
  const pillX = useSharedValue(0);

  const segmentWidth =
    containerWidth > 0 && segments.length > 0
      ? (containerWidth - CONTAINER_PADDING * 2) / segments.length
      : 0;

  const onLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  // Keep the pill under the selected segment — on mount and when the
  // parent drives selectedIndex.
  useEffect(() => {
    if (segmentWidth > 0) {
      const target = selectedIndex * segmentWidth;
      pillX.value = reduceMotion ? target : withSpring(target, motion.standard);
    }
  }, [selectedIndex, segmentWidth, reduceMotion, pillX]);

  const select = (index: number) => {
    if (index === selectedIndex) return;
    void Haptics.selectionAsync();
    onChange(index);
  };

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
  }));

  if (segments.length === 0) return null;

  return (
    <GlassView
      style={styles.container}
      testID={testID}
    >
      <View
        onLayout={onLayout}
        style={styles.row}
        accessibilityRole="tablist"
        accessibilityLabel={accessibilityLabel}
      >
        {segmentWidth > 0 && (
          <Animated.View
            style={[
              styles.pill,
              {
                width: segmentWidth,
                height: SEGMENT_HEIGHT,
                borderRadius: radii.pill,
                backgroundColor: theme.colors.accent,
                left: CONTAINER_PADDING,
                top: CONTAINER_PADDING,
              },
              pillStyle,
            ]}
          />
        )}
        {segments.map((segment, index) => {
          const selected = index === selectedIndex;
          return (
            <Pressable
              key={segment}
              onPress={() => select(index)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={segment}
              style={styles.segment}
            >
              <Text
                style={[
                  styles.label,
                  {
                    color: selected
                      ? theme.colors.onAccent
                      : theme.colors.metadata,
                  },
                ]}
              >
                {segment}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </GlassView>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: radii.pill },
  row: {
    flexDirection: 'row',
    padding: CONTAINER_PADDING,
    position: 'relative',
  },
  pill: { position: 'absolute', zIndex: 0 },
  segment: {
    flex: 1,
    height: SEGMENT_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  label: { ...typeScale.footnote, fontWeight: '600' },
});
