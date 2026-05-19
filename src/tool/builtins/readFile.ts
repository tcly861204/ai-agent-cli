/**
 * "读取文件"工具（read_file）
 *
 * 允许 LLM 读取指定路径的文本文件内容。
 * 用于需要查看源代码、配置文件、日志文件等场景。
 *
 * 安全限制：
 * - 文件最大读取长度 1MB，超出则截断
 * - 不阻止读取任何路径（由运行时的系统权限控制）
 */

import type { ToolDefinition, ToolContext, ToolResult } from '../../types/tool';
import { readFileSync, existsSync, statSync } from 'node:fs';

/** 单次读取的最大字节数（1MB） */
const MAX_FILE_SIZE = 1 * 1024 * 1024;

export const readFileTool: ToolDefinition = {
  name: 'read_file',
  description:
    'Read the contents of a text file at the specified path. ' +
    'Returns the file content or an error if the file does not exist, ' +
    'is a directory, or exceeds the maximum read size (1MB).',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Absolute or relative path to the file to read',
      },
      limit: {
        type: 'number',
        description:
          'Optional. Maximum number of lines to return, counting from the beginning. ' +
          'Useful for previewing very large files. Default: return all lines.',
      },
    },
    required: ['path'],
  },
  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const filePath = String(args.path ?? '');
    const limit = args.limit ? Number(args.limit) : 0;

    if (!filePath) {
      return { success: false, output: '', error: 'path is required' };
    }

    try {
      // 检查文件是否存在
      if (!existsSync(filePath)) {
        return {
          success: false,
          output: '',
          error: `File not found: ${filePath}`,
        };
      }

      // 检查是否为文件（而不是目录）
      const stats = statSync(filePath);
      if (!stats.isFile()) {
        return {
          success: false,
          output: '',
          error: `Not a file: ${filePath}`,
        };
      }

      // 检查文件大小
      if (stats.size > MAX_FILE_SIZE) {
        return {
          success: false,
          output: '',
          error: `File too large (${stats.size} bytes). Maximum allowed: ${MAX_FILE_SIZE} bytes (1MB).`,
        };
      }

      // 读取文件内容
      const content = readFileSync(filePath, 'utf-8');
      const totalLines = content.split('\n').length;

      // 如果指定了行数限制，截取前 N 行
      let output = content;
      let truncated = false;
      if (limit > 0 && totalLines > limit) {
        const lines = content.split('\n');
        output = lines.slice(0, limit).join('\n');
        truncated = true;
      }

      // 在输出末尾附加文件元信息
      const meta = `\n\n---\nFile: ${filePath}\nLines: ${Math.min(limit || totalLines, totalLines)}/${totalLines}${truncated ? ' (truncated)' : ''}\nSize: ${stats.size} bytes`;

      return {
        success: true,
        output: output + meta,
        metadata: { truncated },
      };
    } catch (err) {
      return {
        success: false,
        output: '',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
