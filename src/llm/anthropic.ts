/**
 * Anthropic Claude LLM 提供商（存根实现）
 *
 * 当前为 Phase 1 占位阶段，所有方法均抛出"尚未实现"的错误。
 * 计划在 Phase 2 实现完整的 Anthropic API 集成，包括：
 * - 消息 API（非流式）
 * - 流式消息 API
 * - 工具调用支持
 * - 提示缓存（Prompt Caching）
 */

import type { LLMProvider, GenerateOptions, GenerateResult, StreamChunk } from './provider';
import type { AgentMessage } from '../types/agent';
import type { ToolDefinition } from '../types/tool';
import type { Config } from '../types/config';

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  readonly model: string;

  constructor(private config: Config) {
    this.model = config.model;
  }

  /**
   * 非流式生成（Phase 2 待实现）
   * 预计使用 Anthropic Messages API 发送消息并获取完整响应
   */
  async generate(
    _messages: AgentMessage[],
    _tools?: ToolDefinition[],
    _options?: GenerateOptions,
  ): Promise<GenerateResult> {
    throw new Error('Anthropic provider not yet implemented (Phase 2)');
  }

  /**
   * 流式生成（Phase 2 待实现）
   * 预计使用 Anthropic Messages API 的 stream 模式逐块返回
   */
  async *generateStream(
    _messages: AgentMessage[],
    _tools?: ToolDefinition[],
    _options?: GenerateOptions,
  ): AsyncIterable<StreamChunk> {
    throw new Error('Anthropic provider not yet implemented (Phase 2)');
  }
}
