/**
 * 终端渲染器
 *
 * 负责将 AgentEvent 事件渲染为终端中的 ANSI 彩色文本。
 * 提供统一的颜色工具、事件渲染、欢迎横幅和提示符生成。
 */

import type { AgentEvent } from '../types/agent';

/**
 * ANSI 颜色工具函数集
 * 每个函数接受字符串并返回带 ANSI 转义码的彩色版本
 */
export const colors = {
  green:   (s: string) => `\x1b[32m${s}\x1b[0m`,  // 绿色：成功信息
  blue:    (s: string) => `\x1b[34m${s}\x1b[0m`,  // 蓝色
  yellow:  (s: string) => `\x1b[33m${s}\x1b[0m`,  // 黄色：警告/取消
  red:     (s: string) => `\x1b[31m${s}\x1b[0m`,  // 红色：错误信息
  dim:     (s: string) => `\x1b[2m${s}\x1b[0m`,   // 暗淡：次要信息/分割线
  bold:    (s: string) => `\x1b[1m${s}\x1b[0m`,   // 粗体：标题/强调
  cyan:    (s: string) => `\x1b[36m${s}\x1b[0m`,  // 青色：工具名称/品牌色
  magenta: (s: string) => `\x1b[35m${s}\x1b[0m`,  // 品红
};

/**
 * 渲染单个 AgentEvent 到终端
 *
 * 根据事件类型执行不同的渲染逻辑：
 * - text_delta: 流式输出，直接写入 stdout 不换行
 * - text: 完整响应，包裹分割线
 * - tool_start: 显示工具开始执行的指示器
 * - tool_end: 显示工具执行结果（成功/失败、耗时、输出预览）
 * - error: 显示错误信息
 *
 * @param event - 代理事件对象
 * @param showToolOutput - 是否展开显示工具输出内容
 */
export function renderEvent(event: AgentEvent, showToolOutput: boolean): void {
  switch (event.type) {
    case 'text_delta':
      // 流式文本增量：不换行写入，实现逐字打印效果
      process.stdout.write(event.delta);
      break;

    case 'text':
      // 完整文本响应：换行后包裹分割线
      console.log(); // 流结束后先换行
      console.log(colors.dim('─── Response ───'));
      console.log(event.content);
      console.log(colors.dim('────────────────'));
      break;

    case 'tool_start':
      // 内置 think 工具不显示，避免干扰阅读流
      if (event.name === 'think') break;
      // 工具开始执行：显示齿轮图标 + 工具名
      console.log(colors.cyan(`  ⚙  ${event.name}...`));
      break;

    case 'tool_end': {
      // 内置 think 工具不显示
      if (event.name === 'think') break;
      const duration = event.result.metadata?.durationMs;
      const timeStr = duration ? ` (${duration}ms)` : '';
      if (event.result.success) {
        // 工具执行成功：对勾 + 绿色
        console.log(colors.green(`  ✓ ${event.name}${timeStr}`));
        if (showToolOutput && event.result.output) {
          // 显示输出预览：最多 300 字符、5 行
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
        // 工具执行失败：叉号 + 红色 + 错误信息
        console.log(colors.red(`  ✗ ${event.name}${timeStr}: ${event.result.error}`));
      }
      break;
    }

    case 'error':
      // 运行时错误
      console.error(colors.red(`\n  ✗ Error: ${event.message}`));
      break;

    case 'done':
      // 完成事件：无需渲染
      break;
  }
}

/**
 * 渲染欢迎横幅
 * 在 REPL 启动时显示
 */
export function renderWelcome(): void {
  console.log();
  console.log(colors.bold(colors.cyan('  ╭──────────────────────────────╮')));
  console.log(colors.bold(colors.cyan('  │      AI Agent CLI v0.1       │')));
  console.log(colors.bold(colors.cyan('  ╰──────────────────────────────╯')));
  console.log();
  console.log(colors.dim('  Type your message or use /help for commands'));
  console.log();
}

/**
 * 生成提示符字符串
 * @param providerName - 当前 LLM 提供商名称，显示在提示符中
 * @returns 带颜色的提示符字符串
 */
export function renderPrompt(providerName: string): string {
  return colors.green(`\n  ${providerName} > `);
}
