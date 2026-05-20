/**
 * "编辑文件"工具（edit）
 *
 * 对文件进行精确的字符串替换（search & replace）。
 * 相比 write_file 的整文件覆写，edit 可以只修改文件中
 * 的一小部分，适合修复 bug、重命名变量等场景。
 *
 * 安全特性：
 * - old_string 必须唯一匹配，否则报错（防止误替换）
 * - 支持 replace_all 模式替换所有匹配
 */

import type { ToolDefinition, ToolContext, ToolResult } from '../../types/tool';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

export const editTool: ToolDefinition = {
  name: 'edit',
  description:
    'Edit a file by replacing exact text. ' +
    'Performs a surgical find-and-replace on a file. ' +
    'By default, only replaces the first occurrence. ' +
    'Use replace_all=true to replace all occurrences. ' +
    'Fails if old_string is not found or if it matches multiple times (when replace_all is false).',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Absolute or relative path to the file to edit',
      },
      old_string: {
        type: 'string',
        description:
          'The exact text to search for. Must match the file content exactly, ' +
          'including whitespace and indentation.',
      },
      new_string: {
        type: 'string',
        description: 'The replacement text',
      },
      replace_all: {
        type: 'boolean',
        description:
          'If true, replace all occurrences of old_string. ' +
          'If false (default), only replace the first occurrence.',
        default: false,
      },
    },
    required: ['path', 'old_string', 'new_string'],
  },
  async execute(args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> {
    const filePath = String(args.path ?? '');
    const oldString = String(args.old_string ?? '');
    const newString = String(args.new_string ?? '');
    const replaceAll = args.replace_all === true;

    if (!filePath || !oldString) {
      return { success: false, output: '', error: 'path and old_string are required' };
    }

    if (!existsSync(filePath)) {
      return { success: false, output: '', error: `File not found: ${filePath}` };
    }

    try {
      const content = readFileSync(filePath, 'utf-8');

      if (replaceAll) {
        // 替换所有匹配
        if (!content.includes(oldString)) {
          return {
            success: false,
            output: '',
            error: `old_string not found in file: "${oldString.slice(0, 80)}${oldString.length > 80 ? '...' : ''}"`,
          };
        }

        const count = content.split(oldString).length - 1;
        const newContent = content.split(oldString).join(newString);

        writeFileSync(filePath, newContent, 'utf-8');

        return {
          success: true,
          output: `Replaced ${count} occurrence(s) in: ${filePath}`,
        };
      }

      // 单次替换：必须唯一匹配
      const firstIndex = content.indexOf(oldString);
      if (firstIndex === -1) {
        return {
          success: false,
          output: '',
          error: `old_string not found in file: "${oldString.slice(0, 80)}${oldString.length > 80 ? '...' : ''}"`,
        };
      }

      const secondIndex = content.indexOf(oldString, firstIndex + 1);
      if (secondIndex !== -1) {
        return {
          success: false,
          output: '',
          error:
            `Found multiple occurrences (${content.split(oldString).length - 1}) of old_string. ` +
            'Set replace_all=true to replace all, or provide more context to make old_string unique.',
        };
      }

      const newContent = content.replace(oldString, newString);
      writeFileSync(filePath, newContent, 'utf-8');

      return {
        success: true,
        output: `Replaced 1 occurrence in: ${filePath}`,
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
