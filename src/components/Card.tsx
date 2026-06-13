import React from 'react';
import {StyleSheet, View, ViewStyle} from 'react-native';
import {useTheme} from '@/theme/ThemeProvider';

export const Card: React.FC<{children: React.ReactNode; style?: ViewStyle}> = ({
  children,
  style,
}) => {
  const t = useTheme();
  return (
    <View
      style={[
        styles.card,
        {backgroundColor: t.colors.surface, borderRadius: t.radius.lg},
        style,
      ]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 2},
    elevation: 2,
  },
});
