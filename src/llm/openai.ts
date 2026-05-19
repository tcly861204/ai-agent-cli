import type { LLMProvider, GenerateOptions, GenerateResult, StreamChunk } from './provider';
import type { AgentMessage } from '../types/agent';
import type { ToolDefinition } from '../types/tool';
import type { Config } from '../types/config';

export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';
  readonly model: string;

  constructor(private config: Config) {
    this.model = config.model;
  }

  async generate(
    _messages: AgentMessage[],
    _tools?: ToolDefinition[],
    _options?: GenerateOptions,
  ): Promise<GenerateResult> {
    throw new Error('OpenAI provider not yet implemented (Phase 3)');
  }

  async *generateStream(
    _messages: AgentMessage[],
    _tools?: ToolDefinition[],
    _options?: GenerateOptions,
  ): AsyncIterable<StreamChunk> {
    throw new Error('OpenAI provider not yet implemented (Phase 3)');
  }
}
