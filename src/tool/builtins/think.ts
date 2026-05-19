/**
 * "思考"工具（think tool）
 *
 * 一个特殊的空操作（no-op）工具，允许 LLM 记录分步推理过程。
 * 这个工具不产生任何副作用，只是将 LLM 的推理过程返回给它自己。
 *
 * 用途：
 * - 让 LLM 在复杂问题前先梳理思路
 * - 记录决策过程和备选方案
 * - 提高复杂任务的推理质量
 */

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
