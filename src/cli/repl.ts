import * as readline from 'node:readline';
import { stdin as readStdin } from 'node:process';
import type { AgentRuntime } from '../agent/runtime';
import type { ToolRegistry } from '../tool/registry';
import type { Config } from '../types/config';
import { parseInput } from './parser';
import { getCommand, type CommandContext } from './commands';
import { renderEvent, renderWelcome, renderPrompt, colors } from './renderer';
import { Spinner } from './spinner';

export interface ReplDependencies {
  runtime: AgentRuntime;
  tools: ToolRegistry;
  config: Config;
  setProvider: (name: string) => void;
  setModel: (model: string) => void;
}

export async function startRepl(deps: ReplDependencies): Promise<void> {
  const { runtime, tools, config, setProvider, setModel } = deps;

  // Non-TTY (piped) mode: read all input, process sequentially, exit
  if (!process.stdin.isTTY) {
    await runPipedMode(deps);
    return;
  }

  // TTY mode: interactive REPL
  await runInteractiveMode(deps);
}

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

async function runInteractiveMode(deps: ReplDependencies): Promise<void> {
  const { runtime, tools, config, setProvider, setModel } = deps;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: renderPrompt(config.provider),
    historySize: 100,
  });

  // Persist history to file
  const fs = await import('node:fs');
  const path = await import('node:path');
  const historyDir = path.join(require('os').homedir(), '.ai-agent');
  const historyFile = path.join(historyDir, 'history');

  try {
    if (!fs.existsSync(historyDir)) {
      fs.mkdirSync(historyDir, { recursive: true });
    }
    if (fs.existsSync(historyFile)) {
      const lines = fs.readFileSync(historyFile, 'utf-8').split('\n').filter(Boolean);
      const prev = (rl as any)._previousValues;
      if (prev && Array.isArray(prev)) {
        prev.push(...lines.slice(-100));
      }
    }
  } catch {
    // best-effort
  }

  function saveHistory(input: string) {
    try {
      fs.appendFileSync(historyFile, input + '\n', 'utf-8');
    } catch {
      // best-effort
    }
  }

  let running = false;
  let abortController = new AbortController();

  const cmdCtx: CommandContext = {
    runtime,
    tools,
    config,
    setProvider,
    setModel,
    exit: () => rl.close(),
  };

  renderWelcome();
  rl.prompt();

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

        try {
          for await (const event of runtime.run(parsed.text, abortController.signal)) {
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

  rl.on('SIGINT', () => {
    if (running) {
      abortController.abort();
      console.log(colors.yellow('\n  Aborting...'));
    } else {
      rl.question(colors.dim('\n  Exit? (y/N) '), (answer: string) => {
        if (answer.toLowerCase() === 'y') {
          rl.close();
        } else {
          rl.prompt();
        }
      });
    }
  });

  rl.on('close', () => {
    console.log(colors.dim('\n  Goodbye!\n'));
    process.exit(0);
  });
}
