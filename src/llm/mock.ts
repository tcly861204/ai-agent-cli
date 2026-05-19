/**
 * Mock LLM 提供商（模拟提供者）
 *
 * 用于 Phase 1 开发阶段，在不需要真实 API 密钥的情况下测试 REPL
 * 和代理运行循环。简单地复读用户输入，并在输出中附加提示信息，
 * 引导用户配置真实的 LLM 提供商。
 */

import type { LLMProvider, GenerateOptions, GenerateResult, StreamChunk } from './provider';
import type { AgentMessage } from '../types/agent';
import type { ToolDefinition } from '../types/tool';

export class MockProvider implements LLMProvider {
  readonly name = 'mock';
  readonly model = 'mock-model';

  /**
   * 非流式生成：复读用户最后一条消息
   */
  async generate(
    messages: AgentMessage[],
    _tools?: ToolDefinition[],
    _options?: GenerateOptions,
  ): Promise<GenerateResult> {
    // 获取用户最后一条消息的内容
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
      // 模拟模式不消耗实际 token
      usage: { input: 0, output: 0 },
    };
  }

  /**
   * 流式生成：每 10 个字符作为一个块模拟流式输出
   */
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

    // 按 10 字符分段模拟流式效果
    for (let i = 0; i < response.length; i += 10) {
      yield { type: 'text_delta', text: response.slice(i, i + 10) };
    }
    yield { type: 'stop', stopReason: 'end_turn' };
  }
}
