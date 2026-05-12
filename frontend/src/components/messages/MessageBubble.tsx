import { Box, Flex, VStack } from '@chakra-ui/react';
import { useColorMode } from '../ui/color-mode';
import type { Message, LiveMessage } from '../../api/types';
import PartRouter from './PartRouter';

interface Props {
  message: Message | (LiveMessage & { id?: string });
  streaming?: boolean;
  onSend?: (query: string) => void;
}

export default function MessageBubble({ message, streaming, onSend }: Props) {
  const isUser = message.role === 'user';
  const { colorMode } = useColorMode();
  const isDark = colorMode === 'dark';

  const userBg = '#3182ce';
  const assistantBg = isDark ? '#1e2533' : 'white';
  const assistantBorder = isDark ? '#2d3748' : '#e2e8f0';

  const parts = 'content' in message ? message.content : message.parts;

  return (
    <Flex justify={isUser ? 'flex-end' : 'flex-start'} mb={4} px={2}>
      <Box
        maxW={isUser ? '75%' : '90%'}
        bg={isUser ? userBg : assistantBg}
        color={isUser ? 'white' : 'inherit'}
        border={isUser ? 'none' : '1px solid'}
        borderColor={isUser ? undefined : assistantBorder}
        borderRadius={isUser ? '2xl' : 'xl'}
        px={isUser ? 4 : 5}
        py={isUser ? 3 : 4}
      >
        <VStack align="stretch" gap={3}>
          {parts.map((part, i) => (
            <PartRouter
              key={i}
              part={part}
              streaming={streaming && i === parts.length - 1}
              onSend={onSend}
            />
          ))}
        </VStack>
      </Box>
    </Flex>
  );
}
