/**
 * OpenAI LLM 提供商（存根实现）
 *
 * 当前为 Phase 1 占位阶段，所有方法均抛出"尚未实现"的错误。
 * 计划在 Phase 3 实现完整的 OpenAI API 集成，包括：
 * - Chat Completions API（非流式）
 * - 流式 Chat Completions API
 * - 工具/函数调用支持
 */

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

  /**
   * 非流式生成（Phase 3 待实现）
   * 预计使用 OpenAI Chat Completions API
   */
  async generate(
    _messages: AgentMessage[],
    _tools?: ToolDefinition[],
    _options?: GenerateOptions,
  ): Promise<GenerateResult> {
    throw new Error('OpenAI provider not yet implemented (Phase 3)');
  }

  /**
   * 流式生成（Phase 3 待实现）
   * 预计使用 OpenAI Chat Completions API 的 stream 模式
   */
  async *generateStream(
    _messages: AgentMessage[],
    _tools?: ToolDefinition[],
    _options?: GenerateOptions,
  ): AsyncIterable<StreamChunk> {
    throw new Error('OpenAI provider not yet implemented (Phase 3)');
  }
}
