import { Flex, Button } from '@chakra-ui/react';
import type { SuggestionsResult } from '../../api/types';

interface Props {
  data: SuggestionsResult;
  onSend: (query: string) => void;
  disabled?: boolean;
}

export default function SuggestionsRenderer({ data, onSend, disabled }: Props) {
  return (
    <Flex wrap="wrap" gap={2} mt={1}>
      {data.chips.map((chip, i) => (
        <Button
          key={i}
          size="sm"
          variant="outline"
          colorPalette="blue"
          borderRadius="full"
          fontWeight="400"
          fontSize="xs"
          onClick={() => onSend(chip.query)}
          disabled={disabled}
        >
          {chip.label}
        </Button>
      ))}
    </Flex>
  );
}
