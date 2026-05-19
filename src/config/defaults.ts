import type { Config } from '../types';

/**
 * 默认配置对象
 * 当用户未提供配置文件或环境变量时，使用此默认配置
 * 各字段的含义详见 types/config.ts 中的 Config 接口
 */
export const defaultConfig: Config = {
  // ---- LLM 基础配置 ----
  provider: 'anthropic',                         // 默认使用 Anthropic Claude
  model: 'claude-sonnet-4-20250514',             // 默认模型
  apiKeys: {},                                    // API 密钥默认为空，需通过配置文件或环境变量提供
  systemPrompt:
    'You are a helpful AI assistant with access to tools. ' +
    'Use them to accomplish tasks efficiently.',
  maxTokens: 4096,                                // 单次生成的 token 上限
  temperature: 0.7,                               // 默认温度，平衡创造性和确定性

  // ---- 工具执行限制 ----
  toolLimits: {
    maxOutputLength: 32_768,                      // 工具输出最长 32KB
    bashTimeoutMs: 30_000,                        // Bash 命令超时 30 秒
  },

  // ---- MCP 服务器 ----
  mcpServers: [],                                 // 默认不启用任何 MCP 服务器

  // ---- UI 显示配置 ----
  ui: {
    showTokenUsage: false,                        // 默认不显示 token 用量
    showToolOutput: true,                         // 默认展示工具执行输出
    colors: true,                                 // 默认启用颜色输出
  },
};
