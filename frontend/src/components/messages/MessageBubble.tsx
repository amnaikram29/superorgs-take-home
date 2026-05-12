import { Box, Flex, VStack } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { useColorMode } from '../ui/color-mode';
import type { Message, LiveMessage } from '../../api/types';
import PartRouter from './PartRouter';

interface Props {
  message: Message | (LiveMessage & { id?: string });
  streaming?: boolean;
  onSend?: (query: string) => void;
}

const bounce = keyframes`
  0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
  40%            { transform: translateY(-6px); opacity: 1; }
`;

function TypingDots({ color }: { color: string }) {
  const dot = (delay: string) => (
    <Box
      as="span"
      display="inline-block"
      w="7px"
      h="7px"
      borderRadius="full"
      bg={color}
      animation={`${bounce} 1.2s ease-in-out infinite`}
      style={{ animationDelay: delay }}
    />
  );
  return (
    <Flex align="center" gap="5px" py="2px">
      {dot('0s')}
      {dot('0.2s')}
      {dot('0.4s')}
    </Flex>
  );
}

export default function MessageBubble({ message, streaming, onSend }: Props) {
  const isUser = message.role === 'user';
  const { colorMode } = useColorMode();
  const d = colorMode === 'dark';

  const userBg         = d ? '#2b4c7e'  : '#C9E5FC';
  const assistantBg    = d ? '#1a2033'  : '#ffffff';
  const assistantBorder= d ? '#2d3748'  : '#e2e8f0';

  const parts = 'content' in message ? message.content : message.parts;

  // Parts that actually render visible content:
  // - text / live_text with non-empty text
  // - tool_call / live_tool that aren't run_sql (which always returns null)
  const hasVisibleContent = parts.some((p) => {
    if (p.type === 'text') return !!p.text;
    if (p.type === 'live_text') return !!p.text;
    if (p.type === 'tool_call') return p.tool_name !== 'run_sql';
    if (p.type === 'live_tool') return p.tool_name !== 'run_sql' && p.tool_name !== '__error__';
    return false;
  });

  const isWaiting = !isUser && streaming && !hasVisibleContent;

  return (
    <Flex justify={isUser ? 'flex-end' : 'flex-start'} mb={4} px={2}>
      <Box
        maxW={isUser ? '75%' : '90%'}
        bg={isUser ? userBg : assistantBg}
        color={isUser ? (d ? '#ffffff' : '#1a202c') : (d ? '#e2e8f0' : '#1a202c')}
        border={isUser ? 'none' : '1px solid'}
        borderColor={isUser ? undefined : assistantBorder}
        borderRadius={isUser ? '2xl' : 'xl'}
        px={isUser ? 4 : 5}
        py={isUser ? 3 : 4}
      >
        {isWaiting ? (
          <TypingDots color={d ? '#718096' : '#a0aec0'} />
        ) : (
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
        )}
      </Box>
    </Flex>
  );
}
