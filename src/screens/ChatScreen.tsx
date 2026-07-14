import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
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
import {ChatMenuSheet, ChatMenuAction} from '@/components/ChatMenuSheet';
import {api} from '@/services/api';
import {fonts} from '@/theme/typography';
import {ChatMessage, Tone} from '@/types';

export const ChatScreen: React.FC = () => {
  const t = useTheme();
  const c = t.colors;
  const defaultTone = useSettingsStore(s => s.defaultTone);
  const [tone, setTone] = useState<Tone>(defaultTone);
  const [input, setInput] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [compacting, setCompacting] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const conversations = useConversationStore(s => s.conversations);
  const activeId = useConversationStore(s => s.activeId);
  const newConversation = useConversationStore(s => s.newConversation);
  const archiveConversation = useConversationStore(s => s.archiveConversation);
  const deleteConversation = useConversationStore(s => s.deleteConversation);

  // Ensure there is always an active conversation, created in an effect rather
  // than during render to avoid updating the store mid-render.
  useEffect(() => {
    if (!activeId) {
      newConversation();
    }
  }, [activeId, newConversation]);

  const conversationId = activeId ?? '';
  const conversation = conversations[conversationId];
  const messages = conversation?.messages ?? [];
  const hasMessages = messages.length > 0;

  const {send, regenerate, busy, cancel} = useAssistant(conversationId);

  // Keep the current tone in a ref so the regenerate dispatcher can stay
  // stable across renders (tone changes shouldn't recreate list callbacks).
  const toneRef = useRef(tone);
  toneRef.current = tone;

  // Single stable callback shared by every bubble (dispatcher pattern). It
  // looks the message up by id and reuses its original tone when available.
  const handleRegenerate = useCallback(
    (id: string) => {
      const msg = useConversationStore
        .getState()
        .conversations[conversationId]?.messages.find(m => m.id === id);
      regenerate(id, msg?.tone ?? toneRef.current);
    },
    [conversationId, regenerate],
  );

  const renderItem = useCallback(
    ({item}: {item: ChatMessage}) => (
      <MessageBubble message={item} onRegenerate={handleRegenerate} />
    ),
    [handleRegenerate],
  );

  const onSend = () => {
    // Guards the Enter key as much as the button: a blank or mid-stream submit
    // would otherwise post an empty turn.
    if (!input.trim() || busy) {
      return;
    }
    send(input, tone);
    setInput('');
    requestAnimationFrame(() =>
      listRef.current?.scrollToEnd({animated: true}),
    );
  };

  const onNewChat = () => {
    setMenuOpen(false);
    if (hasMessages) {
      newConversation();
    }
  };

  const onCompact = async () => {
    setMenuOpen(false);
    if (!hasMessages || busy) {
      return;
    }
    setCompacting(true);
    try {
      const summary = await api.compact(
        messages.map(m => ({role: m.role, content: m.content})),
      );
      newConversation('Continued chat', summary);
    } catch (e) {
      Alert.alert('Couldn’t compact', (e as Error).message);
    } finally {
      setCompacting(false);
    }
  };

  const onArchive = () => {
    setMenuOpen(false);
    if (conversationId) {
      archiveConversation(conversationId);
    }
  };

  const onDelete = () => {
    setMenuOpen(false);
    if (!conversationId) {
      return;
    }
    Alert.alert(
      'Delete chat?',
      'This permanently removes this conversation and its messages.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteConversation(conversationId),
        },
      ],
    );
  };

  const menuActions: ChatMenuAction[] = [
    {key: 'new', icon: '✏️', label: 'Start new chat', disabled: !hasMessages},
    {
      key: 'compact',
      icon: '🗜️',
      label: 'Compact & start new',
      detail: 'Summarize this chat and carry it into a fresh one',
      disabled: !hasMessages || busy,
    },
    {key: 'archive', icon: '🗄️', label: 'Archive chat'},
    {key: 'delete', icon: '🗑️', label: 'Delete chat', destructive: true},
  ];

  const onMenuSelect = (key: string) => {
    switch (key) {
      case 'new':
        return onNewChat();
      case 'compact':
        return onCompact();
      case 'archive':
        return onArchive();
      case 'delete':
        return onDelete();
    }
  };

  return (
    <SafeAreaView
      style={[styles.flex, {backgroundColor: c.background}]}
      edges={['top']}>
      <View style={[styles.header, {borderBottomColor: c.outline}]}>
        <Text style={[styles.headerTitle, {color: c.onSurface}]} numberOfLines={1}>
          {conversation?.title ?? 'New chat'}
        </Text>
        <Pressable
          onPress={() => setMenuOpen(true)}
          hitSlop={10}
          style={styles.menuBtn}>
          <Text style={[styles.menuDots, {color: c.onSurfaceVariant}]}>⋯</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={{paddingVertical: 12, flexGrow: 1}}
          removeClippedSubviews
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={11}
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({animated: true})
          }
          ListHeaderComponent={
            conversation?.context ? (
              <View
                style={[
                  styles.contextBanner,
                  {backgroundColor: c.surfaceVariant, borderRadius: t.radius.md},
                ]}>
                <Text style={[styles.contextLabel, {color: c.onSurfaceVariant}]}>
                  🗜️ Continued from a previous chat — earlier context is
                  remembered.
                </Text>
              </View>
            ) : null
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
          renderItem={renderItem}
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
              // Enter sends. `submitBehavior="submit"` fires onSubmitEditing
              // without blurring, so the keyboard stays up between turns —
              // unlike blurOnSubmit, which would drop it on every message.
              returnKeyType="send"
              submitBehavior="submit"
              onSubmitEditing={onSend}
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

      {compacting ? (
        <View style={styles.compactingOverlay}>
          <View style={[styles.compactingCard, {backgroundColor: c.surface, borderRadius: t.radius.lg}]}>
            <ActivityIndicator color={c.primary} />
            <Text style={{color: c.onSurface, fontFamily: fonts.medium}}>
              Compacting chat…
            </Text>
          </View>
        </View>
      ) : null}

      <ChatMenuSheet
        visible={menuOpen}
        actions={menuActions}
        onSelect={onMenuSelect}
        onClose={() => setMenuOpen(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flex: {flex: 1},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  headerTitle: {flex: 1, fontSize: 17, fontFamily: fonts.bold},
  menuBtn: {width: 32, height: 32, alignItems: 'center', justifyContent: 'center'},
  menuDots: {fontSize: 24, lineHeight: 24, fontWeight: '700'},
  contextBanner: {marginHorizontal: 12, marginBottom: 8, padding: 10},
  contextLabel: {fontSize: 12, fontFamily: fonts.regular, lineHeight: 17},
  empty: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8},
  emptyTitle: {fontSize: 22, fontFamily: fonts.bold},
  composer: {borderTopWidth: StyleSheet.hairlineWidth, padding: 8, gap: 8},
  inputRow: {flexDirection: 'row', alignItems: 'flex-end', gap: 8},
  input: {flex: 1, maxHeight: 120, minHeight: 44, paddingHorizontal: 14, paddingTop: 12, fontSize: 15, fontFamily: fonts.regular},
  sendBtn: {width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center'},
  compactingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactingCard: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16},
});
