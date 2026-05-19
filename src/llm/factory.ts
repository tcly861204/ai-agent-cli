import type { LLMProvider } from './provider';
import type { Config } from '../types/config';
import { AnthropicProvider } from './anthropic';
import { OpenAIProvider } from './openai';
import { MockProvider } from './mock';

/**
 * LLM 提供商工厂函数
 *
 * 根据配置中的 provider 字段动态创建对应的 LLM 提供商实例。
 * 目前实现了三个提供商：
 * - mock: 模拟响应，用于开发和测试阶段（Phase 1）
 * - anthropic: Anthropic Claude API（Phase 2，待实现）
 * - openai: OpenAI API（Phase 3，待实现）
 *
 * @param config - 应用配置，包含 provider 字段
 * @returns LLMProvider 实例
 */
export function createProvider(config: Config): LLMProvider {
  switch (config.provider) {
    case 'mock':
      return new MockProvider();
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'openai':
      return new OpenAIProvider(config);
    default:
      // 未知提供商默认降级到 mock
      return new MockProvider();
  }
}
