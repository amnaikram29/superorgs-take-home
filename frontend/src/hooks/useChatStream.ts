import { useState, useCallback, useRef } from 'react';
import type { Message, LiveMessage, ToolResult } from '../api/types';
import { getMessages, getConversation } from '../api/conversations';
import { openSSEStream } from '../api/chat';

export function useChatStream(
  conversationId: string | null,
  onTitleChange?: (id: string, title: string) => void,
) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [liveMessage, setLiveMessage] = useState<LiveMessage | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const loadHistory = useCallback(async (convId: string) => {
    setLoadingHistory(true);
    setLiveMessage(null);
    try {
      const msgs = await getMessages(convId);
      setMessages(msgs);
    } catch (err) {
      console.error('Failed to load history', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!conversationId || streaming) return;

      // Optimistic user message
      const optimisticUser: Message = {
        id: `optimistic-${Date.now()}`,
        conversation_id: conversationId,
        role: 'user',
        content: [{ type: 'text', text }],
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticUser]);

      // Start live assistant message
      const live: LiveMessage = { role: 'assistant', parts: [] };
      setLiveMessage(live);
      setStreaming(true);

      const ac = new AbortController();
      abortRef.current = ac;

      await openSSEStream(
        conversationId,
        text,
        {
          onEvent(event) {
            setLiveMessage((prev) => {
              if (!prev) return prev;
              const parts = [...prev.parts];

              if (event.type === 'text_delta') {
                const last = parts[parts.length - 1];
                if (last?.type === 'live_text') {
                  parts[parts.length - 1] = {
                    ...last,
                    text: last.text + event.content,
                  };
                } else {
                  parts.push({ type: 'live_text', text: event.content });
                }
              }

              if (event.type === 'tool_start') {
                parts.push({
                  type: 'live_tool',
                  call_id: event.call_id,
                  tool_name: event.tool_name,
                });
              }

              if (event.type === 'tool_result') {
                const idx = parts.findIndex(
                  (p) => p.type === 'live_tool' && p.call_id === event.call_id,
                );
                if (idx !== -1) {
                  parts[idx] = {
                    type: 'live_tool',
                    call_id: event.call_id,
                    tool_name: event.tool_name,
                    result: event.result as ToolResult,
                  };
                }
              }

              if (event.type === 'error') {
                parts.push({
                  type: 'live_tool',
                  call_id: `err-${Date.now()}`,
                  tool_name: '__error__',
                  result: { error: event.message } as ToolResult,
                });
              }

              return { ...prev, parts };
            });
          },

          async onDone() {
            setStreaming(false);
            setLiveMessage(null);
            if (conversationId) {
              const msgs = await getMessages(conversationId);
              setMessages(msgs);
              // Check if title was set from the first message
              const firstAssistant = msgs.find((m) => m.role === 'assistant');
              if (firstAssistant && onTitleChange) {
                try {
                  const conv = await getConversation(conversationId);
                  if (conv.title) onTitleChange(conversationId, conv.title);
                } catch {
                  // best-effort
                }
              }
            }
          },

          onError(err) {
            console.error('Stream error', err);
            setStreaming(false);
            setLiveMessage(null);
          },
        },
        ac.signal,
      );
    },
    [conversationId, streaming, onTitleChange],
  );

  const stopStream = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
    setLiveMessage(null);
  }, []);

  return {
    messages,
    liveMessage,
    streaming,
    loadingHistory,
    loadHistory,
    sendMessage,
    stopStream,
  };
}
