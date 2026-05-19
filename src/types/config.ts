export interface McpServerConfig {
  id: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface Config {
  provider: string;
  model: string;
  apiKeys: {
    anthropic?: string;
    openai?: string;
    tavily?: string;
  };
  systemPrompt: string;
  maxTokens: number;
  temperature: number;
  toolLimits: {
    maxOutputLength: number;
    bashTimeoutMs: number;
  };
  mcpServers: McpServerConfig[];
  ui: {
    showTokenUsage: boolean;
    showToolOutput: boolean;
    colors: boolean;
  };
}
