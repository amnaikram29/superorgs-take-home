export interface Conversation {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

// A single part inside a message's content array
export type MessagePart =
  | TextPart
  | ToolCallPart;

export interface TextPart {
  type: 'text';
  text: string;
}

export interface ToolCallPart {
  type: 'tool_call';
  call_id: string;
  tool_name: string;
  input: Record<string, unknown>;
  result: ToolResult;
}

// Possible tool result shapes
export type ToolResult =
  | ChartResult
  | KpiResult
  | TableResult
  | SuggestionsResult
  | SqlResult
  | ErrorResult
  | OkResult;

export interface ChartResult {
  type: 'chart';
  chart_type: 'line' | 'bar' | 'area';
  title: string;
  data: Record<string, unknown>[];
  x_key: string;
  y_keys: string[];
  x_label?: string | null;
  y_label?: string | null;
}

export interface KpiResult {
  type: 'kpi';
  label: string;
  value: string;
  delta?: string | null;
  delta_direction?: 'up' | 'down' | null;
}

export interface TableResult {
  type: 'table';
  title: string;
  columns: string[];
  rows: Record<string, unknown>[];
}

export interface SuggestionsResult {
  type: 'suggestions';
  chips: Array<{ label: string; query: string }>;
}

export interface SqlResult {
  columns: string[];
  rows: Record<string, unknown>[];
  row_count: number;
}

export interface ErrorResult {
  error: string;
}

export interface OkResult {
  ok: boolean;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: MessagePart[];
  created_at: string;
}

// SSE event types from the backend stream
export type SSEEvent =
  | { type: 'text_delta'; content: string }
  | { type: 'tool_start'; call_id: string; tool_name: string }
  | { type: 'tool_input'; call_id: string; partial_json: string }
  | { type: 'tool_result'; call_id: string; tool_name: string; result: ToolResult }
  | { type: 'error'; message: string }
  | { type: 'done'; message_id: string | null };

// Live streaming state — a message being built while SSE is active
export interface LiveMessage {
  role: 'assistant';
  parts: LivePart[];
}

export type LivePart =
  | LiveTextPart
  | LiveToolPart;

export interface LiveTextPart {
  type: 'live_text';
  text: string;
}

export interface LiveToolPart {
  type: 'live_tool';
  call_id: string;
  tool_name: string;
  result?: ToolResult;
}
