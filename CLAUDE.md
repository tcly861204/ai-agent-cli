# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `bun install` — install dependencies
- `bun run src/index.ts` — start interactive REPL
- `bun run src/index.ts <query>` — one-shot mode (process args, then exit)
- No test runner, linter, or build step configured yet (TypeScript runs directly via Bun with `noEmit`)

## Architecture Overview

This is an extensible AI agent CLI built on **Bun + TypeScript** with a plugin-like LLM provider system and tool-calling architecture.

### Layered Architecture

```
src/
├── index.ts          — Entry point: config → provider → tools → runtime → REPL
├── config/           — Configuration loading (file + env vars), validation (Zod), defaults
├── llm/              — LLM provider interface + factory + implementations
├── agent/            — Core reasoning loop (AgentRuntime) + context management
├── tool/             — Tool registry + built-in tool implementations
├── cli/              — REPL loop, input parser, ANSI renderer, spinner, commands
└── types/            — Shared TypeScript type definitions (re-exported via index.ts)
```

### Key Patterns

**LLM Provider (Strategy Pattern):** `LLMProvider` interface in `src/llm/provider.ts` defines `generate()` (non-streaming) and `generateStream()` (async iterable). Three implementations:
- `MockProvider` — echo-back stub for Phase 1 dev (no API key needed)
- `AnthropicProvider` — stub (Phase 2, not yet implemented)
- `OpenAIProvider` — stub (Phase 3, not yet implemented)

Factory (`src/llm/factory.ts`) creates the right provider from config. Missing API keys auto-downgrade to mock.

**Agent Runtime (`src/agent/runtime.ts`):** The core inference loop:
1. Appends user message to history
2. Calls LLM (streaming first, falls back to non-streaming)
3. If LLM requests a tool → executes via ToolRegistry → appends result as tool message → loops back to LLM (max 10 rounds)
4. Emits `AgentEvent` via `AsyncGenerator` for the CLI renderer

**Tool System (`src/tool/registry.ts`):** Tools are registered by name (Map). Each tool has a `ToolDefinition` with name, description, JSON Schema parameters, and an async `execute()` function. Built-in tools: `think`, `read_file`, `write_file`.

**Context Manager (`src/agent/context.ts`):** Rough token estimation (1 token ≈ 4 chars) with FIFO eviction when approaching the 128K context window limit. System messages are never evicted.

**CLI Layer:**
- `repl.ts` — TTY interactive mode (readline + history persistence) and piped stdin mode
- `parser.ts` — `/command` detection, `"""` multiline blocks
- `commands.ts` — `/help`, `/exit`, `/model`, `/provider`, `/tools`, `/reset`, `/config`, `/history`, `/clear`, `/debug`
- `renderer.ts` — ANSI color helpers + event-to-terminal rendering
- `spinner.ts` — Braille character spinner animation

### Data Flow

```
User Input → parseInput() → AgentRuntime.run() → LLMProvider.generateStream()
  → StreamChunk events → AgentRuntime parses chunks, executes tools
  → AgentEvent stream → renderEvent() → terminal output
```

### Configuration

Priority: **env vars > config file > defaults**. Config files are loaded from (1) custom path, (2) `./ai-agent.config.json`, (3) `~/.ai-agent/config.json`. Env vars `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `AI_AGENT_PROVIDER`, `AI_AGENT_MODEL` override file values. Validated with Zod (`src/config/schema.ts`).

### Development Phases

- **Phase 1 (current):** Mock provider + REPL + tool system — all functional
- **Phase 2:** Implement `AnthropicProvider` with streaming + tool support + prompt caching
- **Phase 3:** Implement `OpenAIProvider` with streaming + function calling
