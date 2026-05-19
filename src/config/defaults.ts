import type { Config } from '../types';

export const defaultConfig: Config = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  apiKeys: {},
  systemPrompt:
    'You are a helpful AI assistant with access to tools. ' +
    'Use them to accomplish tasks efficiently.',
  maxTokens: 4096,
  temperature: 0.7,
  toolLimits: {
    maxOutputLength: 32_768,
    bashTimeoutMs: 30_000,
  },
  mcpServers: [],
  ui: {
    showTokenUsage: false,
    showToolOutput: true,
    colors: true,
  },
};
