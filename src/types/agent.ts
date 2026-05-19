export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

export interface AgentMessage {
  role: MessageRole;
  content: string | ContentBlock[];
  name?: string;
  tool_call_id?: string;
}

export type AgentEvent =
  | { type: 'text'; content: string }
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_start'; name: string; id: string }
  | { type: 'tool_end'; id: string; name: string; result: ToolResult }
  | { type: 'error'; message: string }
  | { type: 'done' };

import type { ToolResult } from './tool';

export interface AgentConfig {
  provider: string;
  model: string;
  systemPrompt: string;
  maxTokens: number;
  temperature: number;
  maxToolOutputLength: number;
}
