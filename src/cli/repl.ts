/**
 * REPL（Read-Eval-Print Loop）主循环
 *
 * 提供两种运行模式：
 * 1. 交互模式（TTY）：带行编辑、历史记录、旋转器的全功能交互式界面
 * 2. 管道模式（非 TTY）：逐行读取标准输入，顺序处理后退出
 *
 * 交互模式特性：
 * - 行编辑和命令历史
 * - 命令历史持久化（保存到 ~/.ai-agent/history）
 * - Ctrl+C 中断支持（正在运行时中断生成，空闲时询问退出）
 * - 等待 LLM 响应时的旋转动画
 */

import * as readline from 'node:readline';
import { stdin as readStdin } from 'node:process';
import type { AgentRuntime } from '../agent/runtime';
import type { ToolRegistry } from '../tool/registry';
import type { Config } from '../types/config';
import { parseInput } from './parser';
import { getCommand, type CommandContext } from './commands';
import { renderEvent, renderWelcome, renderPrompt, colors } from './renderer';
import { Spinner } from './spinner';

/** REPL 启动所需的依赖注入 */
export interface ReplDependencies {
  runtime: AgentRuntime;                    // 代理运行时
  tools: ToolRegistry;                      // 工具注册表
  config: Config;                           // 当前配置
  setProvider: (name: string) => void;      // 切换提供商
  setModel: (model: string) => void;        // 切换模型
}

/**
 * 启动 REPL 主入口
 * 根据标准输入是否为 TTY 自动选择交互模式或管道模式
 */
export async function startRepl(deps: ReplDependencies): Promise<void> {
  const { runtime, tools, config, setProvider, setModel } = deps;

  // 非 TTY 模式（如管道输入）：逐行处理，顺序退出
  if (!process.stdin.isTTY) {
    await runPipedMode(deps);
    return;
  }

  // TTY 模式：交互式 REPL
  await runInteractiveMode(deps);
}

/**
 * 管道模式：从标准输入逐行读取并处理
 * 适用于 echo "hello" | bun run src/index.ts 这样的管道调用
 */
async function runPipedMode(deps: ReplDependencies): Promise<void> {
  const { runtime, tools, config, setProvider, setModel } = deps;

  const cmdCtx: CommandContext = {
    runtime, tools, config, setProvider, setModel,
    exit: () => {},
  };

  const rl = readline.createInterface({ input: process.stdin });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const parsed = parseInput(trimmed);

    switch (parsed.type) {
      case 'command': {
        const cmd = getCommand(parsed.command);
        if (cmd) {
          await cmd.handler(parsed.args, cmdCtx);
        }
        if (parsed.command === 'exit' || parsed.command === 'quit') {
          return;
        }
        break;
      }
      case 'message':
      case 'multiline': {
        // 管道模式下仅输出最终文本，不展示流式细节
        for await (const event of runtime.run(parsed.text)) {
          if (event.type === 'text') {
            console.log(event.content);
          }
        }
        break;
      }
    }
  }
}

/**
 * 交互式 REPL 模式：完整的终端交互界面
 *
 * 使用 while 循环 + 会话(Promise)模式替代简单的 readline 事件驱动，
 * 核心原因是 Bun 在 Windows 平台上会在处理完第一行输入后让 stdin
 * 意外 emit 'end' → readline 'close' → 进程退出。
 *
 * 解决方案：每次 readline 意外关闭时，由外层 while 循环重建一个
 * 全新的 readline 会话，保持 REPL 持续运作。
 *
 * 功能特性：
 * - readline 行编辑
 * - 命令历史持久化到文件
 * - 等待响应时的旋转动画
 * - Ctrl+C 中断处理
 * - 支持多行输入
 */
async function runInteractiveMode(deps: ReplDependencies): Promise<void> {
  const { runtime, tools, config, setProvider, setModel } = deps;

  // 初始化历史文件访问（共用的 I/O 需要等 fs/path 加载）
  const fs = await import('node:fs');
  const path = await import('node:path');
  const historyDir = path.join(require('os').homedir(), '.ai-agent');
  const historyFile = path.join(historyDir, 'history');

  try {
    if (!fs.existsSync(historyDir)) {
      fs.mkdirSync(historyDir, { recursive: true });
    }
  } catch {
    // best-effort
  }

  /** 将输入保存到历史文件 */
  function saveHistory(input: string) {
    try {
      fs.appendFileSync(historyFile, input + '\n', 'utf-8');
    } catch {
      // best-effort
    }
  }

  /** 加载历史文件内容 */
  function loadHistory(): string[] {
    try {
      if (fs.existsSync(historyFile)) {
        return fs.readFileSync(historyFile, 'utf-8').split('\n').filter(Boolean);
      }
    } catch {
      // best-effort
    }
    return [];
  }

  // 确保 stdin 持续处于 flowing 模式（Windows + Bun 核心兼容）
  process.stdin.resume();

  // ---- 外层循环：readline 会话意外关闭时自动重建 ----
  let closeRequested = false;
  let welcomeShown = false;

  while (!closeRequested) {
    closeRequested = await runReplSession();
    welcomeShown = true;
  }

  // ---- 子函数：单个 readline 会话 ----
  // 返回 true=正常退出, false=意外关闭需要重建
  async function runReplSession(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      // ---- 创建 readline 接口 ----
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: renderPrompt(config.provider),
        historySize: 100,
      });

      // 加载历史到 readline
      try {
        const lines = loadHistory();
        const prev = (rl as any)._previousValues;
        if (prev && Array.isArray(prev)) {
          prev.push(...lines.slice(-100));
        }
      } catch {
        // best-effort
      }

      // ---- 会话状态 ----
      let sessionExitRequested = false;       // 本会话是否主动请求退出
      let running = false;                    // 是否正在处理 LLM 请求
      let abortController = new AbortController();

      // ---- 命令处理上下文 ----
      const cmdCtx: CommandContext = {
        runtime, tools, config, setProvider, setModel,
        exit: () => {
          sessionExitRequested = true;
          closeRequested = true;
          rl.close();
        },
      };

      // 只在首次显示欢迎
      if (!welcomeShown) {
        renderWelcome();
      }
      rl.prompt();

      // ---- 行输入事件处理 ----
      rl.on('line', async (line: string) => {
        if (running) return;

        const parsed = parseInput(line);

        switch (parsed.type) {
          case 'empty':
            rl.prompt();
            return;

          case 'command': {
            const cmd = getCommand(parsed.command);
            if (cmd) {
              try {
                await cmd.handler(parsed.args, cmdCtx);
              } catch (err) {
                console.error(colors.red(`  Command error: ${err}`));
              }
            } else {
              console.log(colors.red(`  Unknown command: /${parsed.command}. Type /help for commands.`));
            }
            rl.prompt();
            return;
          }

          case 'message':
          case 'multiline': {
            running = true;
            abortController = new AbortController();
            saveHistory(parsed.text);

            const spinner = new Spinner();
            spinner.start('  ', colors.dim('thinking...'));
            let spinnerActive = true;

            try {
              for await (const event of runtime.run(parsed.text, abortController.signal)) {
                // 只在第一个事件时关闭 spinner，防后续 text_delta 被 \r\x1b[K 清除
                if (spinnerActive) {
                  spinner.stop();
                  spinnerActive = false;
                }
                renderEvent(event, config.ui.showToolOutput);
              }
            } catch (err) {
              if (spinnerActive) {
                spinner.stop();
                spinnerActive = false;
              }
              if (err instanceof Error && err.name === 'AbortError') {
                console.log(colors.yellow('\n  Cancelled.'));
              } else {
                console.error(colors.red(`\n  Error: ${err}`));
              }
            }

            running = false;
            // 流式文本以 text_delta 输出时不带换行，短回答后光标还在原行。
            // 不加此换行，rl.prompt() 的 \r 回车会覆盖短回答文本。
            process.stdout.write('\n');
            // 保持 stdin 持续 flowing（Windows + Bun 兼容关键）
            process.stdin.resume();
            rl.prompt();
            return;
          }
        }
      });

      // ---- SIGINT (Ctrl+C) ----
      rl.on('SIGINT', () => {
        if (running) {
          abortController.abort();
          console.log(colors.yellow('\n  Aborting...'));
        } else {
          rl.question(colors.dim('\n  Exit? (y/N) '), (answer: string) => {
            if (answer.toLowerCase() === 'y') {
              sessionExitRequested = true;
              closeRequested = true;
              rl.close();
            } else {
              rl.prompt();
            }
          });
        }
      });

      // ---- REPL 关闭事件（关键修复点） ----
      rl.on('close', () => {
        if (sessionExitRequested) {
          // 主动退出：结束外层循环
          console.log(colors.dim('\n  Goodbye!\n'));
          resolve(true);
        } else {
          // 意外关闭（Bun/Windows stdin 兼容问题）：重建会话
          resolve(false);
        }
      });
    });
  }
}
