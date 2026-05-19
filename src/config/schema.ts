import { z } from 'zod';

export const ConfigSchema = z.object({
  provider: z.string().default('anthropic'),
  model: z.string().default('claude-sonnet-4-20250514'),
  apiKeys: z
    .object({
      anthropic: z.string().optional(),
      openai: z.string().optional(),
      tavily: z.string().optional(),
    })
    .optional()
    .default({} as Record<string, string | undefined>),
  systemPrompt: z
    .string()
    .default(
      'You are a helpful AI assistant with access to tools. Use them to accomplish tasks efficiently.',
    ),
  maxTokens: z.number().positive().default(4096),
  temperature: z.number().min(0).max(2).default(0.7),
  toolLimits: z
    .object({
      maxOutputLength: z.number().positive().default(32_768),
      bashTimeoutMs: z.number().positive().default(30_000),
    })
    .optional()
    .default({
      maxOutputLength: 32_768,
      bashTimeoutMs: 30_000,
    }),
  mcpServers: z
    .array(
      z.object({
        id: z.string(),
        command: z.string(),
        args: z.array(z.string()),
        env: z.record(z.string(), z.string()).optional(),
      }),
    )
    .default([]),
  ui: z
    .object({
      showTokenUsage: z.boolean().default(false),
      showToolOutput: z.boolean().default(true),
      colors: z.boolean().default(true),
    })
    .optional()
    .default({
      showTokenUsage: false,
      showToolOutput: true,
      colors: true,
    }),
});

export type ValidatedConfig = z.infer<typeof ConfigSchema>;
