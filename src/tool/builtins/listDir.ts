/**
 * "目录列表"工具（list_dir）
 *
 * 列出目录的内容，显示文件名、类型、大小和修改时间。
 * 支持递归深度控制。
 */

import type { ToolDefinition, ToolContext, ToolResult } from '../../types/tool';
import { readdirSync, statSync, type Stats } from 'node:fs';
import { join, relative } from 'node:path';

/** 最大返回条目数 */
const MAX_ENTRIES = 500;

export const listDirTool: ToolDefinition = {
  name: 'list_dir',
  description:
    'List the contents of a directory. ' +
    'Shows file name, type (file/dir), size, and last modified time. ' +
    'Use depth to control recursion (default: 1 = immediate children only). ' +
    'For exploring project structure.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Directory path to list. Defaults to current working directory.',
      },
      depth: {
        type: 'number',
        description:
          'How deep to recurse into subdirectories. ' +
          '0 = list directory only, 1 = immediate children (default), ' +
          '2 = children and grandchildren, etc.',
        default: 1,
      },
      showHidden: {
        type: 'boolean',
        description:
          'Whether to show hidden files (starting with .). Default: false.',
        default: false,
      },
    },
    required: [],
  },
  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const dirPath = args.path ? String(args.path) : ctx.workingDirectory;
    const depth = Math.max(0, args.depth ? Number(args.depth) : 1);
    const showHidden = args.showHidden === true;

    try {
      const stat = statSync(dirPath);
      if (!stat.isDirectory()) {
        return {
          success: true,
          output: formatFileInfo(dirPath, stat),
        };
      }

      const entries: string[] = [];
      collectEntries(dirPath, dirPath, depth, 0, showHidden, entries);

      if (entries.length === 0) {
        return {
          success: true,
          output: `(empty directory) ${dirPath}`,
        };
      }

      let output = entries.join('\n');
      if (entries.length > MAX_ENTRIES) {
        const remaining = entries.length - MAX_ENTRIES;
        output = entries.slice(0, MAX_ENTRIES).join('\n');
        output += `\n\n---\n... and ${remaining} more entries (${entries.length} total)`;
      } else {
        output += `\n\n---\n${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`;
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

function collectEntries(
  rootDir: string,
  currentDir: string,
  maxDepth: number,
  currentDepth: number,
  showHidden: boolean,
  results: string[],
): void {
  if (currentDepth > maxDepth) return;
  if (results.length >= MAX_ENTRIES) return;

  let entries: string[];
  try {
    entries = readdirSync(currentDir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (results.length >= MAX_ENTRIES) return;
    if (!showHidden && entry.startsWith('.')) continue;

    const fullPath = join(currentDir, entry);
    const relPath = relative(rootDir, fullPath);

    try {
      const entryStat = statSync(fullPath);
      results.push(formatFileInfo(relPath, entryStat));

      if (entryStat.isDirectory() && currentDepth < maxDepth) {
        collectEntries(rootDir, fullPath, maxDepth, currentDepth + 1, showHidden, results);
      }
    } catch {
      results.push(`  ? ${relPath}  (unreadable)`);
    }
  }
}

function formatFileInfo(relPath: string, st: Stats): string {
  const icon = st.isDirectory() ? '[DIR]' : st.isFile() ? '[FILE]' : '[LINK]';
  const size = st.isFile() ? formatSize(Number(st.size)) : ''.padStart(7);
  const mtime = st.mtime.toISOString().slice(0, 16).replace('T', ' ');
  return `  ${icon} ${relPath.padEnd(50)} ${size}  ${mtime}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
