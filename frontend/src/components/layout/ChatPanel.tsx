import { Box, Flex, Spinner } from '@chakra-ui/react';
import { useColorMode } from '../ui/color-mode';
import { useEffect, useRef } from 'react';
import type { Message, LiveMessage } from '../../api/types';
import MessageBubble from '../messages/MessageBubble';
import EmptyState from '../messages/EmptyState';
import InputBar from './InputBar';

interface Props {
  messages: Message[];
  liveMessage: LiveMessage | null;
  streaming: boolean;
  loadingHistory: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}

export default function ChatPanel({
  messages,
  liveMessage,
  streaming,
  loadingHistory,
  onSend,
  onStop,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const { colorMode } = useColorMode();
  const isDark = colorMode === 'dark';
  const bg = isDark ? '#131720' : '#f7fafc';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, liveMessage?.parts.length, streaming]);

  const isEmpty = messages.length === 0 && !liveMessage && !loadingHistory;

  return (
    <Flex direction="column" flex={1} bg={bg} h="100vh" overflow="hidden">
      <Box
        flex={1}
        overflowY="auto"
        py={6}
        css={{
          '&::-webkit-scrollbar': { width: '6px' },
          '&::-webkit-scrollbar-thumb': { background: '#718096', borderRadius: '3px' },
        }}
      >
        {loadingHistory ? (
          <Flex justify="center" pt={16}>
            <Spinner size="md" color="blue.400" />
          </Flex>
        ) : isEmpty ? (
          <EmptyState onSend={onSend} disabled={streaming} />
        ) : (
          <Box maxW="780px" mx="auto" px={4}>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} onSend={onSend} />
            ))}
            {liveMessage && (
              <MessageBubble message={liveMessage} streaming={streaming} onSend={onSend} />
            )}
            <div ref={bottomRef} />
          </Box>
        )}
      </Box>

      <Box maxW="780px" w="full" mx="auto">
        <InputBar onSend={onSend} onStop={onStop} streaming={streaming} disabled={loadingHistory} />
      </Box>
    </Flex>
  );
}
