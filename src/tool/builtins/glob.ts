/**
 * "文件搜索"工具（glob）
 *
 * 使用 Bun.Glob 按模式匹配文件名，支持标准 glob 语法：
 *
 *   模式示例：
 *   - "** / *.ts"      递归匹配所有 .ts 文件（忽略空格）
 *   - "src/** / *.ts"  只在 src 目录下递归匹配 .ts
 *   - "*.json"         当前目录的 json 文件
 *   - "?ata.*"         匹配 "data.*" 等
 *   - "{a,b}.ts"       匹配 a.ts 或 b.ts
 *
 * 限制：最多返回 1000 条结果，超出则截断提示。
 */

import type { ToolDefinition, ToolContext, ToolResult } from '../../types/tool';

/** 单次搜索的最大结果数 */
const MAX_RESULTS = 1000;

export const globTool: ToolDefinition = {
  name: 'glob',
  description:
    'Search for files and directories matching a glob pattern. ' +
    'Supports ** (recursive), * (any chars), ? (single char), {a,b} (alternation). ' +
    'Returns relative file paths. Use this to find files by name pattern.',
  parameters: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description:
          'Glob pattern to match files against. ' +
          'Examples: "**/*.ts", "src/**/*.css", "*.json", "**/{index,main}.*"',
      },
      base: {
        type: 'string',
        description:
          'Optional base directory. Defaults to current working directory. ' +
          'Use "." for current directory, or an absolute/relative path.',
        default: '.',
      },
    },
    required: ['pattern'],
  },
  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const pattern = String(args.pattern ?? '').trim();
    const base = args.base ? String(args.base) : ctx.workingDirectory;

    if (!pattern) {
      return { success: false, output: '', error: 'pattern is required' };
    }

    try {
      const bunGlob = new Bun.Glob(pattern);
      const results: string[] = [];
      let total = 0;

      for (const match of bunGlob.scanSync({ cwd: base, absolute: false })) {
        total++;
        if (results.length < MAX_RESULTS) {
          results.push(match);
        }
      }

      if (total === 0) {
        return {
          success: true,
          output: `No files matching "${pattern}" in ${base}`,
        };
      }

      let output = results.join('\n');
      if (results.length < total) {
        output += `\n\n---\nShowing ${results.length} of ${total} results (truncated)`;
      } else {
        output += `\n\n---\n${total} file(s) found`;
      }

      return { success: true, output };
    } catch (err) {
      return {
        success: false,
        output: '',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
