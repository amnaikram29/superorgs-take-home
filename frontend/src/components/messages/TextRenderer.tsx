import { Box, Text } from '@chakra-ui/react';

interface Props {
  text: string;
  streaming?: boolean;
}

export default function TextRenderer({ text, streaming }: Props) {
  if (!text) return null;

  const paragraphs = text.split(/\n{2,}/);

  return (
    <Box>
      {paragraphs.map((para, i) => (
        <Text
          key={i}
          fontSize="sm"
          lineHeight="1.7"
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
