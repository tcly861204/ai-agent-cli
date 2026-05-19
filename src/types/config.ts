/**
 * MCP（Model Context Protocol）服务器配置
 * 用于配置和管理外部工具服务的连接
 */
export interface McpServerConfig {
  /** MCP 服务器唯一标识 ID */
  id: string;
  /** 启动 MCP 服务器的命令 */
  command: string;
  /** 命令参数列表 */
  args: string[];
  /** 可选的环境变量配置 */
  env?: Record<string, string>;
}

/**
 * 应用主配置接口
 * 定义整个 CLI 工具的所有可配置项
 */
export interface Config {
  /** LLM 提供商名称：deepseek、anthropic、openai */
  provider: string;
  /** 使用的模型名称 */
  model: string;
  /** 自定义 API 基础 URL（仅 OpenAI 兼容协议），覆盖默认端点 */
  apiBase?: string;
  /** 各服务商的 API 密钥 */
  apiKeys: {
    /** Anthropic Claude API 密钥 */
    anthropic?: string;
    /** OpenAI API 密钥 */
    openai?: string;
    /** DeepSeek API 密钥 */
    deepseek?: string;
    /** Tavily 搜索 API 密钥 */
    tavily?: string;
  };
  /** 系统提示词 */
  systemPrompt: string;
  /** 单次生成最大 token 数 */
  maxTokens: number;
  /** 生成温度（0~2） */
  temperature: number;
  /** 工具执行相关限制 */
  toolLimits: {
    /** 工具输出的最大字符长度 */
    maxOutputLength: number;
    /** Bash 命令执行超时时间（毫秒） */
    bashTimeoutMs: number;
  };
  /** MCP 服务器配置列表 */
  mcpServers: McpServerConfig[];
  /** 用户界面配置 */
  ui: {
    /** 是否显示 token 用量统计 */
    showTokenUsage: boolean;
    /** 是否显示工具执行输出 */
    showToolOutput: boolean;
    /** 是否启用 ANSI 彩色输出 */
    colors: boolean;
  };
}
