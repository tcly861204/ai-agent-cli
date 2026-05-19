import type { AgentMessage } from '../types/agent';
import type { ToolDefinition } from '../types/tool';

const TOKEN_ESTIMATE_RATIO = 0.25; // rough: 1 token ≈ 4 chars
const SAFETY_MARGIN = 1000; // keep 1k tokens of headroom

export class ContextManager {
  private maxTokens: number;

  constructor(maxTokens: number = 128_000) {
    this.maxTokens = maxTokens;
  }

  setMaxTokens(n: number): void {
    this.maxTokens = n;
  }

  /** Estimate token count from a string */
  estimateTokens(text: string): number {
    return Math.ceil(text.length * TOKEN_ESTIMATE_RATIO);
  }

  /** Estimate total tokens in a message list */
  estimateTotal(messages: AgentMessage[], tools?: ToolDefinition[]): number {
    let total = 0;
    for (const m of messages) {
      if (typeof m.content === 'string') {
        total += this.estimateTokens(m.content);
      } else {
        for (const block of m.content) {
          if (block.type === 'text') total += this.estimateTokens(block.text);
          if (block.type === 'tool_use' || block.type === 'tool_result') {
            total += this.estimateTokens(JSON.stringify(block));
          }
        }
      }
    }
    if (tools) {
      for (const t of tools) {
        total += this.estimateTokens(t.name + t.description + JSON.stringify(t.parameters));
      }
    }
    return total;
  }

  /** Prune old messages to stay within budget */
  prune(messages: AgentMessage[], tools?: ToolDefinition[]): AgentMessage[] {
    const budget = this.maxTokens - SAFETY_MARGIN;
    while (messages.length > 2 && this.estimateTotal(messages, tools) > budget) {
      // Remove the oldest non-system message
      const idx = messages.findIndex((m) => m.role !== 'system');
      if (idx === -1) break;
      messages.splice(idx, 1);
    }
    return messages;
  }
}
