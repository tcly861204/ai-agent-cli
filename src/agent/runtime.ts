import type { LLMProvider, GenerateOptions } from '../llm/provider';
import type { ToolRegistry } from '../tool/registry';
import type { AgentMessage, AgentEvent } from '../types/agent';
import type { ToolDefinition, ToolContext } from '../types/tool';
import type { Config } from '../types/config';
import { ContextManager } from './context';

export interface AgentRuntimeOptions {
  provider: LLMProvider;
  tools: ToolRegistry;
  config: Config;
}

export class AgentRuntime {
  private messages: AgentMessage[] = [];
  private provider: LLMProvider;
  private tools: ToolRegistry;
  private config: Config;
  private contextManager: ContextManager;

  constructor(opts: AgentRuntimeOptions) {
    this.provider = opts.provider;
    this.tools = opts.tools;
    this.config = opts.config;
    this.contextManager = new ContextManager();
  }

  reset(): void {
    this.messages = [];
  }

  getMessageCount(): number {
    return this.messages.length;
  }

  async *run(userInput: string, signal?: AbortSignal): AsyncIterable<AgentEvent> {
    this.messages.push({ role: 'user', content: userInput });

    // Use streaming if available, otherwise fallback to non-streaming
    try {
      yield* this.runStreaming(signal);
    } catch {
      yield* this.runNonStreaming(signal);
    }
  }

  private async *runStreaming(signal?: AbortSignal): AsyncIterable<AgentEvent> {
    const toolDefs = this.tools.getToolDefinitionsForProvider();

    let accumulatedText = '';

    for await (const chunk of this.provider.generateStream(
      this.messages,
      toolDefs,
      this.buildOptions(signal),
    )) {
      switch (chunk.type) {
        case 'text_delta':
          accumulatedText += chunk.text ?? '';
          yield { type: 'text_delta', delta: chunk.text ?? '' };
          break;
        case 'tool_use_start':
          yield { type: 'tool_start', name: chunk.toolName ?? 'unknown', id: chunk.toolId ?? '' };
          break;
        case 'tool_use_delta':
          // Tool args streaming delta — not needed for execution, just pass through
          break;
        case 'stop': {
          if (chunk.stopReason === 'tool_use') {
            // Non-streaming fallback for tool use (streaming tool handling is complex)
            // For now, fall through to non-streaming path
            yield* this.handleToolUse(accumulatedText, signal);
          } else {
            this.messages.push({ role: 'assistant', content: accumulatedText });
            yield { type: 'text', content: accumulatedText };
          }
          yield { type: 'done' };
          return;
        }
      }
    }
  }

  private async *runNonStreaming(signal?: AbortSignal): AsyncIterable<AgentEvent> {
    const toolDefs = this.tools.getToolDefinitionsForProvider();

    for (let round = 0; round < 10; round++) {
      this.contextManager.prune(this.messages, toolDefs);

      const result = await this.provider.generate(
        this.messages,
        toolDefs,
        this.buildOptions(signal),
      );

      if (result.message.content) {
        this.messages.push(result.message);
      }

      if (result.stopReason === 'tool_use') {
        const toolBlocks = this.extractToolBlocks(result.message.content);
        for (const block of toolBlocks) {
          yield { type: 'tool_start', name: block.name, id: block.id };
          const toolResult = await this.tools.execute(
            block.name,
            block.input,
            this.buildToolContext(signal),
          );
          yield { type: 'tool_end', id: block.id, name: block.name, result: toolResult };

          this.messages.push({
            role: 'tool',
            tool_call_id: block.id,
            name: block.name,
            content: toolResult.output,
          });
        }
      } else {
        const text = this.extractText(result.message.content);
        yield { type: 'text', content: text };
        yield { type: 'done' };
        return;
      }
    }

    yield { type: 'error', message: 'Agent reached maximum iteration limit (10)' };
    yield { type: 'done' };
  }

  private async *handleToolUse(
    _accumulatedText: string,
    signal?: AbortSignal,
  ): AsyncIterable<AgentEvent> {
    // For streaming with tool use, fallback to non-streaming
    yield* this.runNonStreaming(signal);
  }

  private buildOptions(signal?: AbortSignal): GenerateOptions {
    return {
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
      system: this.config.systemPrompt,
      signal,
    };
  }

  private buildToolContext(signal?: AbortSignal): ToolContext {
    return {
      workingDirectory: process.cwd(),
      signal,
    };
  }

  private extractToolBlocks(
    content: string | import('../types/agent').ContentBlock[],
  ): Array<{ id: string; name: string; input: Record<string, unknown> }> {
    if (typeof content === 'string') return [];
    return content.filter((b) => b.type === 'tool_use') as Array<{
      type: 'tool_use';
      id: string;
      name: string;
      input: Record<string, unknown>;
    }>;
  }

  private extractText(
    content: string | import('../types/agent').ContentBlock[],
  ): string {
    if (typeof content === 'string') return content;
    return content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');
  }
}
