import type { AgentRuntime } from '../agent/runtime';
import type { ToolRegistry } from '../tool/registry';
import type { Config } from '../types/config';
import { colors } from './renderer';

export interface CommandContext {
  runtime: AgentRuntime;
  tools: ToolRegistry;
  config: Config;
  setProvider: (name: string) => void;
  setModel: (model: string) => void;
  exit: () => void;
}

interface Command {
  description: string;
  usage: string;
  handler: (args: string[], ctx: CommandContext) => void | Promise<void>;
}

const commands = new Map<string, Command>();

commands.set('help', {
  description: 'Show available commands',
  usage: '/help [command]',
  handler: (args, _ctx) => {
    if (args.length > 0) {
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

    console.log(colors.dim('\n  Available commands:'));
    for (const [name, cmd] of commands) {
      console.log(`  ${colors.cyan('/' + name.padEnd(12))} ${cmd.description}`);
    }
    console.log();
  },
});

commands.set('exit', {
  description: 'Exit the REPL',
  usage: '/exit',
  handler: (_args, ctx) => ctx.exit(),
});

commands.set('quit', {
  description: 'Exit the REPL',
  usage: '/quit',
  handler: (_args, ctx) => ctx.exit(),
});

commands.set('clear', {
  description: 'Clear screen',
  usage: '/clear',
  handler: () => {
    process.stdout.write('\x1b[2J\x1b[H');
  },
});

commands.set('model', {
  description: 'Switch active model',
  usage: '/model <name>',
  handler: (args, ctx) => {
    if (args.length === 0) {
      console.log(`  Current model: ${colors.yellow(ctx.config.model)}`);
      return;
    }
    ctx.setModel(args.join(' '));
    console.log(colors.green(`  Model set to: ${args.join(' ')}`));
  },
});

commands.set('provider', {
  description: 'Switch LLM provider (mock, anthropic, openai)',
  usage: '/provider <name>',
  handler: (args, ctx) => {
    if (args.length === 0) {
      console.log(`  Current provider: ${colors.yellow(ctx.config.provider)}`);
      return;
    }
    const name = args[0]!.toLowerCase();
    ctx.setProvider(name);
    console.log(colors.green(`  Provider set to: ${name}`));
    console.log(colors.dim('  (will take effect on next message)'));
  },
});

commands.set('tools', {
  description: 'List registered tools',
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

commands.set('history', {
  description: 'Show conversation history (last N turns)',
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

commands.set('reset', {
  description: 'Clear conversation context',
  usage: '/reset',
  handler: (_args, ctx) => {
    ctx.runtime.reset();
    console.log(colors.green('  Conversation reset.'));
  },
});

commands.set('config', {
  description: 'Show current config',
  usage: '/config',
  handler: (_args, ctx) => {
    console.log(colors.dim('\n  Current config:'));
    console.log(`  ${colors.bold('Provider:')}    ${ctx.config.provider}`);
    console.log(`  ${colors.bold('Model:')}       ${ctx.config.model}`);
    console.log(`  ${colors.bold('Max tokens:')}  ${ctx.config.maxTokens}`);
    console.log(`  ${colors.bold('Temp:')}        ${ctx.config.temperature}`);
    console.log(
      `  ${colors.bold('API Keys:')}   anthropic=${ctx.config.apiKeys.anthropic ? '✓' : '✗'} openai=${ctx.config.apiKeys.openai ? '✓' : '✗'}`,
    );
    console.log(
      `  ${colors.bold('MCP servers:')} ${ctx.config.mcpServers.length}`,
    );
    console.log();
  },
});

commands.set('debug', {
  description: 'Toggle debug mode',
  usage: '/debug',
  handler: () => {
    console.log(colors.yellow('  Debug mode not yet implemented.'));
  },
});

export function getCommand(name: string): Command | undefined {
  return commands.get(name);
}

export function getAllCommands(): Map<string, Command> {
  return commands;
}
