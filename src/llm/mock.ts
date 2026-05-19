import type { LLMProvider, GenerateOptions, GenerateResult, StreamChunk } from './provider';
import type { AgentMessage } from '../types/agent';
import type { ToolDefinition } from '../types/tool';

/**
 * Mock provider that echoes back user input.
 * Used in Phase 1 for testing the REPL and agent loop without real API keys.
 */
export class MockProvider implements LLMProvider {
  readonly name = 'mock';
  readonly model = 'mock-model';

  async generate(
    messages: AgentMessage[],
    _tools?: ToolDefinition[],
    _options?: GenerateOptions,
  ): Promise<GenerateResult> {
    const lastMsg = messages[messages.length - 1];
    const userText =
      typeof lastMsg?.content === 'string'
        ? lastMsg.content
        : '[non-text content]';

    return {
      message: {
        role: 'assistant',
        content: `[Mock] You said: "${userText}"\n\nThis is a mock response. Configure a real LLM provider (anthropic or openai) to get actual AI responses.`,
      },
      stopReason: 'end_turn',
      usage: { input: 0, output: 0 },
    };
  }

  async *generateStream(
    messages: AgentMessage[],
    _tools?: ToolDefinition[],
    _options?: GenerateOptions,
  ): AsyncIterable<StreamChunk> {
    const lastMsg = messages[messages.length - 1];
    const userText =
      typeof lastMsg?.content === 'string'
        ? lastMsg.content
        : '[non-text content]';

    const response = `[Mock] You said: "${userText}"\n\nThis is a mock response. Configure a real LLM provider to get actual AI responses.`;

    for (let i = 0; i < response.length; i += 10) {
      yield { type: 'text_delta', text: response.slice(i, i + 10) };
    }
    yield { type: 'stop', stopReason: 'end_turn' };
  }
}
