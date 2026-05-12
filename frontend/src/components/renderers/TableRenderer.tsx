import { Box, Table, Text } from '@chakra-ui/react';
import { useColorMode } from '../ui/color-mode';
import type { TableResult } from '../../api/types';

interface Props { data: TableResult }

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
  const d = colorMode === 'dark';

  const titleColor  = d ? '#718096'  : '#718096';
  const border      = d ? '#2d3748'  : '#e2e8f0';
  const headerBg    = d ? '#1e2533'  : '#f7fafc';
  const headerColor = d ? '#718096'  : '#4a5568';
  const rowEven     = d ? '#131720'  : '#ffffff';
  const rowOdd      = d ? '#161c27'  : '#f8fafc';
  const rowHover    = d ? '#1e2d3d'  : '#ebf8ff';
  const cellColor   = d ? '#e2e8f0'  : '#2d3748';
  const scrollThumb = d ? '#4a5568'  : '#cbd5e0';

  return (
    <Box w="full">
      {data.title && (
        <Text fontSize="sm" fontWeight="600" mb={2} color={titleColor}>
          {data.title}
        </Text>
      )}
      <Box
        border="1px solid"
        borderColor={border}
        borderRadius="lg"
        overflow="hidden"
        maxH="320px"
        overflowY="auto"
        css={{
          '&::-webkit-scrollbar': { width: '4px' },
          '&::-webkit-scrollbar-thumb': { background: scrollThumb, borderRadius: '2px' },
        }}
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
                  color={headerColor}
                  borderColor={border}
                  whiteSpace="nowrap"
                  py={2}
                >
                  {col}
                </Table.ColumnHeader>
              ))}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {data.rows.map((row, i) => (
              <Table.Row
                key={i}
                bg={i % 2 === 0 ? rowEven : rowOdd}
                _hover={{ bg: rowHover }}
              >
                {data.columns.map((col) => (
                  <Table.Cell
                    key={col}
                    fontSize="sm"
                    color={cellColor}
                    borderColor={border}
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
