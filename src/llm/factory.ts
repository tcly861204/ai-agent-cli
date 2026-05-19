import type { LLMProvider } from './provider';
import type { Config } from '../types/config';
import { AnthropicProvider } from './anthropic';
import { OpenAIProvider } from './openai';
import { MockProvider } from './mock';

export function createProvider(config: Config): LLMProvider {
  switch (config.provider) {
    case 'mock':
      return new MockProvider();
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'openai':
      return new OpenAIProvider(config);
    default:
      return new MockProvider();
  }
}
