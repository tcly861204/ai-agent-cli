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
 * 功能特性：
 * - readline 行编辑
 * - 命令历史持久化到文件
 * - 等待响应时的旋转动画
 * - Ctrl+C 中断处理
 * - 支持多行输入
 */
async function runInteractiveMode(deps: ReplDependencies): Promise<void> {
  const { runtime, tools, config, setProvider, setModel } = deps;

  // 创建 readline 接口
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: renderPrompt(config.provider),  // 动态提示符（显示提供商名）
    historySize: 100,                        // 记录最近 100 条历史
  });

  // ---- 历史持久化到文件 ----
  const fs = await import('node:fs');
  const path = await import('node:path');
  const historyDir = path.join(require('os').homedir(), '.ai-agent');
  const historyFile = path.join(historyDir, 'history');

  try {
    // 确保历史目录存在
    if (!fs.existsSync(historyDir)) {
      fs.mkdirSync(historyDir, { recursive: true });
    }
    // 加载历史文件到 readline 历史
    if (fs.existsSync(historyFile)) {
      const lines = fs.readFileSync(historyFile, 'utf-8').split('\n').filter(Boolean);
      const prev = (rl as any)._previousValues;
      if (prev && Array.isArray(prev)) {
        prev.push(...lines.slice(-100));
      }
    }
  } catch {
    // 历史持久化是锦上添花的功能，失败时静默忽略
  }

  /** 将输入保存到历史文件 */
  function saveHistory(input: string) {
    try {
      fs.appendFileSync(historyFile, input + '\n', 'utf-8');
    } catch {
      // best-effort
    }
  }

  // ---- 运行状态 ----
  let running = false;                        // 是否正在处理 LLM 请求
  let abortController = new AbortController(); // 用于中断当前请求

  // 命令处理上下文
  const cmdCtx: CommandContext = {
    runtime,
    tools,
    config,
    setProvider,
    setModel,
    exit: () => rl.close(),
  };

  // 显示欢迎信息并显示提示符
  renderWelcome();
  rl.prompt();

  // ---- 行输入事件处理 ----
  rl.on('line', async (line: string) => {
    // 正在处理请求时忽略新输入
    if (running) return;

    const parsed = parseInput(line);

    switch (parsed.type) {
      case 'empty':
        // 空输入：重新显示提示符
        rl.prompt();
        return;

      case 'command': {
        // 执行内建命令
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
        // 处理普通消息/多行消息
        running = true;
        abortController = new AbortController();  // 创建新的取消控制器
        saveHistory(parsed.text);                  // 保存到历史文件

        // 启动旋转器
        const spinner = new Spinner();
        spinner.start('  ', colors.dim('thinking...'));

        try {
          // 遍历运行时事件流
          for await (const event of runtime.run(parsed.text, abortController.signal)) {
            // 收到第一个事件后立即停止旋转器
            spinner.stop();
            renderEvent(event, config.ui.showToolOutput);
          }
        } catch (err) {
          spinner.stop();
          if (err instanceof Error && err.name === 'AbortError') {
            console.log(colors.yellow('\n  Cancelled.'));
          } else {
            console.error(colors.red(`\n  Error: ${err}`));
          }
        }

        running = false;
        rl.prompt();
        return;
      }
    }
  });

  // ---- SIGINT (Ctrl+C) 处理 ----
  rl.on('SIGINT', () => {
    if (running) {
      // 正在处理请求：中断当前 LLM 调用
      abortController.abort();
      console.log(colors.yellow('\n  Aborting...'));
    } else {
      // 空闲状态：询问是否退出
      rl.question(colors.dim('\n  Exit? (y/N) '), (answer: string) => {
        if (answer.toLowerCase() === 'y') {
          rl.close();
        } else {
          rl.prompt();
        }
      });
    }
  });

  // ---- REPL 关闭事件 ----
  rl.on('close', () => {
    console.log(colors.dim('\n  Goodbye!\n'));
    process.exit(0);
  });
}
