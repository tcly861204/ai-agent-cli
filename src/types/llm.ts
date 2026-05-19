import type { AgentMessage, ContentBlock } from './agent';

export interface LLMProvider {
  readonly name: string;
  readonly model: string;

  generate(
    messages: AgentMessage[],
    tools?: ToolDefinition[],
    options?: GenerateOptions,
  ): Promise<GenerateResult>;

  generateStream(
    messages: AgentMessage[],
    tools?: ToolDefinition[],
    options?: GenerateOptions,
  ): AsyncIterable<StreamChunk>;
}

export interface GenerateOptions {
  maxTokens?: number;
  temperature?: number;
  system?: string;
  signal?: AbortSignal;
}

export interface GenerateResult {
  message: AgentMessage;
  usage?: TokenUsage;
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'error';
}

export interface StreamChunk {
  type: 'text_delta' | 'tool_use_start' | 'tool_use_delta' | 'stop';
  text?: string;
  toolName?: string;
  toolId?: string;
  toolArgs?: string;
  stopReason?: string;
}

export interface TokenUsage {
  input: number;
  output: number;
  cacheRead?: number;
  cacheWrite?: number;
}

import type { ToolDefinition } from './tool';
