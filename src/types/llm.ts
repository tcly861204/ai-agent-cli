import type { AgentMessage, ContentBlock } from './agent';

/**
 * LLM 提供商接口
 * 所有 LLM 提供商（Anthropic、OpenAI、Mock）必须实现此接口
 * 提供流式和非流式两种生成方式
 */
export interface LLMProvider {
  /** 提供商名称 */
  readonly name: string;
  /** 当前使用的模型名称 */
  readonly model: string;

  /**
   * 非流式生成：一次性返回完整的生成结果
   * @param messages - 对话消息历史
   * @param tools - 可用的工具定义列表
   * @param options - 生成参数选项
   */
  generate(
    messages: AgentMessage[],
    tools?: ToolDefinition[],
    options?: GenerateOptions,
  ): Promise<GenerateResult>;

  /**
   * 流式生成：通过 AsyncIterable 逐块返回生成内容
   * 适用于实时显示 LLM 输出
   * @param messages - 对话消息历史
   * @param tools - 可用的工具定义列表
   * @param options - 生成参数选项
   */
  generateStream(
    messages: AgentMessage[],
    tools?: ToolDefinition[],
    options?: GenerateOptions,
  ): AsyncIterable<StreamChunk>;
}

/**
 * LLM 生成选项
 * 控制生成行为的可选参数
 */
export interface GenerateOptions {
  /** 最大输出 token 数 */
  maxTokens?: number;
  /** 生成温度（0~2） */
  temperature?: number;
  /** 系统提示词（可覆盖 Config 中的默认提示词） */
  system?: string;
  /** 取消信号，用于中断正在进行的生成 */
  signal?: AbortSignal;
}

/**
 * 非流式生成结果
 */
export interface GenerateResult {
  /** LLM 返回的消息 */
  message: AgentMessage;
  /** token 用量统计 */
  usage?: TokenUsage;
  /** 停止原因：正常结束、请求工具调用、达到最大 token 数、发生错误 */
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'error';
}

/**
 * 流式生成的块类型
 * 每次 yield 一个块，包含文本增量或工具调用信息
 */
export interface StreamChunk {
  /** 块类型 */
  type: 'text_delta' | 'tool_use_start' | 'tool_use_delta' | 'stop';
  /** 文本增量内容（text_delta 类型时存在） */
  text?: string;
  /** 工具名称（tool_use_* 类型时存在） */
  toolName?: string;
  /** 工具调用 ID（tool_use_* 类型时存在） */
  toolId?: string;
  /** 工具参数 JSON 片段（tool_use_delta 类型时存在） */
  toolArgs?: string;
  /** 停止原因（stop 类型时存在） */
  stopReason?: string;
}

/**
 * Token 用量统计
 */
export interface TokenUsage {
  /** 输入的 token 数 */
  input: number;
  /** 输出的 token 数 */
  output: number;
  /** 缓存命中的输入 token 数（仅 Anthropic 支持） */
  cacheRead?: number;
  /** 缓存写入的 token 数（仅 Anthropic 支持） */
  cacheWrite?: number;
}

import type { ToolDefinition } from './tool';
