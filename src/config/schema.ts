import { z } from 'zod';

/**
 * Zod 配置校验 Schema
 * 使用 zod 库定义配置文件的完整校验规则，确保用户提供的配置合法
 *
 * 校验层级：默认值 → 配置文件 → 环境变量覆盖
 * 每个字段都设置了默认值，确保即使配置不完整也能正常运行
 */
export const ConfigSchema = z.object({
  // LLM 提供商名称（mock / anthropic / openai）
  provider: z.string().default('anthropic'),

  // 模型名称（如 claude-sonnet-4-20250514、gpt-4o）
  model: z.string().default('claude-sonnet-4-20250514'),

  // API 密钥集合，各字段均为可选
  apiKeys: z
    .object({
      anthropic: z.string().optional(),    // Anthropic API 密钥
      openai: z.string().optional(),       // OpenAI API 密钥
      tavily: z.string().optional(),       // Tavily 搜索 API 密钥
    })
    .optional()
    .default({} as Record<string, string | undefined>),

  // 系统提示词
  systemPrompt: z
    .string()
    .default(
      'You are a helpful AI assistant with access to tools. Use them to accomplish tasks efficiently.',
    ),

  // 每次生成的最大 token 数（必须为正整数）
  maxTokens: z.number().positive().default(4096),

  // 生成温度（0~2，默认 0.7）
  temperature: z.number().min(0).max(2).default(0.7),

  // 工具执行限制配置
  toolLimits: z
    .object({
      maxOutputLength: z.number().positive().default(32_768),  // 工具输出最大长度
      bashTimeoutMs: z.number().positive().default(30_000),     // Bash 超时时间（ms）
    })
    .optional()
    .default({
      maxOutputLength: 32_768,
      bashTimeoutMs: 30_000,
    }),

  // MCP 服务器配置数组
  mcpServers: z
    .array(
      z.object({
        id: z.string(),                                      // 服务器唯一 ID
        command: z.string(),                                 // 启动命令
        args: z.array(z.string()),                           // 命令参数
        env: z.record(z.string(), z.string()).optional(),    // 环境变量
      }),
    )
    .default([]),

  // UI 显示配置
  ui: z
    .object({
      showTokenUsage: z.boolean().default(false),   // 是否显示 token 用量
      showToolOutput: z.boolean().default(true),     // 是否显示工具输出
      colors: z.boolean().default(true),             // 是否启用颜色
    })
    .optional()
    .default({
      showTokenUsage: false,
      showToolOutput: true,
      colors: true,
    }),
});

/** 由 ConfigSchema 推导出的类型，确保类型与 Schema 同步 */
export type ValidatedConfig = z.infer<typeof ConfigSchema>;
