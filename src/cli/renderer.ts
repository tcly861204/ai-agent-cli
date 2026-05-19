import type { AgentEvent } from '../types/agent';

export const colors = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  magenta: (s: string) => `\x1b[35m${s}\x1b[0m`,
};

export function renderEvent(event: AgentEvent, showToolOutput: boolean): void {
  switch (event.type) {
    case 'text_delta':
      process.stdout.write(event.delta);
      break;

    case 'text':
      console.log(); // newline after stream
      console.log(colors.dim('─── Response ───'));
      console.log(event.content);
      console.log(colors.dim('────────────────'));
      break;

    case 'tool_start':
      console.log(colors.cyan(`  ⚙  ${event.name}...`));
      break;

    case 'tool_end': {
      const duration = event.result.metadata?.durationMs;
      const timeStr = duration ? ` (${duration}ms)` : '';
      if (event.result.success) {
        console.log(colors.green(`  ✓ ${event.name}${timeStr}`));
        if (showToolOutput && event.result.output) {
          const preview = event.result.output.slice(0, 300);
          const lines = preview.split('\n').slice(0, 5);
          for (const line of lines) {
            console.log(colors.dim(`    ${line}`));
          }
          if (event.result.output.length > 300) {
            console.log(colors.dim(`    ... (${event.result.output.length} chars total)`));
          }
        }
      } else {
        console.log(colors.red(`  ✗ ${event.name}${timeStr}: ${event.result.error}`));
      }
      break;
    }

    case 'error':
      console.error(colors.red(`\n  ✗ Error: ${event.message}`));
      break;

    case 'done':
      break;
  }
}

export function renderWelcome(): void {
  console.log();
  console.log(colors.bold(colors.cyan('  ╭──────────────────────────────╮')));
  console.log(colors.bold(colors.cyan('  │      AI Agent CLI v0.1       │')));
  console.log(colors.bold(colors.cyan('  ╰──────────────────────────────╯')));
  console.log();
  console.log(colors.dim('  Type your message or use /help for commands'));
  console.log();
}

export function renderPrompt(providerName: string): string {
  return colors.green(`\n  ${providerName} > `);
}
