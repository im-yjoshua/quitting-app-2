/**
 * TextField — text input in the ONE grey container.
 *
 * Grey (#1C1C1E / #F2F2F7) reads as "something you can put text into";
 * body text stays full-brightness, placeholder in metadata grey. Focus ring
 * is the accent. 48pt target, standard control radius.
 */
import React, { forwardRef, useState } from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';

import { radii, spacing, type } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  /** Optional label above the field (headline weight, full-brightness). */
  label?: string;
  style?: StyleProp<ViewStyle>;
  /** Style passthrough for the inner TextInput. */
  inputStyle?: TextInputProps['style'];
}

export const TextField = forwardRef<TextInput, TextFieldProps>(
  function TextField({ label, style, inputStyle, ...props }, ref) {
    const theme = useTheme();
    const [focused, setFocused] = useState(false);

    return (
      <View style={style}>
        {label ? (
          <Text style={[styles.label, { color: theme.colors.text }]}>
            {label}
          </Text>
        ) : null}
        <View
          style={[
            styles.field,
            {
              backgroundColor: theme.colors.surface,
              borderColor: focused ? theme.colors.accent : 'transparent',
            },
          ]}
        >
          <TextInput
            ref={ref}
            placeholderTextColor={theme.colors.metadata}
            selectionColor={theme.colors.accent}
            style={[
              styles.input,
              { color: theme.colors.text },
              inputStyle,
            ]}
            onFocus={(e) => {
              setFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              props.onBlur?.(e);
            }}
            {...props}
          />
        </View>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  label: {
    ...type.headline,
    marginBottom: spacing.sm,
  },
  field: {
    borderRadius: radii.md,
    borderWidth: 1.5,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  input: {
    ...type.body,
    paddingVertical: spacing.sm,
  },
});
