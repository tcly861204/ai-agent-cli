# 🚀 ai-agent-cli

一个可扩展的 AI 代理命令行工具，支持多种 LLM 提供商（DeepSeek、Anthropic Claude、OpenAI）和工具调用系统。

## 开发阶段

| 阶段 | 状态 | 说明 |
|------|------|------|
| Phase 1 | ✅ 完成 | REPL 交互界面 + 工具系统 |
| Phase DS | ✅ 完成 | DeepSeek API 集成（OpenAI 兼容接口） |
| Phase 2 | ⏳ 待实现 | Anthropic Claude API 集成 |
| Phase 3 | ⏳ 待实现 | OpenAI API 集成 |

## 快速开始

```bash
# 安装依赖
bun install

# 启动交互式 REPL（默认）
bun run src/index.ts

# 一次性查询
bun run src/index.ts <你的问题>

# 使用 CLI 标志（所有标志支持 --长格式 和 -短格式）
bun run src/index.ts --help
bun run src/index.ts --version
bun run src/index.ts --provider deepseek "你好"
bun run src/index.ts -p deepseek -m deepseek-chat
bun run src/index.ts --config ./my-config.json
bun run src/index.ts --query "你的问题" -p deepseek
```

使用前需通过配置文件或环境变量设置对应提供商的 API 密钥。

### CLI 选项

| 选项 | 说明 |
|------|------|
| `-h, --help` | 显示帮助信息 |
| `-v, --version` | 显示版本号 |
| `-p, --provider <name>` | 设置 LLM 提供商（deepseek / anthropic / openai） |
| `-m, --model <name>` | 设置模型名称 |
| `-c, --config <path>` | 指定配置文件路径 |
| `-q, --query <text>` | 执行一次性查询（替代位置参数） |

无参数时自动进入交互式 REPL 模式。

## 配置

配置优先级：**环境变量 > 配置文件 > 默认值**

### 配置文件

支持两个位置，按优先级查找：

- `./ai-agent.config.json`（当前工作目录）
- `~/.ai-agent/config.json`（用户目录）

```json
{
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "systemPrompt": "You are a helpful AI assistant.",
  "maxTokens": 4096,
  "temperature": 0.7
}
```

### 环境变量

| 变量 | 说明 |
|------|------|
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 |
| `ANTHROPIC_API_KEY` | Anthropic API 密钥 |
| `OPENAI_API_KEY` | OpenAI API 密钥 |
| `TAVILY_API_KEY` | Tavily 搜索 API 密钥 |
| `AI_AGENT_PROVIDER` | 覆盖配置中的提供商 |
| `AI_AGENT_MODEL` | 覆盖配置中的模型 |
| `AI_AGENT_API_BASE` | 覆盖 API 端点（仅 OpenAI 兼容协议） |

## REPL 命令

输入 `/help` 查看所有可用命令：

| 命令 | 说明 |
|------|------|
| `/help [command]` | 显示帮助信息 |
| `/exit` / `/quit` | 退出 REPL |
| `/clear` | 清屏 |
| `/model <name>` | 切换模型 |
| `/provider <name>` | 切换提供商（deepseek / anthropic / openai） |
| `/tools` | 列出已注册的工具 |
| `/history [count]` | 查看对话历史 |
| `/reset` | 清空当前对话 |
| `/config` | 查看当前配置 |
| `/debug` | 切换调试模式 |

## 内建工具

| 工具 | 说明 |
|------|------|
| `think` | 分步推理，帮助 LLM 梳理复杂问题的思路 |
| `read_file` | 读取指定路径的文本文件（最大 1MB，支持行数限制预览） |
| `write_file` | 将文本写入指定路径（自动创建父目录，默认防覆盖） |
| `shell` | 执行 Shell 命令（支持超时和工作目录配置） |

更多工具将在后续阶段添加。

## 项目结构

```
src/
├── index.ts              # 入口：初始化 + REPL 启动
├── agent/
│   ├── runtime.ts        # 核心推理循环（流式/非流式 + 工具调用）
│   └── context.ts        # Token 估算与上下文修剪
├── cli/
│   ├── repl.ts           # REPL 主循环（TTY/管道双模式）
│   ├── commands.ts       # 内建命令注册
│   ├── parser.ts         # 输入解析
│   ├── renderer.ts       # ANSI 终端渲染
│   └── spinner.ts        # 等待动画
├── config/
│   ├── defaults.ts       # 默认配置
│   ├── schema.ts         # Zod 校验
│   └── loader.ts         # 配置加载（文件 + 环境变量）
├── llm/
│   ├── provider.ts              # LLM 提供商接口
│   ├── factory.ts               # 提供商工厂
│   ├── openai-compatible.ts     # OpenAI 兼容协议（通用）
│   ├── anthropic.ts             # Anthropic 实现
│   ├── openai.ts                # OpenAI 实现（继承 openai-compatible）
│   ├── deepseek.ts              # DeepSeek 实现（继承 openai-compatible）
├── tool/
│   ├── registry.ts       # 工具注册表
│   ├── builtins/         # 内建工具
│   │   ├── think.ts
│   │   ├── readFile.ts
│   │   ├── writeFile.ts
│   │   └── shell.ts
│   └── mcp/              # MCP 协议工具（预留）
└── types/
    ├── index.ts
    ├── agent.ts
    ├── config.ts
    ├── llm.ts
    └── tool.ts
```

## 技术栈

- **运行时**: [Bun](https://bun.sh)
- **语言**: TypeScript
- **配置校验**: [Zod](https://zod.dev)

## 协议

MIT
