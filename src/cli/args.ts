/**
 * CLI 参数解析器
 *
 * 解析进程启动参数（process.argv），支持标准 GNU 风格选项：
 *   --flag, --flag=value, --flag value, -f, -f value
 *   位置参数作为查询文本传递给 LLM
 *   -- 终止选项解析
 */

export interface CliArgs {
  /** 显示帮助信息 */
  help: boolean;
  /** 显示版本号 */
  version: boolean;
  /** LLM 提供商名称 */
  provider?: string;
  /** 模型名称 */
  model?: string;
  /** 配置文件路径 */
  config?: string;
  /** 显式指定的查询文本（--query 或 -q） */
  query?: string;
  /** 位置参数（视为查询文本） */
  positional: string[];
}

const VERSION = '0.1.0';

function printHelp(): void {
  console.log(`
  ai-agent-cli — 可扩展的 AI 代理命令行工具

  ${'用法:'.padEnd(24)} ai-agent-cli [选项...] [查询文本...]

  ${'选项:'.padEnd(24)}
  ${'  -h, --help'.padEnd(24)} 显示此帮助信息
  ${'  -v, --version'.padEnd(24)} 显示版本号
  ${'  -p, --provider <name>'.padEnd(24)} LLM 提供商 (deepseek, openai, anthropic)
  ${'  -m, --model <name>'.padEnd(24)} 模型名称
  ${'  -c, --config <path>'.padEnd(24)} 配置文件路径
  ${'  -q, --query <text>'.padEnd(24)} 执行一次性查询

  ${'示例:'.padEnd(24)}
    ai-agent-cli                       启动交互式 REPL
    ai-agent-cli "你好"                一次性查询
    ai-agent-cli -p deepseek "Hello"   使用 DeepSeek 模型
    ai-agent-cli -c ./config.json      指定配置文件
    ai-agent-cli --query "你好" -p deepseek 显式指定查询

  ${'REPL 内命令:'.padEnd(24)}
    在交互模式下输入 /help 查看可用命令
`);
}

function printVersion(): void {
  console.log(`ai-agent-cli v${VERSION}`);
}

/**
 * 解析进程命令行参数
 *
 * @param argv - 参数数组（不含 node/bun 和脚本路径），通常为 process.argv.slice(2)
 * @returns 结构化解析结果
 */
export function parseArgs(argv: string[]): CliArgs {
  const result: CliArgs = {
    help: false,
    version: false,
    positional: [],
  };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i]!;

    // -- 结束选项解析
    if (arg === '--') {
      // 剩余参数全部视为位置参数
      for (let j = i + 1; j < argv.length; j++) {
        result.positional.push(argv[j]!);
      }
      break;
    }

    // 长选项
    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=');
      const name = eqIdx >= 0 ? arg.slice(2, eqIdx) : arg.slice(2);
      const hasValue = eqIdx >= 0;

      switch (name) {
        case 'help':
          result.help = true;
          break;
        case 'version':
          result.version = true;
          break;
        case 'provider':
        case 'model':
        case 'config':
        case 'query':
          if (hasValue) {
            result[name] = arg.slice(eqIdx + 1);
          } else if (i + 1 < argv.length && !argv[i + 1]!.startsWith('-')) {
            result[name] = argv[++i]!;
          }
          break;
        default:
          // 未知长选项，忽略
          break;
      }
      i++;
      continue;
    }

    // 短选项
    if (arg.startsWith('-') && arg.length > 1) {
      const flag = arg.slice(1);

      switch (flag) {
        case 'h':
          result.help = true;
          break;
        case 'v':
          result.version = true;
          break;
        case 'p':
          if (i + 1 < argv.length && !argv[i + 1]!.startsWith('-')) {
            result.provider = argv[++i]!;
          }
          break;
        case 'm':
          if (i + 1 < argv.length && !argv[i + 1]!.startsWith('-')) {
            result.model = argv[++i]!;
          }
          break;
        case 'c':
          if (i + 1 < argv.length && !argv[i + 1]!.startsWith('-')) {
            result.config = argv[++i]!;
          }
          break;
        case 'q':
          if (i + 1 < argv.length && !argv[i + 1]!.startsWith('-')) {
            result.query = argv[++i]!;
          }
          break;
        default:
          // 未知短选项，忽略
          break;
      }
      i++;
      continue;
    }

    // 位置参数（不以 - 开头）
    result.positional.push(arg);
    i++;
  }

  return result;
}

export { VERSION, printHelp, printVersion };
