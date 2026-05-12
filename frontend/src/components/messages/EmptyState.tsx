import { Box, Flex, Heading, Text, VStack, SimpleGrid, Button } from '@chakra-ui/react';
import { useColorMode } from '../ui/color-mode';

const EXAMPLE_QUESTIONS = [
  { label: 'AAPL trend in 2017', query: 'How did AAPL trend in 2017?' },
  { label: 'Compare AAPL vs MSFT', query: 'Compare AAPL and MSFT performance in 2017.' },
  { label: 'Most volatile stocks', query: 'Which 10 stocks were most volatile in 2016?' },
  { label: "TSLA's worst week", query: "What was TSLA's worst week in the dataset?" },
  { label: 'S&P sector trends', query: 'How did financial sector stocks trend in 2015?' },
  { label: 'Highest closing price', query: "What was AAPL's highest closing price ever?" },
];

interface Props {
  onSend: (query: string) => void;
  disabled?: boolean;
}

export default function EmptyState({ onSend, disabled }: Props) {
  const { colorMode } = useColorMode();
  const isDark = colorMode === 'dark';
  const chipBg = isDark ? '#1e2533' : 'white';
  const chipBorder = isDark ? '#2d3748' : '#e2e8f0';

  return (
    <Flex direction="column" align="center" justify="center" flex={1} px={6} pb={8} minH="60vh">
      <VStack gap={3} mb={10} textAlign="center">
        <Heading size="md" fontWeight="700">
          S&P 500 Analytics
        </Heading>
        <Text fontSize="sm" color="gray.500" maxW="380px">
          Ask questions about historical stock prices, trends, comparisons, and more.
          Data covers ~500 S&P 500 stocks from 2013–2018.
        </Text>
      </VStack>

      <Box w="full" maxW="560px">
        <Text fontSize="xs" color="gray.500" mb={3} textTransform="uppercase" letterSpacing="wider">
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
              borderRadius="lg"
              whiteSpace="normal"
              h="auto"
              py={3}
              px={4}
              onClick={() => onSend(q.query)}
              disabled={disabled}
              _hover={{ borderColor: 'blue.400', color: 'blue.400' }}
            >
              {q.label}
            </Button>
          ))}
        </SimpleGrid>
      </Box>
    </Flex>
  );
}
