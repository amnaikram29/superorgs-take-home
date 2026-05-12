import { Box, Table, Text } from '@chakra-ui/react';
import { useColorMode } from '../ui/color-mode';
import type { TableResult } from '../../api/types';

interface Props {
  data: TableResult;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') {
    if (Number.isInteger(value) && Math.abs(value) > 9999) return value.toLocaleString();
    if (!Number.isInteger(value)) return value.toFixed(2);
  }
  return String(value);
}

export default function TableRenderer({ data }: Props) {
  const { colorMode } = useColorMode();
  const isDark = colorMode === 'dark';
  const headerBg = isDark ? '#2d3748' : '#f7fafc';
  const borderColor = isDark ? '#4a5568' : '#e2e8f0';
  const hoverBg = isDark ? '#2d3748' : '#f7fafc';

  return (
    <Box w="full" maxW="700px">
      {data.title && (
        <Text fontSize="sm" fontWeight="600" mb={2} color="gray.500">
          {data.title}
        </Text>
      )}
      <Box
        border="1px solid"
        borderColor={borderColor}
        borderRadius="lg"
        overflow="hidden"
        maxH="320px"
        overflowY="auto"
      >
        <Table.Root size="sm">
          <Table.Header bg={headerBg} position="sticky" top={0} zIndex={1}>
            <Table.Row>
              {data.columns.map((col) => (
                <Table.ColumnHeader
                  key={col}
                  fontSize="xs"
                  textTransform="uppercase"
                  letterSpacing="wider"
                  color="gray.500"
                  borderColor={borderColor}
                  whiteSpace="nowrap"
                >
                  {col}
                </Table.ColumnHeader>
              ))}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {data.rows.map((row, i) => (
              <Table.Row key={i} _hover={{ bg: hoverBg }}>
                {data.columns.map((col) => (
                  <Table.Cell
                    key={col}
                    fontSize="sm"
                    borderColor={borderColor}
                    whiteSpace="nowrap"
                  >
                    {formatCell(row[col])}
                  </Table.Cell>
                ))}
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Box>
    </Box>
  );
}
