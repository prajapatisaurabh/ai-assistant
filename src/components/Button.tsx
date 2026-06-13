import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';
import {useTheme} from '@/theme/ThemeProvider';
import {fonts} from '@/theme/typography';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'filled' | 'tonal' | 'outlined' | 'text';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export const Button: React.FC<Props> = ({
  label,
  onPress,
  variant = 'filled',
  disabled,
  loading,
  style,
}) => {
  const t = useTheme();
  const c = t.colors;

  const bg =
    variant === 'filled'
      ? c.primary
      : variant === 'tonal'
      ? c.primaryContainer
      : 'transparent';
  const fg =
    variant === 'filled'
      ? c.onPrimary
      : variant === 'tonal'
      ? c.onPrimaryContainer
      : c.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      android_ripple={{color: c.outline}}
      style={({pressed}) => [
        styles.base,
        {
          backgroundColor: bg,
          borderColor: variant === 'outlined' ? c.outline : 'transparent',
          borderWidth: variant === 'outlined' ? 1 : 0,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          borderRadius: t.radius.pill,
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <Text style={[styles.label, {color: fg}]}>{label}</Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {fontSize: 15, fontFamily: fonts.bold},
});
