import { Alert, Text } from '@chakra-ui/react';
import { AlertTriangle } from 'lucide-react';
import type {
  MessagePart,
  LivePart,
  ToolResult,
  ChartResult,
  KpiResult,
  TableResult,
  SuggestionsResult,
} from '../../api/types';
import ChartRenderer from '../renderers/ChartRenderer';
import KpiRenderer from '../renderers/KpiRenderer';
import TableRenderer from '../renderers/TableRenderer';
import SuggestionsRenderer from '../renderers/SuggestionsRenderer';
import TextRenderer from './TextRenderer';
import ToolStatusBadge from './ToolStatusBadge';

interface Props {
  part: MessagePart | LivePart;
  streaming?: boolean;
  onSend?: (query: string) => void;
}

function renderToolResult(
  toolName: string,
  result: ToolResult,
  onSend?: (query: string) => void,
  streaming?: boolean,
) {
  if (toolName === 'run_sql') return null;

  const r = result as unknown as Record<string, unknown>;

  if ('error' in r && typeof r.error === 'string') {
    return (
      <Alert.Root status="error" borderRadius="md" fontSize="sm" py={2}>
        <Alert.Indicator>
          <AlertTriangle size={14} />
        </Alert.Indicator>
        <Alert.Content>
          <Alert.Description>
            <Text fontSize="sm">{r.error}</Text>
          </Alert.Description>
        </Alert.Content>
      </Alert.Root>
    );
  }

  if (r.type === 'chart') return <ChartRenderer data={result as ChartResult} />;
  if (r.type === 'kpi') return <KpiRenderer data={result as KpiResult} />;
  if (r.type === 'table') return <TableRenderer data={result as TableResult} />;
  if (r.type === 'suggestions') {
    return (
      <SuggestionsRenderer
        data={result as SuggestionsResult}
        onSend={onSend ?? (() => {})}
        disabled={streaming}
      />
    );
  }

  return null;
}

export default function PartRouter({ part, streaming, onSend }: Props) {
  if (part.type === 'text') {
    return <TextRenderer text={part.text} />;
  }

  if (part.type === 'tool_call') {
    return renderToolResult(part.tool_name, part.result, onSend, streaming);
  }

  if (part.type === 'live_text') {
    return <TextRenderer text={part.text} streaming={streaming} />;
  }

  if (part.type === 'live_tool') {
    if (!part.result) {
      if (part.tool_name === '__error__') return null;
      return <ToolStatusBadge toolName={part.tool_name} />;
    }
    return renderToolResult(part.tool_name, part.result, onSend, streaming);
  }

  return null;
}
