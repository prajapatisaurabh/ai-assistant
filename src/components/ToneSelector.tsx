import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {Tone, TONES} from '@/types';
import {Chip} from './Chip';
import {useTheme} from '@/theme/ThemeProvider';
import {fonts} from '@/theme/typography';

interface Props {
  value: Tone;
  onChange: (tone: Tone) => void;
  label?: string;
}

const TONE_LABELS: Record<Tone, string> = {
  professional: 'Professional',
  casual: 'Casual',
  friendly: 'Friendly',
  marketing: 'Marketing',
  technical: 'Technical',
};

export const ToneSelector: React.FC<Props> = ({
  value,
  onChange,
  label = 'Tone',
}) => {
  const t = useTheme();
  return (
    <View>
      <Text style={[styles.label, {color: t.colors.onSurfaceVariant}]}>
        {label}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}>
        {TONES.map(tone => (
          <Chip
            key={tone}
            label={TONE_LABELS[tone]}
            selected={value === tone}
            onPress={() => onChange(tone)}
          />
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  label: {fontSize: 13, fontFamily: fonts.medium, marginBottom: 4, marginLeft: 4},
  row: {paddingVertical: 2},
});
