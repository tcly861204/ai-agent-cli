import type { AgentMessage } from '../types/agent';
import type { ToolDefinition } from '../types/tool';

/**
 * 粗略的 token 数量估算比率
 * 基于经验值：1 个 token ≈ 4 个英文字符
 * 注意：这是一个粗略估算，实际 token 数因模型和语言而异
 * 中文等非拉丁语系的估算偏差较大
 */
const TOKEN_ESTIMATE_RATIO = 0.25; // 1 token ≈ 4 个字符

/**
 * 安全余量（以 token 计）
 * 在达到模型的最大上下文窗口之前保留一些空间，
 * 防止因估算误差导致超出限制
 */
const SAFETY_MARGIN = 1000; // 保留 1000 token 的缓冲空间

/**
 * 上下文管理器
 *
 * 负责跟踪和管理对话上下文的 token 使用量。
 * 当对话历史接近模型的上下文窗口上限时，
 * 自动移除最早的非系统消息来保证不会超出限制。
 *
 * 目前使用基于字符数的粗略估算方法，
 * 后续可以接入各模型的精确 tokenizer 提高准确度。
 */
export class ContextManager {
  private maxTokens: number;

  /**
   * @param maxTokens - 模型的最大上下文窗口大小（token 数）
   *                    默认为 128K，对应 Claude 3 系列模型
   */
  constructor(maxTokens: number = 128_000) {
    this.maxTokens = maxTokens;
  }

  /** 更新最大 token 限制 */
  setMaxTokens(n: number): void {
    this.maxTokens = n;
  }

  /**
   * 估算给定字符串的 token 数量
   * 基于字符数乘以估算比率
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length * TOKEN_ESTIMATE_RATIO);
  }

  /**
   * 估算整个消息列表的总 token 数
   * 包含消息内容和工具定义
   *
   * @param messages - 对话消息列表
   * @param tools - 可用的工具定义（工具定义也会占用上下文）
   * @returns 估算的 token 总数
   */
  estimateTotal(messages: AgentMessage[], tools?: ToolDefinition[]): number {
    let total = 0;
    for (const m of messages) {
      if (typeof m.content === 'string') {
        total += this.estimateTokens(m.content);
      } else {
        // 处理结构化内容块（文本 + 工具调用 + 工具结果）
        for (const block of m.content) {
          if (block.type === 'text') total += this.estimateTokens(block.text);
          if (block.type === 'tool_use' || block.type === 'tool_result') {
            total += this.estimateTokens(JSON.stringify(block));
          }
        }
      }
    }
    // 工具定义本身也会占用上下文
    if (tools) {
      for (const t of tools) {
        total += this.estimateTokens(t.name + t.description + JSON.stringify(t.parameters));
      }
    }
    return total;
  }

  /**
   * 修剪消息列表以保持在上下文预算内
   *
   * 策略：当总 token 数超过预算时，从最旧的消息开始移除。
   * 系统消息（system role）永远不会被移除，保留至少 2 条消息。
   *
   * @param messages - 待修剪的消息列表（会直接修改原数组）
   * @param tools - 当前注册的工具定义
   * @returns 修剪后的消息列表
   */
  prune(messages: AgentMessage[], tools?: ToolDefinition[]): AgentMessage[] {
    const budget = this.maxTokens - SAFETY_MARGIN;
    while (messages.length > 2 && this.estimateTotal(messages, tools) > budget) {
      // 找到最早的非系统消息并移除
      const idx = messages.findIndex((m) => m.role !== 'system');
      if (idx === -1) break; // 剩下全是系统消息，不再移除
      messages.splice(idx, 1);
    }
    return messages;
  }
}
