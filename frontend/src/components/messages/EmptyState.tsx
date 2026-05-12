import { Box, Flex, Heading, Text, VStack, SimpleGrid, Button } from '@chakra-ui/react';
import { useColorMode } from '../ui/color-mode';

const EXAMPLE_QUESTIONS = [
  { label: 'AAPL trend in 2017',   query: 'How did AAPL trend in 2017?' },
  { label: 'Compare AAPL vs MSFT', query: 'Compare AAPL and MSFT performance in 2017.' },
  { label: 'Most volatile stocks', query: 'Which 10 stocks were most volatile in 2016?' },
  { label: "TSLA's worst week",    query: "What was TSLA's worst week in the dataset?" },
  { label: 'S&P sector trends',    query: 'How did financial sector stocks trend in 2015?' },
  { label: 'Highest closing price',query: "What was AAPL's highest closing price ever?" },
];

interface Props {
  onSend: (query: string) => void;
  disabled?: boolean;
}

export default function EmptyState({ onSend, disabled }: Props) {
  const { colorMode } = useColorMode();
  const d = colorMode === 'dark';

  const titleColor  = d ? '#ffffff'  : '#1a202c';
  const bodyColor   = d ? '#718096'  : '#4a5568';
  const labelColor  = d ? '#4a5568'  : '#a0aec0';
  const chipBg      = d ? '#1a2033'  : '#ffffff';
  const chipBorder  = d ? '#2d3748'  : '#e2e8f0';
  const chipColor   = d ? '#a0aec0'  : '#2d3748';
  const chipHoverBg = d ? '#1e2d3d'  : '#ebf8ff';
  const chipHoverBorder = d ? '#4299e1' : '#3182ce';
  const chipHoverColor  = d ? '#63b3ed' : '#2b6cb0';

  return (
    <Flex direction="column" align="center" justify="center" flex={1} px={6} pb={8} minH="60vh">
      <VStack gap={3} mb={10} textAlign="center">
        <Heading size="md" fontWeight="700" color={titleColor}>
          S&P 500 Analytics
        </Heading>
        <Text fontSize="sm" color={bodyColor} maxW="380px">
          Ask questions about historical stock prices, trends, comparisons, and more.
          Data covers ~500 S&P 500 stocks from 2013–2018.
        </Text>
      </VStack>

      <Box w="full" maxW="560px">
        <Text fontSize="xs" color={labelColor} mb={3} textTransform="uppercase" letterSpacing="wider">
          Try asking
        </Text>
        <SimpleGrid columns={2} gap={2}>
          {EXAMPLE_QUESTIONS.map((q) => (
            <Button
              key={q.query}
              variant="outline"
              size="sm"
              justifyContent="flex-start"
              textAlign="left"
              fontWeight="400"
              fontSize="sm"
              bg={chipBg}
              borderColor={chipBorder}
              color={chipColor}
              borderRadius="lg"
              whiteSpace="normal"
              h="auto"
              py={3}
              px={4}
              onClick={() => onSend(q.query)}
              disabled={disabled}
              _hover={{ borderColor: chipHoverBorder, color: chipHoverColor, bg: chipHoverBg }}
            >
              {q.label}
            </Button>
          ))}
        </SimpleGrid>
      </Box>
    </Flex>
  );
}
