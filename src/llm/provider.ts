/**
 * LLM 提供商接口与类型定义
 *
 * 本文件定义了 LLM 提供商（如 DeepSeek、Anthropic、OpenAI）需要实现的接口，
 * 以及生成请求/响应相关的类型。所有 LLM 交互都通过这些类型进行标准化。
 */

import type { AgentMessage } from '../types/agent';
import type { ToolDefinition } from '../types/tool';

/**
 * LLM 生成选项
 * 控制生成行为的可选参数
 */
export interface GenerateOptions {
  /** 最大输出 token 数 */
  maxTokens?: number;
  /** 生成温度，控制随机性（0=确定，2=随机） */
  temperature?: number;
  /** 系统提示词，可覆盖配置中的默认值 */
  system?: string;
  /** AbortSignal，用于中断正在进行的生成请求 */
  signal?: AbortSignal;
}

/**
 * 非流式生成的结果
 */
export interface GenerateResult {
  /** LLM 生成的消息 */
  message: AgentMessage;
  /** token 使用统计 */
  usage?: { input: number; output: number; cacheRead?: number; cacheWrite?: number };
  /** 停止原因 */
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'error';
}

/**
 * 流式生成的单个数据块
 * LLM 逐块返回生成内容，适用于实时展示
 */
export interface StreamChunk {
  /** 数据块类型 */
  type: 'text_delta' | 'tool_use_start' | 'tool_use_delta' | 'stop';
  /** 文本增量内容 */
  text?: string;
  /** 正在调用的工具名称 */
  toolName?: string;
  /** 工具调用 ID */
  toolId?: string;
  /** 工具参数 JSON 字符串（流式分段传输时使用） */
  toolArgs?: string;
  /** 停止原因 */
  stopReason?: string;
}

/**
 * LLM 提供商接口
 *
 * 所有 LLM 提供商必须实现此接口。
 * 提供两种生成方式：
 * - generate：非流式，一次性获取完整结果
 * - generateStream：流式，逐块获取生成内容
 */
export interface LLMProvider {
  /** 提供商名称，如 "deepseek"、"anthropic"、"openai" */
  readonly name: string;
  /** 当前使用的模型名称 */
  readonly model: string;

  /**
   * 非流式生成文本
   * @param messages - 对话消息列表
   * @param tools - 可用的工具定义
   * @param options - 生成选项
   */
  generate(
    messages: AgentMessage[],
    tools?: ToolDefinition[],
    options?: GenerateOptions,
  ): Promise<GenerateResult>;

  /**
   * 流式生成文本
   * @param messages - 对话消息列表
   * @param tools - 可用的工具定义
   * @param options - 生成选项
   */
  generateStream(
    messages: AgentMessage[],
    tools?: ToolDefinition[],
    options?: GenerateOptions,
  ): AsyncIterable<StreamChunk>;
}
