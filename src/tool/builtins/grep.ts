/**
 * "内容搜索"工具（grep）
 *
 * 在文件中搜索匹配正则表达式的行。支持：
 * - 递归目录搜索
 * - 显示行号和上下文行
 * - 按文件 glob 过滤（如只搜索 *.ts 文件）
 * - 限制文件大小，跳过二进制文件
 *
 * 限制：最多扫描 10000 个文件，返回前 500 条匹配。
 */

import type { ToolDefinition, ToolContext, ToolResult } from '../../types/tool';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** 最大扫描文件数 */
const MAX_FILES = 10_000;
/** 最大返回匹配行数 */
const MAX_MATCHES = 500;
/** 跳过大于此大小的文件（500KB） */
const MAX_FILE_SIZE = 512 * 1024;
/** 上下文行数 */
const CONTEXT_LINES = 2;

/** 文本文件扩展名白名单 */
const TEXT_EXTENSIONS = new Set([
  '.ts', '.js', '.jsx', '.tsx', '.mjs', '.cjs', '.mts', '.cts',
  '.json', '.yaml', '.yml', '.toml', '.xml', '.html', '.css', '.scss', '.less',
  '.md', '.mdx', '.txt', '.log',
  '.sh', '.bash', '.ps1', '.bat', '.cmd',
  '.py', '.rb', '.go', '.rs', '.java', '.kt', '.swift', '.c', '.cpp', '.h',
  '.sql', '.graphql', '.gql',
  '.env', '.gitignore', '.dockerfile', '.editorconfig',
  '.vue', '.svelte', '.astro',
]);

function isTextFile(filePath: string): boolean {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  if (TEXT_EXTENSIONS.has(ext)) return true;
  // 无扩展名或无后缀的常见文本文件
  const base = filePath.split(/[/\\]/).pop() ?? '';
  const noExtNames = new Set([
    'Dockerfile', 'Makefile', 'docker-compose', 'Gemfile', 'Rakefile',
  ]);
  return noExtNames.has(base);
}

export const grepTool: ToolDefinition = {
  name: 'grep',
  description:
    'Search file contents for lines matching a regular expression pattern. ' +
    'Returns matching lines with line numbers and surrounding context. ' +
    'Optionally filter by file glob pattern (e.g. "*.ts"). ' +
    'Skips binary files and files larger than 500KB.',
  parameters: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description:
          'Regular expression pattern to search for. ' +
          'Uses JavaScript RegExp syntax (case-sensitive by default, prepend (?i) for case-insensitive). ' +
          'Example: "function\\s+\\w+" or "(?i)error"',
      },
      path: {
        type: 'string',
        description:
          'Directory or file to search in. Defaults to current working directory.',
      },
      glob: {
        type: 'string',
        description:
          'Optional file glob filter. Only search files matching this pattern. ' +
          'Examples: "*.ts", "*.{ts,js}", "src/**/*.css"',
      },
      maxMatches: {
        type: 'number',
        description: `Optional. Maximum number of matches to return (default: ${MAX_MATCHES}).`,
        default: MAX_MATCHES,
      },
    },
    required: ['pattern'],
  },
  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const pattern = String(args.pattern ?? '').trim();
    const searchPath = args.path ? String(args.path) : ctx.workingDirectory;
    const globFilter = args.glob ? String(args.glob) : '';
    const maxMatches = Math.min(
      args.maxMatches ? Number(args.maxMatches) : MAX_MATCHES,
      MAX_MATCHES,
    );

    if (!pattern) {
      return { success: false, output: '', error: 'pattern is required' };
    }

    let regex: RegExp;
    try {
      regex = new RegExp(pattern);
    } catch (err) {
      return {
        success: false,
        output: '',
        error: `Invalid regex: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    try {
      const stat = statSync(searchPath);
      if (stat.isFile()) {
        // 单个文件搜索
        return {
          success: true,
          output: searchFile(searchPath, regex, maxMatches, searchPath),
        };
      }

      // 目录搜索
      const entries = readdirSync(searchPath, { recursive: true, encoding: 'utf-8' });
      let filesScanned = 0;
      let totalMatches = 0;
      const resultParts: string[] = [];
      let currentFile = '';

      for (const entry of entries) {
        if (filesScanned >= MAX_FILES) {
          resultParts.push(`\n---\nReached scan limit (${MAX_FILES} files). Results may be incomplete.`);
          break;
        }
        filesScanned++;

        const fullPath = join(searchPath, entry);

        try {
          const entryStat = statSync(fullPath);
          if (!entryStat.isFile()) continue;
          if (entryStat.size > MAX_FILE_SIZE) continue;
          if (entryStat.size === 0) continue;
        } catch {
          continue;
        }

        // 可选 glob 过滤
        if (globFilter) {
          try {
            const globMatch = new Bun.Glob(globFilter);
            if (!globMatch.match(entry as string)) continue;
          } catch {
            // 忽略 glob 匹配错误
          }
        }

        // 检查是否文本文件
        if (!isTextFile(fullPath)) continue;

        try {
          const content = readFileSync(fullPath, 'utf-8');
          const lines = content.split('\n');
          let fileMatches: Array<{ line: number; text: string }> = [];

          for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i]!)) {
              // 重新 test（防止 lastIndex 问题）
              regex.lastIndex = 0;
              fileMatches.push({ line: i + 1, text: lines[i]! });
              if (fileMatches.length >= maxMatches) break;
            }
            regex.lastIndex = 0;
          }

          if (fileMatches.length > 0) {
            // 文件头
            resultParts.push(`\n${entry}`);
            currentFile = entry as string;

            for (const match of fileMatches) {
              if (totalMatches >= maxMatches) break;
              totalMatches++;

              // 上下文行
              const start = Math.max(0, match.line - CONTEXT_LINES - 1);
              const end = Math.min(lines.length, match.line + CONTEXT_LINES);
              for (let i = start; i < end; i++) {
                const prefix = i === match.line - 1 ? '>' : ' ';
                resultParts.push(`  ${prefix} ${i + 1}: ${lines[i]}`);
              }
              resultParts.push('  ─');
            }

            if (totalMatches >= maxMatches) {
              resultParts.push(`\n---\nReached match limit (${maxMatches}).`);
              break;
            }
          }
        } catch {
          continue;
        }
      }

      if (resultParts.length === 0) {
        return {
          success: true,
          output: `No matches found for "${pattern}" in ${searchPath}`,
        };
      }

      return {
        success: true,
        output: resultParts.join('\n') + `\n\n---\n${totalMatches} match(es) in ${filesScanned} file(s) scanned`,
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

/** 搜索单个文件 */
function searchFile(
  filePath: string,
  regex: RegExp,
  maxMatches: number,
  basePath: string,
): string {
  const relative = filePath.startsWith(basePath)
    ? filePath.slice(basePath.length + 1)
    : filePath;
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const parts: string[] = [`\n${relative}`];
  let matches = 0;

  for (let i = 0; i < lines.length; i++) {
    if (matches >= maxMatches) break;
    regex.lastIndex = 0;
    if (regex.test(lines[i]!)) {
      matches++;
      const start = Math.max(0, i - CONTEXT_LINES);
      const end = Math.min(lines.length, i + CONTEXT_LINES + 1);
      for (let j = start; j < end; j++) {
        const prefix = j === i ? '>' : ' ';
        parts.push(`  ${prefix} ${j + 1}: ${lines[j]}`);
      }
      parts.push('  ─');
    }
  }

  parts.push(`\n---\n${matches} match(es) in ${relative}`);
  return parts.join('\n');
}
