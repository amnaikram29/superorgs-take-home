import { Box, Text } from '@chakra-ui/react';
import { useColorMode } from '../ui/color-mode';

interface Props {
  text: string;
  streaming?: boolean;
}

export default function TextRenderer({ text, streaming }: Props) {
  const { colorMode } = useColorMode();
  const color = colorMode === 'dark' ? '#e2e8f0' : '#1a202c';

  if (!text) return null;

  const paragraphs = text.split(/\n{2,}/);

  return (
    <Box>
      {paragraphs.map((para, i) => (
        <Text
          key={i}
          fontSize="sm"
          lineHeight="1.7"
          color={color}
          mb={i < paragraphs.length - 1 ? 3 : 0}
          whiteSpace="pre-wrap"
        >
          {para}
          {streaming && i === paragraphs.length - 1 && (
            <span className="cursor-blink" />
          )}
        </Text>
      ))}
    </Box>
  );
}
