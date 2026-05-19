#!/usr/bin/env bun

/**
 * AI Agent CLI - 主入口
 *
 * 一个可扩展的 AI 代理命令行工具，支持多种 LLM 提供商
 * （DeepSeek、Anthropic Claude、OpenAI）和工具调用系统。
 *
 * 启动流程：
 * 1. 解析命令行参数
 * 2. 加载配置（配置文件 + 环境变量 + CLI 标志）
 * 3. 检查 API 密钥，缺失时报错
 * 4. 创建 LLM 提供商实例
 * 5. 注册内建工具
 * 6. 实例化 AgentRuntime
 * 7. 根据命令行参数选择一次性模式或交互式 REPL
 */

import { loadConfig } from './config/loader';
import { createProvider } from './llm/factory';
import { ToolRegistry } from './tool/registry';
import { AgentRuntime } from './agent/runtime';
import { startRepl } from './cli/repl';
import { thinkTool } from './tool/builtins/think';
import { readFileTool } from './tool/builtins/readFile';
import { writeFileTool } from './tool/builtins/writeFile';
import { shellTool } from './tool/builtins/shell';
import { parseArgs, printHelp, printVersion } from './cli/args';
import type { Config } from './types/config';

/**
 * 主函数
 * 解析参数、初始化组件、启动 REPL 或执行一次性查询
 */
async function main() {
  // ---- 1. 解析命令行参数 ----
  const args = parseArgs(process.argv.slice(2));

  // 优先处理 --help 和 --version
  if (args.help) {
    printHelp();
    process.exit(0);
  }
  if (args.version) {
    printVersion();
    process.exit(0);
  }

  // ---- 2. 加载配置 ----
  const config: Config = loadConfig(args.config);

  // CLI 标志覆盖配置中的 provider / model
  if (args.provider) config.provider = args.provider;
  if (args.model) config.model = args.model;

  // 检查已配置的提供商是否有对应的 API 密钥
  const keyMap: Record<string, keyof typeof config.apiKeys> = {
    anthropic: 'anthropic',
    openai: 'openai',
    deepseek: 'deepseek',
  };
  const needsKey = keyMap[config.provider];
  if (needsKey && !config.apiKeys[needsKey]) {
    const envVar = needsKey === 'anthropic' ? 'ANTHROPIC_API_KEY'
      : needsKey === 'deepseek' ? 'DEEPSEEK_API_KEY'
      : 'OPENAI_API_KEY';
    console.error(`Error: Provider "${config.provider}" requires ${envVar} to be set.`);
    process.exit(1);
  }

  // 创建 LLM 提供商
  const provider = createProvider(config);

  // 初始化工具注册表并注册默认工具
  const tools = new ToolRegistry();
  registerDefaultTools(tools);

  // 创建代理运行时（核心推理循环）
  const runtime = new AgentRuntime({ provider, tools, config });

  // 运行时状态更新函数（供 REPL 命令使用）
  const setProvider = (name: string) => {
    config.provider = name;
  };
  const setModel = (model: string) => {
    config.model = model;
  };

  // ---- 3. 一次性模式 ----
  // 取 --query 或位置参数作为查询文本
  const queryText = args.query ?? args.positional.join(' ');
  if (queryText.length > 0) {
    console.log(`  ${queryText}\n`);
    for await (const event of runtime.run(queryText)) {
      if (event.type === 'text') {
        console.log(event.content);
      }
    }
    process.exit(0);
  }

  // ---- 4. 交互式 REPL 模式 ----
  await startRepl({ runtime, tools, config, setProvider, setModel });
}

/**
 * 注册所有默认内建工具
 * 随着项目发展，可以在此添加更多内建工具
 *
 * @param tools - 工具注册表实例
 */
function registerDefaultTools(tools: ToolRegistry): void {
  tools.register(thinkTool);     // "思考"工具，帮助 LLM 进行分步推理
  tools.register(readFileTool);  // "读取文件"工具
  tools.register(writeFileTool); // "写入文件"工具
  tools.register(shellTool);     // "命令行"工具，执行 Shell 命令
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
