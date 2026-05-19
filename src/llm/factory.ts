import type { LLMProvider } from './provider';
import type { Config } from '../types/config';
import { AnthropicProvider } from './anthropic';
import { OpenAICompatibleProvider } from './openai-compatible';

/**
 * LLM 提供商工厂函数
 *
 * 根据配置中的 provider 字段动态创建对应的 LLM 提供商实例。
 *
 * 支持的提供商：
 * - deepseek:        DeepSeek API（OpenAI 兼容协议）
 * - openai:          OpenAI API（OpenAI 兼容协议）
 * - anthropic:       Anthropic Claude API（待实现）
 *
 * 所有使用 OpenAI Chat Completions 格式的提供商共享同一个
 * OpenAICompatibleProvider 类，仅通过 apiBase 区分端点。
 *
 * @param config - 应用配置，包含 provider 字段
 * @returns LLMProvider 实例
 */
export function createProvider(config: Config): LLMProvider {
  switch (config.provider) {
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'openai':
      return new OpenAICompatibleProvider({
        name: 'openai',
        apiBase: config.apiBase ?? 'https://api.openai.com/v1',
        model: config.model || 'gpt-4o',
        apiKey: config.apiKeys?.openai ?? process.env.OPENAI_API_KEY ?? '',
        maxTokens: config.maxTokens,
        temperature: config.temperature,
      });
    case 'deepseek':
      return new OpenAICompatibleProvider({
        name: 'deepseek',
        apiBase: config.apiBase ?? 'https://api.deepseek.com/v1',
        model: config.model || 'deepseek-chat',
        apiKey: config.apiKeys?.deepseek ?? process.env.DEEPSEEK_API_KEY ?? '',
        maxTokens: config.maxTokens,
        temperature: config.temperature,
      });
    default:
      throw new Error(`Unknown provider: "${config.provider}". Supported: deepseek, openai, anthropic`);
  }
}
