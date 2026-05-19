/**
 * 工具注册表
 *
 * 集中管理所有可用的工具定义。工具注册表负责：
 * - 注册新的工具
 * - 按名称查找工具
 * - 执行工具并记录执行耗时
 * - 导出工具定义列表供 LLM 提供商使用
 *
 * 工具执行流程：
 * 1. 按名称查找工具定义
 * 2. 记录开始时间
 * 3. 执行工具的 execute 方法
 * 4. 记录结束时间并附加到结果元数据
 * 5. 捕获并包装执行异常
 */

import type { ToolDefinition, ToolResult, ToolContext } from '../types/tool';

export class ToolRegistry {
  /** 内部存储：工具名称 → 工具定义 */
  private tools = new Map<string, ToolDefinition>();

  /**
   * 注册一个工具
   * @throws 如果同名工具已注册则抛出错误
   */
  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * 根据名称获取工具定义
   * @param name - 工具名称
   */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /** 获取所有已注册的工具 */
  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * 移除已注册的工具
   * @param name - 要移除的工具名称
   * @returns 是否存在并被移除
   */
  remove(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * 执行指定工具
   *
   * 自动处理：
   * - 工具不存在时返回错误结果
   * - 执行耗时统计（附加到 metadata.durationMs）
   * - 执行异常捕获并包装为错误结果
   *
   * @param name - 工具名称
   * @param args - 工具参数
   * @param ctx - 执行上下文
   * @returns 工具执行结果
   */
  async execute(
    name: string,
    args: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        success: false,
        output: '',
        error: `Unknown tool: ${name}`,
      };
    }

    const start = performance.now();
    try {
      const result = await tool.execute(args, ctx);
      // 附加上执行耗时
      result.metadata = {
        ...result.metadata,
        durationMs: Math.round(performance.now() - start),
      };
      return result;
    } catch (err) {
      // 捕获执行中的异常并包装为标准错误结果
      return {
        success: false,
        output: '',
        error: err instanceof Error ? err.message : String(err),
        metadata: { durationMs: Math.round(performance.now() - start) },
      };
    }
  }

  /**
   * 获取供 LLM 提供商使用的工具定义列表
   * 格式与 ToolDefinition 一致，直接透传所有注册的工具
   */
  getToolDefinitionsForProvider(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }
}
