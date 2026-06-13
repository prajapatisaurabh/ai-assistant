import React, {useEffect, useRef, useState} from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTheme} from '@/theme/ThemeProvider';
import {useConversationStore} from '@/store/conversationStore';
import {useSettingsStore} from '@/store/settingsStore';
import {useAssistant} from '@/hooks/useAssistant';
import {MessageBubble} from '@/components/MessageBubble';
import {ToneSelector} from '@/components/ToneSelector';
import {fonts} from '@/theme/typography';
import {ChatMessage, Tone} from '@/types';

export const ChatScreen: React.FC = () => {
  const t = useTheme();
  const c = t.colors;
  const defaultTone = useSettingsStore(s => s.defaultTone);
  const [tone, setTone] = useState<Tone>(defaultTone);
  const [input, setInput] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const {conversations, activeId, newConversation} = useConversationStore();

  // Ensure there is always an active conversation, created in an effect rather
  // than during render to avoid updating the store mid-render.
  useEffect(() => {
    if (!activeId) {
      newConversation();
    }
  }, [activeId, newConversation]);

  const conversationId = activeId ?? '';
  const messages = conversations[conversationId]?.messages ?? [];

  const {send, regenerate, busy, cancel} = useAssistant(conversationId);

  const onSend = () => {
    send(input, tone);
    setInput('');
    requestAnimationFrame(() =>
      listRef.current?.scrollToEnd({animated: true}),
    );
  };

  return (
    <SafeAreaView style={[styles.flex, {backgroundColor: c.background}]} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={{paddingVertical: 12, flexGrow: 1}}
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({animated: true})
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, {color: c.onSurface}]}>
                How can I help?
              </Text>
              <Text style={{color: c.onSurfaceVariant, textAlign: 'center'}}>
                Paste text to improve, share an article to turn into posts, or
                just ask.
              </Text>
            </View>
          }
          renderItem={({item}) => (
            <MessageBubble
              message={item}
              onRegenerate={
                item.role === 'assistant'
                  ? () => regenerate(item.id, item.tone ?? tone)
                  : undefined
              }
            />
          )}
        />

        <View style={[styles.composer, {borderTopColor: c.outline, backgroundColor: c.surface}]}>
          <ToneSelector value={tone} onChange={setTone} />
          <View style={styles.inputRow}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Message AI Assistant…"
              placeholderTextColor={c.onSurfaceVariant}
              multiline
              style={[
                styles.input,
                {
                  color: c.onSurface,
                  backgroundColor: c.surfaceVariant,
                  borderRadius: t.radius.lg,
                },
              ]}
            />
            <Pressable
              onPress={busy ? cancel : onSend}
              style={[styles.sendBtn, {backgroundColor: c.primary}]}>
              <Text style={{color: c.onPrimary, fontWeight: '700'}}>
                {busy ? '■' : '↑'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flex: {flex: 1},
  empty: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8},
  emptyTitle: {fontSize: 22, fontFamily: fonts.bold},
  composer: {borderTopWidth: StyleSheet.hairlineWidth, padding: 8, gap: 8},
  inputRow: {flexDirection: 'row', alignItems: 'flex-end', gap: 8},
  input: {flex: 1, maxHeight: 120, minHeight: 44, paddingHorizontal: 14, paddingTop: 12, fontSize: 15, fontFamily: fonts.regular},
  sendBtn: {width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center'},
});
