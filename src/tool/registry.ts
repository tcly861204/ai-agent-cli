import type { ToolDefinition, ToolResult, ToolContext } from '../types/tool';

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  remove(name: string): boolean {
    return this.tools.delete(name);
  }

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
      result.metadata = {
        ...result.metadata,
        durationMs: Math.round(performance.now() - start),
      };
      return result;
    } catch (err) {
      return {
        success: false,
        output: '',
        error: err instanceof Error ? err.message : String(err),
        metadata: { durationMs: Math.round(performance.now() - start) },
      };
    }
  }

  getToolDefinitionsForProvider(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }
}
