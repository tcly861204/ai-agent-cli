/**
 * Agent 运行时核心模块
 *
 * AgentRuntime 是整个 AI Agent CLI 的核心推理循环。
 * 它管理对话消息历史，协调 LLM 调用，处理工具执行回合，
 * 并通过 AgentEvent 流式输出所有中间状态供前端渲染。
 *
 * 工作流程：
 * 1. 接收用户输入 → 追加到消息历史
 * 2. 调用 LLM 生成响应
 * 3. 如果 LLM 请求调用工具 → 执行工具 → 将结果送回 LLM
 * 4. 重复 2-3 直到 LLM 给出最终回复（最多 10 轮）
 */

import type { LLMProvider, GenerateOptions } from '../llm/provider';
import type { ToolRegistry } from '../tool/registry';
import type { AgentMessage, AgentEvent } from '../types/agent';
import type { ToolDefinition, ToolContext } from '../types/tool';
import type { Config } from '../types/config';
import { ContextManager } from './context';

/** AgentRuntime 构造选项 */
export interface AgentRuntimeOptions {
  provider: LLMProvider;   // LLM 提供商实例
  tools: ToolRegistry;     // 工具注册表
  config: Config;          // 应用配置
}

export class AgentRuntime {
  /** 对话消息历史 */
  private messages: AgentMessage[] = [];
  private provider: LLMProvider;
  private tools: ToolRegistry;
  private config: Config;
  /** 上下文管理器，用于控制 token 使用量 */
  private contextManager: ContextManager;

  constructor(opts: AgentRuntimeOptions) {
    this.provider = opts.provider;
    this.tools = opts.tools;
    this.config = opts.config;
    this.contextManager = new ContextManager();
  }

  /**
   * 重置对话上下文
   * 清空所有消息历史，开始新的对话
   */
  reset(): void {
    this.messages = [];
  }

  /** 获取当前消息数量 */
  getMessageCount(): number {
    return this.messages.length;
  }

  /**
   * 运行代理推理循环的主入口
   *
   * 优先尝试流式模式，如果提供商不支持流式则回退到非流式。
   * 通过 AsyncGenerator 逐事件返回，支持 yield 实时状态。
   *
   * @param userInput - 用户输入文本
   * @param signal - 可选的取消信号
   */
  async *run(userInput: string, signal?: AbortSignal): AsyncIterable<AgentEvent> {
    // 将用户输入追加到消息历史
    this.messages.push({ role: 'user', content: userInput });

    // 优先尝试流式模式，如果出错则回退到非流式
    try {
      yield* this.runStreaming(signal);
    } catch {
      yield* this.runNonStreaming(signal);
    }
  }

  /**
   * 流式推理循环
   *
   * 通过 LLM 提供商的 generateStream 方法逐块获取响应。
   * 处理文本增量、工具调用等不同类型的流式数据块。
   * 注意：流式模式下的工具调用会回退到非流式处理。
   */
  private async *runStreaming(signal?: AbortSignal): AsyncIterable<AgentEvent> {
    const toolDefs = this.tools.getToolDefinitionsForProvider();

    let accumulatedText = '';  // 累积流式文本

    for await (const chunk of this.provider.generateStream(
      this.messages,
      toolDefs,
      this.buildOptions(signal),
    )) {
      switch (chunk.type) {
        case 'text_delta':
          // 流式文本片段，逐块累加并转发给渲染器
          accumulatedText += chunk.text ?? '';
          yield { type: 'text_delta', delta: chunk.text ?? '' };
          break;

        case 'tool_use_start':
          // 工具开始调用的信号
          yield { type: 'tool_start', name: chunk.toolName ?? 'unknown', id: chunk.toolId ?? '' };
          break;

        case 'tool_use_delta':
          // 工具参数的流式增量——当前不需要执行，直接透传即可
          break;

        case 'stop': {
          if (chunk.stopReason === 'tool_use') {
            // 流式模式下的工具调用处理较复杂，回退到非流式路径
            yield* this.handleToolUse(accumulatedText, signal);
          } else {
            // 正常结束：将累积的响应保存到消息历史
            this.messages.push({ role: 'assistant', content: accumulatedText });
            yield { type: 'text', content: accumulatedText };
          }
          yield { type: 'done' };
          return;
        }
      }
    }
  }

  /**
   * 非流式推理循环
   *
   * 执行多轮推理-工具调用循环：
   * 1. 调用 LLM（非流式）
   * 2. 如果 LLM 返回工具调用 → 执行工具 → 回到步骤 1
   * 3. 如果 LLM 返回文本回复 → 输出给用户
   *
   * 最多执行 10 轮工具调用，防止无限循环。
   */
  private async *runNonStreaming(signal?: AbortSignal): AsyncIterable<AgentEvent> {
    const toolDefs = this.tools.getToolDefinitionsForProvider();

    // 工具调用轮次上限为 10 轮
    for (let round = 0; round < 10; round++) {
      // 在每次调用前检查并修剪上下文
      this.contextManager.prune(this.messages, toolDefs);

      // 调用 LLM 获取响应
      const result = await this.provider.generate(
        this.messages,
        toolDefs,
        this.buildOptions(signal),
      );

      // 将助理消息保存到历史
      if (result.message.content) {
        this.messages.push(result.message);
      }

      // 判断是否需要执行工具调用
      if (result.stopReason === 'tool_use') {
        // 提取消息中的工具调用块
        const toolBlocks = this.extractToolBlocks(result.message.content);
        for (const block of toolBlocks) {
          // 通知外部：工具开始执行
          yield { type: 'tool_start', name: block.name, id: block.id };

          // 执行工具
          const toolResult = await this.tools.execute(
            block.name,
            block.input,
            this.buildToolContext(signal),
          );

          // 通知外部：工具执行完毕
          yield { type: 'tool_end', id: block.id, name: block.name, result: toolResult };

          // 将工具执行结果作为消息追加到历史，供 LLM 下一轮使用
          this.messages.push({
            role: 'tool',
            tool_call_id: block.id,
            name: block.name,
            content: toolResult.output,
          });
        }
        // 继续下一轮 LLM 调用
      } else {
        // LLM 返回了最终文本回复，输出给用户
        const text = this.extractText(result.message.content);
        yield { type: 'text', content: text };
        yield { type: 'done' };
        return;
      }
    }

    // 超限：达到了最大工具调用轮次
    yield { type: 'error', message: 'Agent reached maximum iteration limit (10)' };
    yield { type: 'done' };
  }

  /**
   * 流式模式下的工具调用兜底处理
   * 直接回退到非流式路径
   */
  private async *handleToolUse(
    _accumulatedText: string,
    signal?: AbortSignal,
  ): AsyncIterable<AgentEvent> {
    yield* this.runNonStreaming(signal);
  }

  /** 构建 LLM 调用选项 */
  private buildOptions(signal?: AbortSignal): GenerateOptions {
    return {
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
      system: this.config.systemPrompt,
      signal,
    };
  }

  /** 构建工具执行上下文 */
  private buildToolContext(signal?: AbortSignal): ToolContext {
    return {
      workingDirectory: process.cwd(),
      signal,
    };
  }

  /**
   * 从消息内容中提取所有工具调用块
   * 仅支持结构化内容块数组格式
   */
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

  /**
   * 从消息内容中提取纯文本部分
   * 支持字符串和结构化内容块数组两种格式
   */
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
