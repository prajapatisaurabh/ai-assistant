import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import {mmkvStorage} from '@/services/storage';
import {ChatMessage, Conversation, Tone} from '@/types';

const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

interface ConversationState {
  conversations: Record<string, Conversation>;
  activeId: string | null;
  order: string[]; // most-recent-first

  newConversation: (title?: string) => string;
  setActive: (id: string) => void;
  deleteConversation: (id: string) => void;
  addMessage: (
    conversationId: string,
    message: Omit<ChatMessage, 'id' | 'createdAt'>,
  ) => string;
  appendToMessage: (
    conversationId: string,
    messageId: string,
    chunk: string,
  ) => void;
  finalizeMessage: (
    conversationId: string,
    messageId: string,
    tone?: Tone,
  ) => void;
  replaceMessageContent: (
    conversationId: string,
    messageId: string,
    content: string,
  ) => void;
  clearAll: () => void;
}

export const useConversationStore = create<ConversationState>()(
  persist(
    (set, get) => ({
      conversations: {},
      activeId: null,
      order: [],

      newConversation: title => {
        const id = uid();
        const now = Date.now();
        const convo: Conversation = {
          id,
          title: title ?? 'New chat',
          messages: [],
          createdAt: now,
          updatedAt: now,
        };
        set(state => ({
          conversations: {...state.conversations, [id]: convo},
          order: [id, ...state.order],
          activeId: id,
        }));
        return id;
      },

      setActive: id => set({activeId: id}),

      deleteConversation: id =>
        set(state => {
          const {[id]: _removed, ...rest} = state.conversations;
          const order = state.order.filter(x => x !== id);
          return {
            conversations: rest,
            order,
            activeId: state.activeId === id ? order[0] ?? null : state.activeId,
          };
        }),

      addMessage: (conversationId, message) => {
        const id = uid();
        set(state => {
          const convo = state.conversations[conversationId];
          if (!convo) {
            return state;
          }
          const full: ChatMessage = {...message, id, createdAt: Date.now()};
          const updated: Conversation = {
            ...convo,
            messages: [...convo.messages, full],
            updatedAt: Date.now(),
            title:
              convo.messages.length === 0 && message.role === 'user'
                ? message.content.slice(0, 40)
                : convo.title,
          };
          return {
            conversations: {...state.conversations, [conversationId]: updated},
            order: [
              conversationId,
              ...state.order.filter(x => x !== conversationId),
            ],
          };
        });
        return id;
      },

      appendToMessage: (conversationId, messageId, chunk) =>
        set(state => {
          const convo = state.conversations[conversationId];
          if (!convo) {
            return state;
          }
          const messages = convo.messages.map(m =>
            m.id === messageId ? {...m, content: m.content + chunk} : m,
          );
          return {
            conversations: {
              ...state.conversations,
              [conversationId]: {...convo, messages, updatedAt: Date.now()},
            },
          };
        }),

      replaceMessageContent: (conversationId, messageId, content) =>
        set(state => {
          const convo = state.conversations[conversationId];
          if (!convo) {
            return state;
          }
          const messages = convo.messages.map(m =>
            m.id === messageId ? {...m, content} : m,
          );
          return {
            conversations: {
              ...state.conversations,
              [conversationId]: {...convo, messages},
            },
          };
        }),

      finalizeMessage: (conversationId, messageId, tone) =>
        set(state => {
          const convo = state.conversations[conversationId];
          if (!convo) {
            return state;
          }
          const messages = convo.messages.map(m =>
            m.id === messageId ? {...m, streaming: false, tone} : m,
          );
          return {
            conversations: {
              ...state.conversations,
              [conversationId]: {...convo, messages},
            },
          };
        }),

      clearAll: () => set({conversations: {}, order: [], activeId: null}),
    }),
    {
      name: 'conversations',
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);
