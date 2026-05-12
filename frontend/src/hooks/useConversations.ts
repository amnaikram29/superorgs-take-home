import { useState, useEffect, useCallback } from 'react';
import type { Conversation } from '../api/types';
import { listConversations, createConversation } from '../api/conversations';

const STORAGE_KEY = 'sp500_active_conv_id';

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const convs = await listConversations();
      setConversations(convs);

      const stored = localStorage.getItem(STORAGE_KEY);
      const valid = stored && convs.some((c) => c.id === stored);

      if (valid) {
        setActiveId(stored);
      } else if (convs.length > 0) {
        setActiveId(convs[0].id);
      } else {
        const created = await createConversation();
        setConversations([created]);
        setActiveId(created.id);
      }
    } catch (err) {
      console.error('Failed to load conversations', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (activeId) localStorage.setItem(STORAGE_KEY, activeId);
  }, [activeId]);

  const selectConversation = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const addConversation = useCallback(async (): Promise<Conversation> => {
    const created = await createConversation();
    setConversations((prev) => [created, ...prev]);
    setActiveId(created.id);
    return created;
  }, []);

  const updateTitle = useCallback((id: string, title: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c)),
    );
  }, []);

  return {
    conversations,
    activeId,
    loading,
    selectConversation,
    addConversation,
    updateTitle,
    reload: load,
  };
}
