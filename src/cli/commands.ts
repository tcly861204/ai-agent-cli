/**
 * REPL 内建命令模块
 *
 * 定义所有可通过 / 前缀调用的 REPL 命令。
 * 每个命令注册为一个 Command 对象，包含描述、用法和处理函数。
 * 通过 Map 集中管理，支持按名称查找和列出所有命令。
 */

import type { AgentRuntime } from '../agent/runtime';
import type { ToolRegistry } from '../tool/registry';
import type { Config } from '../types/config';
import { colors } from './renderer';

/**
 * 命令处理器上下文
 * 提供命令处理时需要的所有运行时依赖
 */
export interface CommandContext {
  runtime: AgentRuntime;        // 代理运行时，用于管理对话
  tools: ToolRegistry;          // 工具注册表，用于列出/管理工具
  config: Config;               // 运行时配置（可修改）
  setProvider: (name: string) => void;  // 切换 LLM 提供商
  setModel: (model: string) => void;     // 切换模型
  exit: () => void;             // 退出 REPL
}

/** 命令接口定义 */
interface Command {
  description: string;          // 命令描述
  usage: string;                // 用法说明
  handler: (args: string[], ctx: CommandContext) => void | Promise<void>;  // 处理函数
}

/** 命令注册表 */
const commands = new Map<string, Command>();

// ====== 帮助命令 ======
commands.set('help', {
  description: '显示所有可用命令',
  usage: '/help [command]',
  handler: (args, _ctx) => {
    if (args.length > 0) {
      // 查看特定命令的帮助
      const cmd = commands.get(args[0]!);
      if (cmd) {
        console.log(`\n  ${colors.bold(args[0]!)}`);
        console.log(`  ${colors.dim(cmd.description)}`);
        console.log(`  Usage: ${colors.yellow(cmd.usage)}`);
        return;
      }
      console.log(colors.red(`  Unknown command: ${args[0]}`));
      return;
    }

    // 列出所有命令
    console.log(colors.dim('\n  Available commands:'));
    for (const [name, cmd] of commands) {
      console.log(`  ${colors.cyan('/' + name.padEnd(12))} ${cmd.description}`);
    }
    console.log();
  },
});

// ====== 退出命令 ======
commands.set('exit', {
  description: '退出 REPL',
  usage: '/exit',
  handler: (_args, ctx) => ctx.exit(),
});

commands.set('quit', {
  description: '退出 REPL',
  usage: '/quit',
  handler: (_args, ctx) => ctx.exit(),
});

// ====== 清屏命令 ======
commands.set('clear', {
  description: '清空屏幕',
  usage: '/clear',
  handler: () => {
    process.stdout.write('\x1b[2J\x1b[H');  // ANSI 转义码：清屏 + 光标归位
  },
});

// ====== 模型切换命令 ======
commands.set('model', {
  description: '切换当前使用的模型',
  usage: '/model <name>',
  handler: (args, ctx) => {
    if (args.length === 0) {
      // 无参数时显示当前模型
      console.log(`  Current model: ${colors.yellow(ctx.config.model)}`);
      return;
    }
    ctx.setModel(args.join(' '));
    console.log(colors.green(`  Model set to: ${args.join(' ')}`));
  },
});

// ====== 提供商切换命令 ======
commands.set('provider', {
  description: '切换 LLM 提供商（deepseek / anthropic / openai）',
  usage: '/provider <name>',
  handler: (args, ctx) => {
    if (args.length === 0) {
      // 无参数时显示当前提供商
      console.log(`  Current provider: ${colors.yellow(ctx.config.provider)}`);
      return;
    }
    const name = args[0]!.toLowerCase();
    ctx.setProvider(name);
    console.log(colors.green(`  Provider set to: ${name}`));
    console.log(colors.dim('  (will take effect on next message)'));
  },
});

// ====== 工具列表命令 ======
commands.set('tools', {
  description: '列出所有已注册的工具',
  usage: '/tools',
  handler: (_args, ctx) => {
    const allTools = ctx.tools.getAll();
    if (allTools.length === 0) {
      console.log(colors.dim('  No tools registered.'));
      return;
    }
    console.log(colors.dim(`\n  Registered tools (${allTools.length}):`));
    for (const t of allTools) {
      console.log(`  ${colors.cyan(t.name)}${colors.dim(` — ${t.description}`)}`);
    }
    console.log();
  },
});

// ====== 历史查看命令 ======
commands.set('history', {
  description: '查看对话历史（最近 N 轮）',
  usage: '/history [count]',
  handler: (args, ctx) => {
    const count = args.length > 0 ? Math.max(1, parseInt(args[0]!, 10)) : 10;
    const total = ctx.runtime.getMessageCount();
    if (total === 0) {
      console.log(colors.dim('  No messages in current conversation.'));
      return;
    }
    const start = Math.max(0, total - count);
    console.log(colors.dim(`\n  Conversation history (last ${Math.min(count, total)} of ${total}):`));
    console.log(colors.dim(`  (use /reset to clear)`));
    console.log();
  },
});

// ====== 重置对话命令 ======
commands.set('reset', {
  description: '清空当前对话上下文',
  usage: '/reset',
  handler: (_args, ctx) => {
    ctx.runtime.reset();
    console.log(colors.green('  Conversation reset.'));
  },
});

// ====== 查看配置命令 ======
commands.set('config', {
  description: '查看当前配置信息',
  usage: '/config',
  handler: (_args, ctx) => {
    console.log(colors.dim('\n  Current config:'));
    console.log(`  ${colors.bold('Provider:')}    ${ctx.config.provider}`);
    console.log(`  ${colors.bold('Model:')}       ${ctx.config.model}`);
    console.log(`  ${colors.bold('Max tokens:')}  ${ctx.config.maxTokens}`);
    console.log(`  ${colors.bold('Temp:')}        ${ctx.config.temperature}`);
    console.log(
      `  ${colors.bold('API Keys:')}   anthropic=${ctx.config.apiKeys.anthropic ? '✓' : '✗'} openai=${ctx.config.apiKeys.openai ? '✓' : '✗'} deepseek=${ctx.config.apiKeys.deepseek ? '✓' : '✗'}`,
    );
    console.log(
      `  ${colors.bold('MCP servers:')} ${ctx.config.mcpServers.length}`,
    );
    console.log();
  },
});

// ====== 调试模式命令（占位） ======
commands.set('debug', {
  description: '切换调试模式',
  usage: '/debug',
  handler: () => {
    console.log(colors.yellow('  Debug mode not yet implemented.'));
  },
});

/**
 * 根据名称获取注册的命令
 * @param name - 命令名（不包含斜杠）
 */
export function getCommand(name: string): Command | undefined {
  return commands.get(name);
}

/** 获取所有已注册的命令 */
export function getAllCommands(): Map<string, Command> {
  return commands;
}
