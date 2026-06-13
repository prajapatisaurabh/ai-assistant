import {useEffect} from 'react';
import {Overlay} from '@/native/OverlayModule';
import {useConversationStore} from '@/store/conversationStore';

/**
 * Bridges native overlay events into app state.
 *
 * When the user picks a quick action from the floating bubble (e.g. "Improve"
 * on freshly copied text), the native side emits an event carrying the text.
 * We seed a new conversation so the panel opens with that context. Clipboard
 * text is used transiently and never persisted by the native layer.
 */
export function useOverlayEvents() {
  useEffect(() => {
    const unsub = Overlay.addListener(event => {
      switch (event.type) {
        case 'quickAction': {
          const store = useConversationStore.getState();
          const id = store.newConversation();
          const prompt =
            event.action === 'improve'
              ? `Improve this text:\n\n${event.text}`
              : event.action === 'summarize'
              ? `Summarize this:\n\n${event.text}`
              : `Create social posts from this:\n\n${event.text}`;
          store.addMessage(id, {role: 'user', content: prompt});
          break;
        }
        case 'bubbleTapped':
        case 'clipboardChanged':
          // The native panel handles these; nothing to do in JS for now.
          break;
      }
    });
    return unsub;
  }, []);
}
