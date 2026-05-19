import type { ToolDefinition, ToolContext, ToolResult } from '../../types/tool';

export const thinkTool: ToolDefinition = {
  name: 'think',
  description:
    'Use this tool to think through complex problems step by step. ' +
    'Describe your reasoning process, consider alternatives, and decide on the best approach.',
  parameters: {
    type: 'object',
    properties: {
      thoughts: {
        type: 'string',
        description: 'Your step-by-step reasoning process',
      },
    },
    required: ['thoughts'],
  },
  async execute(args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> {
    const thoughts = String(args.thoughts ?? '');
    return {
      success: true,
      output: `Thinking complete. Considerations:\n\n${thoughts}`,
    };
  },
};
