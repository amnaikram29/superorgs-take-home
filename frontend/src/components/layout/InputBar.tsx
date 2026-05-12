import { Flex, Textarea, IconButton, Box } from '@chakra-ui/react';
import { useColorMode } from '../ui/color-mode';
import { ArrowUp, Square } from 'lucide-react';
import { useState, useRef, useCallback } from 'react';
import type { KeyboardEvent } from 'react';

interface Props {
  onSend: (text: string) => void;
  onStop: () => void;
  streaming: boolean;
  disabled?: boolean;
}

export default function InputBar({ onSend, onStop, streaming, disabled }: Props) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { colorMode } = useColorMode();
  const isDark = colorMode === 'dark';

  const borderColor = isDark ? '#4a5568' : '#e2e8f0';
  const bg = isDark ? '#1a202c' : 'white';
  const wrapperBg = isDark ? '#2d3748' : '#f7fafc';

  const submit = useCallback(() => {
    const text = value.trim();
    if (!text || disabled) return;
    setValue('');
    onSend(text);
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    },
    [submit],
  );

  return (
    <Box px={4} py={3} borderTop="1px solid" borderColor={borderColor} bg={bg}>
      <Flex
        align="flex-end"
        gap={2}
        border="1px solid"
        borderColor={borderColor}
        borderRadius="xl"
        p={2}
        bg={wrapperBg}
        _focusWithin={{ borderColor: 'blue.400' }}
        transition="border-color 0.15s"
      >
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about any S&P 500 stock…"
          variant="outline"
          resize="none"
          border="none"
          outline="none"
          _focus={{ boxShadow: 'none', borderColor: 'transparent' }}
          minH="40px"
          maxH="160px"
          rows={1}
          fontSize="sm"
          px={2}
          py={1}
          flex={1}
          disabled={disabled}
          bg="transparent"
        />
        {streaming ? (
          <IconButton
            aria-label="Stop"
            variant="ghost"
            colorPalette="red"
            size="sm"
            onClick={onStop}
            borderRadius="lg"
          >
            <Square size={14} />
          </IconButton>
        ) : (
          <IconButton
            aria-label="Send"
            colorPalette="blue"
            size="sm"
            onClick={submit}
            disabled={!value.trim() || disabled}
            borderRadius="lg"
          >
            <ArrowUp size={14} />
          </IconButton>
        )}
      </Flex>
      <Flex justify="flex-end" mt={1}>
        <Box fontSize="xs" color="gray.500">
          Enter to send · Shift+Enter for newline
        </Box>
      </Flex>
    </Box>
  );
}
