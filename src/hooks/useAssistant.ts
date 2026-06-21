import {useCallback, useRef, useState} from 'react';
import {api} from '@/services/api';
import {useConversationStore} from '@/store/conversationStore';
import {Tone} from '@/types';

/**
 * Orchestrates a streaming chat turn: pushes the user message, creates an
 * empty assistant message, then streams tokens into it. Supports cancel and
 * regenerate.
 */
export function useAssistant(conversationId: string) {
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const {addMessage, appendToMessage, finalizeMessage, replaceMessageContent} =
    useConversationStore.getState();

  const runStream = useCallback(
    (assistantId: string, tone: Tone) => {
      const convo = useConversationStore.getState().conversations[conversationId];
      if (!convo) {
        return;
      }
      const controller = new AbortController();
      abortRef.current = controller;
      setBusy(true);

      api.streamChat(
        {
          conversationId,
          tone,
          context: convo.context,
          messages: convo.messages
            .filter(m => m.id !== assistantId)
            .map(m => ({role: m.role, content: m.content})),
        },
        {
          signal: controller.signal,
          onChunk: chunk => appendToMessage(conversationId, assistantId, chunk),
          onDone: () => {
            finalizeMessage(conversationId, assistantId, tone);
            setBusy(false);
          },
          onError: err => {
            replaceMessageContent(
              conversationId,
              assistantId,
              `⚠️ ${err.message}`,
            );
            finalizeMessage(conversationId, assistantId, tone);
            setBusy(false);
          },
        },
      );
    },
    [conversationId, appendToMessage, finalizeMessage, replaceMessageContent],
  );

  const send = useCallback(
    (text: string, tone: Tone) => {
      if (!text.trim() || busy) {
        return;
      }
      addMessage(conversationId, {role: 'user', content: text.trim()});
      const assistantId = addMessage(conversationId, {
        role: 'assistant',
        content: '',
        streaming: true,
      });
      runStream(assistantId, tone);
    },
    [busy, conversationId, addMessage, runStream],
  );

  const regenerate = useCallback(
    (assistantId: string, tone: Tone) => {
      if (busy) {
        return;
      }
      // Clear the previous answer, then re-stream from the same history.
      replaceMessageContent(conversationId, assistantId, '');
      runStream(assistantId, tone);
    },
    [busy, conversationId, replaceMessageContent, runStream],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setBusy(false);
  }, []);

  return {send, regenerate, cancel, busy};
}
