import { Box, Button, Flex, Text, VStack, Spinner } from '@chakra-ui/react';
import { Plus, MessageSquare } from 'lucide-react';
import { useColorMode } from '../ui/color-mode';
import type { Conversation } from '../../api/types';

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function Sidebar({ conversations, activeId, loading, onSelect, onNew }: Props) {
  const { colorMode } = useColorMode();
  const d = colorMode === 'dark';

  const bg          = d ? '#0f1117'  : '#ffffff';
  const border      = d ? '#1e2533'  : '#e2e8f0';
  const titleColor  = d ? '#ffffff'  : '#1a202c';
  const activeBg    = d ? '#1e2d3d'  : '#ebf8ff';
  const activeColor = d ? '#63b3ed'  : '#2b6cb0';
  const itemColor   = d ? '#cbd5e0'  : '#2d3748';
  const hoverBg     = d ? '#1a2332'  : '#f7fafc';
  const mutedColor  = d ? '#718096'  : '#a0aec0';
  const btnColor    = d ? '#a0aec0'  : '#718096';
  const btnHoverBg  = d ? '#1e2533'  : '#edf2f7';

  return (
    <Flex
      direction="column"
      w="260px"
      minW="260px"
      h="100vh"
      bg={bg}
      borderRight="1px solid"
      borderColor={border}
      py={4}
    >
      <Flex align="center" justify="space-between" px={4} mb={4}>
        <Flex align="center" gap={2}>
          <MessageSquare size={16} color="#4299e1" />
          <Text fontWeight="700" fontSize="sm" letterSpacing="wide" color={titleColor}>
            S&P 500 Chat
          </Text>
        </Flex>
        <Button
          size="xs"
          variant="ghost"
          onClick={onNew}
          aria-label="New conversation"
          px={2}
          color={btnColor}
          _hover={{ color: titleColor, bg: btnHoverBg }}
        >
          <Plus size={12} />
          New
        </Button>
      </Flex>

      <Box flex={1} overflowY="auto" px={2}>
        {loading ? (
          <Flex justify="center" pt={8}>
            <Spinner size="sm" color="blue.400" />
          </Flex>
        ) : (
          <VStack gap={1} align="stretch">
            {conversations.map((conv) => {
              const isActive = conv.id === activeId;
              return (
                <Button
                  key={conv.id}
                  variant="ghost"
                  justifyContent="flex-start"
                  bg={isActive ? activeBg : 'transparent'}
                  color={isActive ? activeColor : itemColor}
                  _hover={{ bg: isActive ? activeBg : hoverBg }}
                  onClick={() => onSelect(conv.id)}
                  px={3}
                  py={2}
                  h="auto"
                  borderRadius="md"
                  fontWeight={isActive ? '600' : '400'}
                >
                  <Flex direction="column" align="flex-start" w="full" overflow="hidden">
                    <Text fontSize="sm" lineClamp={1} textAlign="left" w="full">
                      {conv.title ?? 'New conversation'}
                    </Text>
                    <Text fontSize="xs" color={mutedColor} mt={0.5}>
                      {relativeTime(conv.updated_at)}
                    </Text>
                  </Flex>
                </Button>
              );
            })}
          </VStack>
        )}
      </Box>
    </Flex>
  );
}
