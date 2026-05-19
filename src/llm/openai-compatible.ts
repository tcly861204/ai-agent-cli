/**
 * OpenAI 兼容 LLM 提供商
 *
 * 通用实现，适用于所有使用 OpenAI Chat Completions API 格式的 LLM 服务：
 * - OpenAI
 * - DeepSeek
 * - Groq
 * - Together AI
 * - 任何兼容 OpenAI API 的服务
 *
 * 通过构造函数参数 `apiBase` 指定不同的 API 端点。
 * 支持流式（SSE）和非流式生成，以及工具/函数调用。
 */

import type { LLMProvider, GenerateOptions, GenerateResult, StreamChunk } from './provider';
import type { AgentMessage, ContentBlock } from '../types/agent';
import type { ToolDefinition } from '../types/tool';

/** OpenAI 格式的 Chat 消息 */
interface OpenAIMessage {
  role: string;
  content: string | null;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  name?: string;
}

/** OpenAI 格式的 Tool 定义 */
interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/** OpenAI Chat Completions 请求体 */
interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  tools?: OpenAITool[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

/** OpenAI Chat Completions 响应体 */
interface OpenAIResponse {
  id: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

interface OpenAICompatibleConfig {
  /** 提供商名称（用于显示和日志） */
  name: string;
  /** API 基础 URL，例如 https://api.openai.com/v1 */
  apiBase: string;
  /** 模型名称 */
  model: string;
  /** API 密钥 */
  apiKey: string;
  /** 可选的默认参数 */
  maxTokens?: number;
  temperature?: number;
}

/** SSE 流式数据块 */
interface SSEChunk {
  choices?: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: 'function';
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

export class OpenAICompatibleProvider implements LLMProvider {
  readonly name: string;
  readonly model: string;
  private apiBase: string;
  private apiKey: string;
  private defaultMaxTokens: number;
  private defaultTemperature: number;

  constructor(private providerConfig: OpenAICompatibleConfig) {
    this.name = providerConfig.name;
    this.model = providerConfig.model;
    this.apiBase = providerConfig.apiBase.replace(/\/+$/, '');
    this.apiKey = providerConfig.apiKey;
    this.defaultMaxTokens = providerConfig.maxTokens ?? 4096;
    this.defaultTemperature = providerConfig.temperature ?? 0.7;
  }

  async generate(
    messages: AgentMessage[],
    tools?: ToolDefinition[],
    options?: GenerateOptions,
  ): Promise<GenerateResult> {
    const body: OpenAIRequest = {
      model: this.model,
      messages: this.toOpenAIMessages(messages, options?.system),
      max_tokens: options?.maxTokens ?? this.defaultMaxTokens,
      temperature: options?.temperature ?? this.defaultTemperature,
    };

    const openaiTools = tools ? this.toOpenAITools(tools) : undefined;
    if (openaiTools && openaiTools.length > 0) {
      body.tools = openaiTools;
    }

    const response = await fetch(`${this.apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: options?.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`${this.name} API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as OpenAIResponse;
    return this.parseResponse(data);
  }

  async *generateStream(
    messages: AgentMessage[],
    tools?: ToolDefinition[],
    options?: GenerateOptions,
  ): AsyncIterable<StreamChunk> {
    const body: OpenAIRequest = {
      model: this.model,
      messages: this.toOpenAIMessages(messages, options?.system),
      max_tokens: options?.maxTokens ?? this.defaultMaxTokens,
      temperature: options?.temperature ?? this.defaultTemperature,
      stream: true,
    };

    const openaiTools = tools ? this.toOpenAITools(tools) : undefined;
    if (openaiTools && openaiTools.length > 0) {
      body.tools = openaiTools;
    }

    const response = await fetch(`${this.apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: options?.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`${this.name} API error (${response.status}): ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error(`${this.name}: response body is not readable`);
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let currentToolCalls: Map<number, { id?: string; name?: string; args: string }> = new Map();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const payload = trimmed.slice(6);
          if (payload === '[DONE]') {
            yield { type: 'stop', stopReason: 'end_turn' };
            return;
          }

          try {
            const chunk = JSON.parse(payload) as SSEChunk;
            const choice = chunk.choices?.[0];
            if (!choice) continue;

            const delta = choice.delta;

            if (delta.content) {
              yield { type: 'text_delta', text: delta.content };
            }

            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index;
                let existing = currentToolCalls.get(idx);
                if (!existing) {
                  existing = { args: '' };
                  currentToolCalls.set(idx, existing);
                }
                if (tc.id) existing.id = tc.id;
                if (tc.function?.name) existing.name = tc.function.name;
                if (tc.function?.arguments) existing.args += tc.function.arguments;
              }

              for (const tc of delta.tool_calls) {
                if (tc.id) {
                  yield {
                    type: 'tool_use_start',
                    toolName: tc.function?.name ?? '',
                    toolId: tc.id,
                  };
                }
              }
            }

            if (choice.finish_reason) {
              const reason = choice.finish_reason;
              if (reason === 'tool_calls') {
                yield { type: 'stop', stopReason: 'tool_use' };
              } else if (reason === 'length') {
                yield { type: 'stop', stopReason: 'max_tokens' };
              } else {
                yield { type: 'stop', stopReason: 'end_turn' };
              }
              return;
            }
          } catch {
            continue;
          }
        }
      }

      yield { type: 'stop', stopReason: 'end_turn' };
    } finally {
      reader.releaseLock();
    }
  }

  private toOpenAIMessages(messages: AgentMessage[], system?: string): OpenAIMessage[] {
    const result: OpenAIMessage[] = [];

    if (system) {
      result.push({ role: 'system', content: system });
    }

    for (const msg of messages) {
      const openaiMsg = this.toOpenAIMessage(msg);
      if (openaiMsg) {
        result.push(openaiMsg);
      }
    }

    return result;
  }

  private toOpenAIMessage(msg: AgentMessage): OpenAIMessage | null {
    switch (msg.role) {
      case 'system':
        return { role: 'system', content: this.extractText(msg.content) };

      case 'user':
        return { role: 'user', content: this.extractText(msg.content) };

      case 'assistant': {
        if (typeof msg.content === 'string') {
          return { role: 'assistant', content: msg.content || null };
        }
        const contentBlocks = msg.content as ContentBlock[];
        const textParts = contentBlocks
          .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
          .map((b) => b.text);
        const toolCalls = contentBlocks
          .filter((b): b is { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } => b.type === 'tool_use')
          .map((b) => ({
            id: b.id,
            type: 'function' as const,
            function: { name: b.name, arguments: JSON.stringify(b.input) },
          }));

        const result: OpenAIMessage = {
          role: 'assistant',
          content: textParts.length > 0 ? textParts.join('') : null,
        };
        if (toolCalls.length > 0) {
          result.tool_calls = toolCalls;
        }
        return result;
      }

      case 'tool':
        return {
          role: 'tool',
          content: this.extractText(msg.content),
          tool_call_id: msg.tool_call_id ?? '',
          name: msg.name,
        };

      default:
        return null;
    }
  }

  private toOpenAITools(tools: ToolDefinition[]): OpenAITool[] {
    return tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters as Record<string, unknown>,
      },
    }));
  }

  private parseResponse(data: OpenAIResponse): GenerateResult {
    const choice = data.choices?.[0];
    if (!choice) {
      throw new Error(`${this.name}: empty response (no choices)`);
    }

    const msg = choice.message;
    const contentBlocks: ContentBlock[] = [];

    if (msg.content) {
      contentBlocks.push({ type: 'text', text: msg.content });
    }

    if (msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        let parsedInput: Record<string, unknown> = {};
        try {
          parsedInput = JSON.parse(tc.function.arguments);
        } catch {
          parsedInput = { _raw: tc.function.arguments };
        }
        contentBlocks.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.function.name,
          input: parsedInput,
        });
      }
    }

    let stopReason: GenerateResult['stopReason'] = 'end_turn';
    if (choice.finish_reason === 'tool_calls') {
      stopReason = 'tool_use';
    } else if (choice.finish_reason === 'length') {
      stopReason = 'max_tokens';
    }

    return {
      message: {
        role: 'assistant',
        content: contentBlocks.length > 0 ? contentBlocks : '',
      },
      stopReason,
      usage: data.usage
        ? { input: data.usage.prompt_tokens, output: data.usage.completion_tokens }
        : undefined,
    };
  }

  private extractText(content: string | ContentBlock[]): string {
    if (typeof content === 'string') return content;
    return content
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text)
      .join('');
  }
}
