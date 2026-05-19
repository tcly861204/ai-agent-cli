/**
 * "写入文件"工具（write_file）
 *
 * 允许 LLM 将文本内容写入指定路径的文件。
 * 用于创建新文件、修改已有文件等场景。
 *
 * 安全特性：
 * - 不阻止写入任何路径（由运行时的系统权限控制）
 * - 写入时会自动创建不存在的父目录
 * - 默认不覆盖已有文件，需要通过 overwrite 参数明确确认
 */

import type { ToolDefinition, ToolContext, ToolResult } from '../../types/tool';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/** 单次写入的最大字符数（10MB） */
const MAX_WRITE_SIZE = 10 * 1024 * 1024;

export const writeFileTool: ToolDefinition = {
  name: 'write_file',
  description:
    'Write text content to a file at the specified path. ' +
    'Creates parent directories automatically if they do not exist. ' +
    'By default, will not overwrite an existing file unless overwrite=true is explicitly set. ' +
    'Use this tool to create new files or modify existing text files.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Absolute or relative path of the file to write',
      },
      content: {
        type: 'string',
        description: 'Text content to write to the file',
      },
      overwrite: {
        type: 'boolean',
        description:
          'Set to true to overwrite an existing file. ' +
          'If false or omitted and the file exists, the operation will fail.',
        default: false,
      },
    },
    required: ['path', 'content'],
  },
  async execute(args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> {
    const filePath = String(args.path ?? '');
    const content = String(args.content ?? '');
    const overwrite = args.overwrite === true;

    if (!filePath) {
      return { success: false, output: '', error: 'path is required' };
    }

    // 检查写入内容大小
    if (content.length > MAX_WRITE_SIZE) {
      return {
        success: false,
        output: '',
        error: `Content too large (${content.length} chars). Maximum allowed: ${MAX_WRITE_SIZE} chars (10MB).`,
      };
    }

    try {
      // 检查文件是否已存在
      if (existsSync(filePath) && !overwrite) {
        return {
          success: false,
          output: '',
          error:
            `File already exists: ${filePath}. ` +
            'If you want to overwrite it, set overwrite=true in the tool arguments.',
        };
      }

      // 自动创建父目录
      const parentDir = dirname(filePath);
      if (parentDir && !existsSync(parentDir)) {
        mkdirSync(parentDir, { recursive: true });
      }

      // 写入文件
      writeFileSync(filePath, content, 'utf-8');

      return {
        success: true,
        output: `Successfully wrote ${content.length} characters to: ${filePath}`,
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
