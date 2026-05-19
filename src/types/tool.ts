export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  metadata?: {
    durationMs?: number;
    truncated?: boolean;
    mcpServerId?: string;
  };
}

export interface ToolContext {
  workingDirectory: string;
  signal?: AbortSignal;
}
