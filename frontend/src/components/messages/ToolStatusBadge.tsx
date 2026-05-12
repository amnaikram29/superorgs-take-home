import { Flex, Spinner, Text } from '@chakra-ui/react';
import { useColorMode } from '../ui/color-mode';

const TOOL_LABELS: Record<string, string> = {
  run_sql: 'Running query',
  render_chart: 'Building chart',
  render_kpi: 'Computing metric',
  render_table: 'Building table',
  render_suggestions: 'Generating suggestions',
};

interface Props {
  toolName: string;
}

export default function ToolStatusBadge({ toolName }: Props) {
  const { colorMode } = useColorMode();
  const isDark = colorMode === 'dark';
  const bg = isDark ? '#2d3748' : '#edf2f7';
  const label = TOOL_LABELS[toolName] ?? `Calling ${toolName}`;

  return (
    <Flex
      align="center"
      gap={2}
      bg={bg}
      borderRadius="full"
      px={3}
      py={1.5}
      display="inline-flex"
      width="fit-content"
    >
      <Spinner size="xs" color="blue.400" />
      <Text fontSize="xs" color="gray.500">
        {label}…
      </Text>
    </Flex>
  );
}
