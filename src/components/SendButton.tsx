import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {useTheme} from '@/theme/ThemeProvider';

interface Props {
  /** A reply is streaming — show Stop instead of Send. */
  busy: boolean;
  /** There is text to send. Ignored while busy (Stop is always enabled). */
  canSend: boolean;
  onSend: () => void;
  onStop: () => void;
}

const SIZE = 44;
const ICON = 18;
const STROKE = 2.5;
const HEAD = 9;

/**
 * Round send / stop button for the chat composer.
 *
 * The icons are drawn with Views rather than text glyphs: every <Text> is
 * patched to JetBrains Mono (theme/typography.ts), whose arrow/square glyphs
 * render small and off-center inside a circle.
 */
export const SendButton: React.FC<Props> = ({busy, canSend, onSend, onStop}) => {
  const c = useTheme().colors;
  const enabled = busy || canSend;
  const bg = enabled ? c.primary : c.surfaceVariant;
  const fg = enabled ? c.onPrimary : c.onSurfaceVariant;

  return (
    <Pressable
      onPress={busy ? onStop : onSend}
      disabled={!enabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={busy ? 'Stop generating' : 'Send message'}
      accessibilityState={{disabled: !enabled}}
      android_ripple={{color: c.onPrimary, borderless: true, radius: SIZE / 2}}
      style={({pressed}) => [
        styles.btn,
        {backgroundColor: bg, opacity: pressed ? 0.85 : 1},
      ]}>
      {busy ? (
        <View style={[styles.stop, {backgroundColor: fg}]} />
      ) : (
        <View style={styles.icon}>
          <View style={[styles.stem, {backgroundColor: fg}]} />
          <View style={[styles.head, {borderColor: fg}]} />
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  btn: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {width: ICON, height: ICON},
  // Up-arrow: a vertical stem plus a chevron made from a square's top+left
  // borders rotated 45°.
  stem: {
    position: 'absolute',
    width: STROKE,
    height: ICON - 3,
    bottom: 1,
    left: (ICON - STROKE) / 2,
    borderRadius: STROKE / 2,
  },
  head: {
    position: 'absolute',
    width: HEAD,
    height: HEAD,
    top: 2,
    left: (ICON - HEAD) / 2,
    borderTopWidth: STROKE,
    borderLeftWidth: STROKE,
    borderTopLeftRadius: 1,
    transform: [{rotate: '45deg'}],
  },
  stop: {width: 14, height: 14, borderRadius: 3},
});
