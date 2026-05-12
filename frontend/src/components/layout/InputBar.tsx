import { Flex, Textarea, IconButton, Box } from '@chakra-ui/react';
import { ArrowUp, Square } from 'lucide-react';
import { useState, useRef, useCallback } from 'react';
import type { KeyboardEvent } from 'react';
import { useColorMode } from '../ui/color-mode';

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
  const d = colorMode === 'dark';

  const wrapperBorder  = d ? '#2d3748' : '#e2e8f0';
  const outerBg        = d ? '#131720' : '#ffffff';
  const innerBg        = d ? '#1a2033' : '#f7fafc';
  const textColor      = d ? '#e2e8f0' : '#1a202c';
  const placeholderClr = d ? '#4a5568' : '#a0aec0';
  const hintColor      = d ? '#4a5568' : '#a0aec0';

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
    <Box
      px={4} py={3}
      borderTop="1px solid"
      borderColor={wrapperBorder}
      bg={outerBg}
    >
      <Flex
        align="flex-end"
        gap={2}
        border="1px solid"
        borderColor={wrapperBorder}
        borderRadius="xl"
        p={2}
        bg={innerBg}
        _focusWithin={{ borderColor: '#4299e1' }}
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
          _placeholder={{ color: placeholderClr }}
          minH="40px"
          maxH="160px"
          rows={1}
          fontSize="sm"
          px={2}
          py={1}
          flex={1}
          disabled={disabled}
          bg="transparent"
          color={textColor}
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
        <Box fontSize="xs" color={hintColor}>
          Enter to send · Shift+Enter for newline
        </Box>
      </Flex>
    </Box>
  );
}
