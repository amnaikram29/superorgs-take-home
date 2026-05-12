import { Flex, Button } from '@chakra-ui/react';
import { useColorMode } from '../ui/color-mode';
import type { SuggestionsResult } from '../../api/types';

interface Props {
  data: SuggestionsResult;
  onSend: (query: string) => void;
  disabled?: boolean;
}

export default function SuggestionsRenderer({ data, onSend, disabled }: Props) {
  const { colorMode } = useColorMode();
  const d = colorMode === 'dark';

  const border      = d ? '#2d3748' : '#e2e8f0';
  const color       = d ? '#90cdf4' : '#2b6cb0';
  const hoverBorder = d ? '#4299e1' : '#3182ce';
  const hoverBg     = d ? '#1e2d3d' : '#ebf8ff';
  const hoverColor  = d ? '#63b3ed' : '#2c5282';

  return (
    <Flex wrap="wrap" gap={2} mt={1}>
      {data.chips.map((chip, i) => (
        <Button
          key={i}
          size="sm"
          variant="outline"
          borderRadius="full"
          fontWeight="400"
          fontSize="xs"
          borderColor={border}
          color={color}
          bg="transparent"
          onClick={() => onSend(chip.query)}
          disabled={disabled}
          _hover={{ borderColor: hoverBorder, bg: hoverBg, color: hoverColor }}
        >
          {chip.label}
        </Button>
      ))}
    </Flex>
  );
}
