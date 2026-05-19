import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { resolve } from 'path';
import { ConfigSchema, type ValidatedConfig } from './schema';
import { defaultConfig } from './defaults';
import type { Config } from '../types';

function loadJsonFile(path: string): Partial<Config> | null {
  try {
    if (!existsSync(path)) return null;
    const raw = readFileSync(path, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function envOverrides(): Partial<Config> {
  const overrides: Partial<Config> = {};
  const apiKeys: Partial<Config['apiKeys']> = {};

  if (process.env.ANTHROPIC_API_KEY) apiKeys.anthropic = process.env.ANTHROPIC_API_KEY;
  if (process.env.OPENAI_API_KEY) apiKeys.openai = process.env.OPENAI_API_KEY;
  if (process.env.TAVILY_API_KEY) apiKeys.tavily = process.env.TAVILY_API_KEY;
  if (Object.keys(apiKeys).length > 0) overrides.apiKeys = apiKeys as Config['apiKeys'];

  if (process.env.AI_AGENT_PROVIDER) overrides.provider = process.env.AI_AGENT_PROVIDER;
  if (process.env.AI_AGENT_MODEL) overrides.model = process.env.AI_AGENT_MODEL;

  return overrides;
}

export function loadConfig(customPath?: string): Config {
  const searchPaths = [
    customPath,
    resolve(process.cwd(), 'ai-agent.config.json'),
    resolve(homedir(), '.ai-agent', 'config.json'),
  ].filter(Boolean) as string[];

  let fileConfig: Partial<Config> = {};

  for (const p of searchPaths) {
    const loaded = loadJsonFile(p);
    if (loaded) {
      fileConfig = loaded;
      break;
    }
  }

  const merged = {
    ...defaultConfig,
    ...fileConfig,
  };

  const env = envOverrides();
  const final = {
    ...merged,
    ...env,
    apiKeys: {
      ...merged.apiKeys,
      ...(env.apiKeys || {}),
    },
  };

  const parsed = ConfigSchema.safeParse(final);
  if (!parsed.success) {
    console.error('Config validation errors:');
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    return defaultConfig as Config;
  }

  return parsed.data as Config;
}
