/**
 * 消息角色类型，表示消息发送方的身份
 * - user: 用户消息
 * - assistant: AI 助手消息
 * - system: 系统提示消息
 * - tool: 工具调用返回结果
 */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

/**
 * 消息内容块，支持多种内容类型
 * - text: 纯文本内容
 * - tool_use: LLM 请求调用某个工具
 * - tool_result: 工具执行返回的结果
 */
export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

/**
 * 代理消息接口，表示对话中的一条消息
 * 支持文本字符串或结构化内容块数组两种格式
 */
export interface AgentMessage {
  /** 消息角色：用户/助手/系统/工具 */
  role: MessageRole;
  /** 消息内容，可以是纯文本或结构化内容块数组 */
  content: string | ContentBlock[];
  /** 仅工具消息：工具名称 */
  name?: string;
  /** 仅工具消息：对应的工具调用 ID */
  tool_call_id?: string;
}

/**
 * 代理事件类型，用于在运行时向外部（如 REPL）推送各种事件
 * - text: 最终文本输出（流式结束后）
 * - text_delta: 流式输出的文本片段
 * - tool_start: 工具开始执行
 * - tool_end: 工具执行完毕
 * - error: 运行时错误
 * - done: 本轮处理完成
 */
export type AgentEvent =
  | { type: 'text'; content: string }
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_start'; name: string; id: string }
  | { type: 'tool_end'; id: string; name: string; result: ToolResult }
  | { type: 'error'; message: string }
  | { type: 'done' };

import type { ToolResult } from './tool';

/**
 * 代理运行时配置接口
 * 控制 LLM 的基本行为参数
 */
export interface AgentConfig {
  /** LLM 提供商名称（如 anthropic, openai, mock） */
  provider: string;
  /** 模型名称（如 claude-sonnet-4-20250514） */
  model: string;
  /** 系统提示词，定义 AI 助手的角色和行为 */
  systemPrompt: string;
  /** 每次生成的最大 token 数 */
  maxTokens: number;
  /** 生成温度，控制输出的随机性（0~2） */
  temperature: number;
  /** 工具输出结果的最大长度 */
  maxToolOutputLength: number;
}
