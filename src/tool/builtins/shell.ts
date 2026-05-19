/**
 * "命令行"工具（shell）
 *
 * 允许 LLM 执行 Shell 命令。用于运行脚本、编译代码、
 * 启动服务、文件操作等需要命令行操作的场景。
 *
 * 安全限制：
 * - 默认超时 30 秒，防止长时间运行的命令阻塞
 * - 输出截断 32KB，防止输出过大
 * - 可通过配置调整超时和输出限制
 */

import type { ToolDefinition, ToolContext, ToolResult } from '../../types/tool';
import { execSync } from 'node:child_process';

/** 默认命令超时时间（毫秒） */
const DEFAULT_TIMEOUT = 30_000;

/** 最大输出长度（字符数） */
const MAX_OUTPUT_LENGTH = 32_768;

export const shellTool: ToolDefinition = {
  name: 'shell',
  description:
    'Execute a shell command on the local system. ' +
    'The command runs in the current working directory. ' +
    'Use this tool to run scripts, compile code, list files, ' +
    'or perform any command-line operation. ' +
    `Output is truncated at ${MAX_OUTPUT_LENGTH} characters. ` +
    `Commands time out after ${DEFAULT_TIMEOUT / 1000} seconds by default.`,
  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description:
          'The shell command to execute. ' +
          'Use full commands as you would in a terminal. ' +
          'For PowerShell on Windows, use PowerShell syntax.',
      },
      timeout: {
        type: 'number',
        description:
          `Optional timeout in milliseconds (default: ${DEFAULT_TIMEOUT}). ` +
          'Use a longer timeout for long-running commands like builds or tests.',
        default: DEFAULT_TIMEOUT,
      },
      cwd: {
        type: 'string',
        description:
          'Optional working directory for the command. ' +
          'Defaults to the current working directory.',
      },
    },
    required: ['command'],
  },
  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const command = String(args.command ?? '').trim();
    const timeout = Number(args.timeout ?? DEFAULT_TIMEOUT);
    const cwd = args.cwd ? String(args.cwd) : ctx.workingDirectory;

    if (!command) {
      return { success: false, output: '', error: 'command is required' };
    }

    try {
      const output = execSync(command, {
        cwd,
        timeout,
        encoding: 'utf-8',
        maxBuffer: MAX_OUTPUT_LENGTH,
        windowsHide: true,
      });

      // 输出截断
      let resultOutput = output;
      let truncated = false;
      if (resultOutput.length > MAX_OUTPUT_LENGTH) {
        resultOutput = resultOutput.slice(0, MAX_OUTPUT_LENGTH);
        truncated = true;
      }

      const exitCode = 0;
      const meta = `\n\n---\nExit code: ${exitCode}${truncated ? '\nOutput truncated at ' + MAX_OUTPUT_LENGTH + ' characters' : ''}`;

      return {
        success: true,
        output: resultOutput + meta,
        metadata: {
          truncated,
          exitCode,
        },
      };
    } catch (err) {
      if (err instanceof Error) {
        const execErr = err as Error & { stderr?: string; stdout?: string; status?: number; signal?: string };

        let errorOutput = execErr.stderr || execErr.message;
        let stdoutOutput = execErr.stdout || '';
        const exitCode = execErr.status ?? 1;

        // 截断错误输出
        if (errorOutput.length > MAX_OUTPUT_LENGTH) {
          errorOutput = errorOutput.slice(0, MAX_OUTPUT_LENGTH);
        }
        if (stdoutOutput.length > MAX_OUTPUT_LENGTH) {
          stdoutOutput = stdoutOutput.slice(0, MAX_OUTPUT_LENGTH);
        }

        const meta = `\n\n---\nExit code: ${exitCode}`;
        const outputParts: string[] = [];
        if (stdoutOutput) outputParts.push(stdoutOutput);
        outputParts.push(meta);

        return {
          success: exitCode === 0,
          output: outputParts.join(''),
          error: errorOutput || `Command failed with exit code ${exitCode}`,
          metadata: { exitCode },
        };
      }
      return {
        success: false,
        output: '',
        error: String(err),
      };
    }
  },
};
