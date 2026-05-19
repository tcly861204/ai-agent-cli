/**
 * 工具定义接口
 * 工具是 LLM 可以用来与环境交互的函数，例如执行命令、搜索网络等
 */
export interface ToolDefinition {
  /** 工具名称，LLM 通过此名称引用工具 */
  name: string;
  /** 工具描述，帮助 LLM 理解何时使用该工具 */
  description: string;
  /** 工具参数的 JSON Schema 定义 */
  parameters: Record<string, unknown>;
  /**
   * 执行工具函数
   * @param args - 由 LLM 生成的参数对象
   * @param ctx - 执行上下文（工作目录、中止信号等）
   * @returns 工具执行结果
   */
  execute: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;
}

/**
 * 工具执行结果
 */
export interface ToolResult {
  /** 执行是否成功 */
  success: boolean;
  /** 输出内容文本 */
  output: string;
  /** 错误信息（失败时存在） */
  error?: string;
  /** 附加元数据 */
  metadata?: {
    /** 执行耗时（毫秒） */
    durationMs?: number;
    /** 输出是否被截断 */
    truncated?: boolean;
    /** MCP 服务器 ID（如果由 MCP 工具执行） */
    mcpServerId?: string;
  };
}

/**
 * 工具执行上下文
 * 提供工具执行时需要的环境信息
 */
export interface ToolContext {
  /** 当前工作目录路径 */
  workingDirectory: string;
  /** 可选的取消信号 */
  signal?: AbortSignal;
}
