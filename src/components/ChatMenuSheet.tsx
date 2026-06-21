import React from 'react';
import {Modal, Pressable, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTheme} from '@/theme/ThemeProvider';
import {fonts} from '@/theme/typography';

export interface ChatMenuAction {
  key: string;
  label: string;
  icon: string;
  detail?: string;
  destructive?: boolean;
  disabled?: boolean;
}

interface Props {
  visible: boolean;
  actions: ChatMenuAction[];
  onSelect: (key: string) => void;
  onClose: () => void;
}

/**
 * Bottom action sheet for chat-level actions (new / compact / archive / delete).
 * Tapping the scrim or an action closes the sheet.
 */
export const ChatMenuSheet: React.FC<Props> = ({
  visible,
  actions,
  onSelect,
  onClose,
}) => {
  const t = useTheme();
  const c = t.colors;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <SafeAreaView edges={['bottom']} style={styles.sheetWrap}>
          <Pressable
            style={[
              styles.sheet,
              {backgroundColor: c.surface, borderRadius: t.radius.lg},
            ]}
            // Stop taps inside the sheet from closing it via the scrim.
            onPress={() => {}}>
            {actions.map(a => {
              const color = a.disabled
                ? c.onSurfaceVariant
                : a.destructive
                ? c.error
                : c.onSurface;
              return (
                <Pressable
                  key={a.key}
                  disabled={a.disabled}
                  onPress={() => onSelect(a.key)}
                  style={({pressed}) => [
                    styles.row,
                    {
                      backgroundColor: pressed
                        ? c.surfaceVariant
                        : 'transparent',
                      borderRadius: t.radius.md,
                      opacity: a.disabled ? 0.5 : 1,
                    },
                  ]}>
                  <Text style={styles.icon}>{a.icon}</Text>
                  <View style={styles.labels}>
                    <Text style={[styles.label, {color}]}>{a.label}</Text>
                    {a.detail ? (
                      <Text
                        style={[styles.detail, {color: c.onSurfaceVariant}]}>
                        {a.detail}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </Pressable>
        </SafeAreaView>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  scrim: {flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end'},
  sheetWrap: {paddingHorizontal: 12, paddingBottom: 12},
  sheet: {padding: 8, gap: 2},
  row: {flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14},
  icon: {fontSize: 18, width: 24, textAlign: 'center'},
  labels: {flex: 1},
  label: {fontSize: 16, fontFamily: fonts.medium},
  detail: {fontSize: 12, marginTop: 2, fontFamily: fonts.regular},
});
