import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import {ChatMessage} from '@/types';
import {useTheme} from '@/theme/ThemeProvider';
import {fonts} from '@/theme/typography';

interface Props {
  message: ChatMessage;
  onRegenerate?: () => void;
}

export const MessageBubble: React.FC<Props> = ({message, onRegenerate}) => {
  const t = useTheme();
  const c = t.colors;
  const isUser = message.role === 'user';

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
        ]}>
        <Text style={{color: isUser ? c.onPrimary : c.onSurface, fontSize: 15, lineHeight: 21, fontFamily: fonts.regular}}>
          {message.content}
          {message.streaming ? '▋' : ''}
        </Text>

        {!isUser && !message.streaming && (
          <View style={styles.actions}>
            <Pressable onPress={copy} hitSlop={8}>
              <Text style={[styles.action, {color: c.primary}]}>Copy</Text>
            </Pressable>
            {onRegenerate && (
              <Pressable onPress={onRegenerate} hitSlop={8}>
                <Text style={[styles.action, {color: c.primary}]}>
                  Regenerate
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {flexDirection: 'row', paddingHorizontal: 12, marginVertical: 4},
  bubble: {maxWidth: '88%', padding: 12},
  actions: {flexDirection: 'row', gap: 16, marginTop: 8},
  action: {fontSize: 13, fontFamily: fonts.medium},
});
