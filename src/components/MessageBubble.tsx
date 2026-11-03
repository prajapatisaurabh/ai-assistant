import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import {
  NavigationProp,
  ParamListBase,
  useNavigation,
} from '@react-navigation/native';
import {ChatMessage} from '@/types';
import {useTheme} from '@/theme/ThemeProvider';
import {fonts} from '@/theme/typography';

interface Props {
  message: ChatMessage;
  /** Dispatcher-style callback: receives the message id to regenerate. */
  onRegenerate?: (id: string) => void;
}

/** Failures only the user can fix — offer a shortcut to where the fix lives. */
const NEEDS_SETTINGS = new Set(['auth', 'quota']);

const MessageBubbleComponent: React.FC<Props> = ({message, onRegenerate}) => {
  const t = useTheme();
  const c = t.colors;
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const isUser = message.role === 'user';
  const failed = !!message.error;
  const canRegenerate = !isUser && !message.streaming && !!onRegenerate;

  const copy = () => Clipboard.setString(message.content);

  return (
    <View style={[styles.row, {justifyContent: isUser ? 'flex-end' : 'flex-start'}]}>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: isUser ? c.primary : c.surfaceVariant,
            borderTopRightRadius: isUser ? 4 : t.radius.lg,
            borderTopLeftRadius: isUser ? t.radius.lg : 4,
            borderRadius: t.radius.lg,
          },
          failed ? {borderWidth: 1, borderColor: c.error} : null,
        ]}>
        {failed ? (
          <Text style={[styles.errorTitle, {color: c.error}]}>
            Couldn’t get a reply
          </Text>
        ) : null}
        <Text style={{color: isUser ? c.onPrimary : c.onSurface, fontSize: 15, lineHeight: 21, fontFamily: fonts.regular}}>
          {message.content}
          {message.streaming ? '▋' : ''}
        </Text>

        {!isUser && !message.streaming ? (
          <View style={styles.actions}>
            {failed && NEEDS_SETTINGS.has(message.error ?? '') ? (
              <Pressable onPress={() => navigation.navigate('Settings')} hitSlop={8}>
                <Text style={[styles.action, {color: c.primary}]}>
                  Open Settings
                </Text>
              </Pressable>
            ) : null}
            {failed ? null : (
              <Pressable onPress={copy} hitSlop={8}>
                <Text style={[styles.action, {color: c.primary}]}>Copy</Text>
              </Pressable>
            )}
            {canRegenerate ? (
              <Pressable
                onPress={() => onRegenerate?.(message.id)}
                hitSlop={8}>
                <Text style={[styles.action, {color: c.primary}]}>
                  {failed ? 'Retry' : 'Regenerate'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
};

/**
 * Memoized so a streaming response only re-renders its own bubble, not the
 * whole list. Relies on a stable `onRegenerate` reference from the parent.
 */
export const MessageBubble = React.memo(MessageBubbleComponent);

const styles = StyleSheet.create({
  row: {flexDirection: 'row', paddingHorizontal: 12, marginVertical: 4},
  bubble: {maxWidth: '88%', padding: 12},
  actions: {flexDirection: 'row', gap: 16, marginTop: 8},
  action: {fontSize: 13, fontFamily: fonts.medium},
  errorTitle: {fontSize: 13, fontFamily: fonts.bold, marginBottom: 4},
});
