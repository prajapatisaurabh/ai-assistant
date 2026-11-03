import {useCallback, useRef, useState} from 'react';
import {ApiError, api} from '@/services/api';
import {useConversationStore} from '@/store/conversationStore';

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
    (assistantId: string) => {
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
          context: convo.context,
          // Failed turns hold our own error text, not model output — keep
          // them out of the history the model sees.
          messages: convo.messages
            .filter(m => m.id !== assistantId && !m.error)
            .map(m => ({role: m.role, content: m.content})),
        },
        {
          signal: controller.signal,
          onChunk: chunk => appendToMessage(conversationId, assistantId, chunk),
          onDone: () => {
            finalizeMessage(conversationId, assistantId);
            setBusy(false);
          },
          onError: err => {
            // Any partial reply is replaced by the error, which the bubble
            // renders as an error (with a Settings shortcut for key/quota).
            replaceMessageContent(conversationId, assistantId, err.message);
            finalizeMessage(
              conversationId,
              assistantId,
              err instanceof ApiError ? err.kind : 'other',
            );
            setBusy(false);
          },
        },
      );
    },
    [conversationId, appendToMessage, finalizeMessage, replaceMessageContent],
  );

  const send = useCallback(
    (text: string) => {
      if (!text.trim() || busy) {
        return;
      }
      addMessage(conversationId, {role: 'user', content: text.trim()});
      const assistantId = addMessage(conversationId, {
        role: 'assistant',
        content: '',
        streaming: true,
      });
      runStream(assistantId);
    },
    [busy, conversationId, addMessage, runStream],
  );

  const regenerate = useCallback(
    (assistantId: string) => {
      if (busy) {
        return;
      }
      // Clear the previous answer, then re-stream from the same history.
      replaceMessageContent(conversationId, assistantId, '');
      runStream(assistantId);
    },
    [busy, conversationId, replaceMessageContent, runStream],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setBusy(false);
  }, []);

  return {send, regenerate, cancel, busy};
}
