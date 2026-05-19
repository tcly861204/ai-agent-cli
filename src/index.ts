#!/usr/bin/env bun

import { loadConfig } from './config/loader';
import { createProvider } from './llm/factory';
import { ToolRegistry } from './tool/registry';
import { AgentRuntime } from './agent/runtime';
import { startRepl } from './cli/repl';
import { thinkTool } from './tool/builtins/think';
import type { Config } from './types/config';

async function main() {
  const config: Config = loadConfig();

  // If no API key for the configured provider, fall back to mock
  const needsKey = config.provider === 'anthropic' ? 'anthropic' : 'openai';
  if (!config.apiKeys[needsKey]) {
    config.provider = 'mock';
  }

  const provider = createProvider(config);

  const tools = new ToolRegistry();
  registerDefaultTools(tools);

  const runtime = new AgentRuntime({ provider, tools, config });

  const setProvider = (name: string) => {
    config.provider = name;
  };
  const setModel = (model: string) => {
    config.model = model;
  };

  // Check CLI args for one-shot mode
  const args = process.argv.slice(2);
  if (args.length > 0) {
    const text = args.join(' ');
    console.log(`  ${text}\n`);
    for await (const event of runtime.run(text)) {
      if (event.type === 'text') {
        console.log(event.content);
      }
    }
    process.exit(0);
  }

  // Launch REPL
  await startRepl({ runtime, tools, config, setProvider, setModel });
}

function registerDefaultTools(tools: ToolRegistry): void {
  tools.register(thinkTool);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
