#!/usr/bin/env bun

/**
 * AI Agent CLI - 主入口
 *
 * 一个可扩展的 AI 代理命令行工具，支持多种 LLM 提供商（Anthropic Claude、OpenAI）
 * 和工具调用系统。当前处于 Phase 1 开发阶段，使用 MockProvider 模拟 LLM 响应。
 *
 * 启动流程：
 * 1. 加载配置（配置文件 + 环境变量）
 * 2. 检查 API 密钥，缺失时自动降级到 mock 模式
 * 3. 创建 LLM 提供商实例
 * 4. 注册内建工具（如 think）
 * 5. 实例化 AgentRuntime
 * 6. 根据命令行参数选择一次性模式或交互式 REPL
 *
 * 开发阶段：
 * - Phase 1: Mock 模式 + REPL + 代理循环（当前）
 * - Phase 2: Anthropic Claude API 集成
 * - Phase 3: OpenAI API 集成
 */

import { loadConfig } from './config/loader';
import { createProvider } from './llm/factory';
import { ToolRegistry } from './tool/registry';
import { AgentRuntime } from './agent/runtime';
import { startRepl } from './cli/repl';
import { thinkTool } from './tool/builtins/think';
import { readFileTool } from './tool/builtins/readFile';
import { writeFileTool } from './tool/builtins/writeFile';
import type { Config } from './types/config';

/**
 * 主函数
 * 初始化所有组件并启动 REPL
 */
async function main() {
  const config: Config = loadConfig();

  // 检查已配置的提供商是否有对应的 API 密钥
  // 如果没有，自动降级到 mock 提供商的模拟模式
  const needsKey = config.provider === 'anthropic' ? 'anthropic' : 'openai';
  if (!config.apiKeys[needsKey]) {
    config.provider = 'mock';
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

  // ---- 一次性模式 ----
  // 如果提供了命令行参数，则执行一次性对话后退出
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

  // ---- 交互式 REPL 模式 ----
  // 默认模式：启动交互式命令行界面
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
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
