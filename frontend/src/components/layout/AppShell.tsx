import { Flex, IconButton, Box } from '@chakra-ui/react';
import { Moon, Sun } from 'lucide-react';
import { useEffect } from 'react';
import { useColorMode } from '../ui/color-mode';
import Sidebar from './Sidebar';
import ChatPanel from './ChatPanel';
import { useConversations } from '../../hooks/useConversations';
import { useChatStream } from '../../hooks/useChatStream';

export default function AppShell() {
  const { colorMode, toggleColorMode } = useColorMode();

  const {
    conversations,
    activeId,
    loading: convsLoading,
    selectConversation,
    addConversation,
    updateTitle,
  } = useConversations();

  const {
    messages,
    liveMessage,
    streaming,
    loadingHistory,
    loadHistory,
    sendMessage,
    stopStream,
  } = useChatStream(activeId, updateTitle);

  useEffect(() => {
    if (activeId) loadHistory(activeId);
  }, [activeId, loadHistory]);

  return (
    <Flex h="100vh" overflow="hidden">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        loading={convsLoading}
        onSelect={selectConversation}
        onNew={() => addConversation()}
      />

      <Box flex={1} position="relative" overflow="hidden">
        <IconButton
          aria-label="Toggle color mode"
          variant="ghost"
          size="sm"
          position="absolute"
          top={3}
          right={4}
          zIndex={10}
          onClick={toggleColorMode}
          color={colorMode === 'dark' ? '#a0aec0' : '#4a5568'}
          _hover={{ bg: colorMode === 'dark' ? '#1e2533' : '#edf2f7' }}
        >
          {colorMode === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </IconButton>

        <ChatPanel
          messages={messages}
          liveMessage={liveMessage}
          streaming={streaming}
          loadingHistory={loadingHistory}
          onSend={sendMessage}
          onStop={stopStream}
        />
      </Box>
    </Flex>
  );
}
