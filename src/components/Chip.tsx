import React from 'react';
import {Pressable, StyleSheet, Text} from 'react-native';
import {useTheme} from '@/theme/ThemeProvider';
import {fonts} from '@/theme/typography';

interface Props {
  label: string;
  selected?: boolean;
  onPress: () => void;
}

export const Chip: React.FC<Props> = ({label, selected, onPress}) => {
  const t = useTheme();
  const c = t.colors;
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{color: c.outline}}
      style={[
        styles.chip,
        {
          borderRadius: t.radius.sm,
          backgroundColor: selected ? c.primaryContainer : c.surfaceVariant,
          borderColor: selected ? c.primary : c.outline,
        },
      ]}>
      <Text
        style={{
          color: selected ? c.onPrimaryContainer : c.onSurfaceVariant,
          fontFamily: selected ? fonts.bold : fonts.medium,
          fontSize: 13,
        }}>
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    margin: 4,
  },
});
