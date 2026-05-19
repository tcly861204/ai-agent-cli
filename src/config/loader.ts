import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { resolve } from 'path';
import { ConfigSchema, type ValidatedConfig } from './schema';
import { defaultConfig } from './defaults';
import type { Config } from '../types';

/**
 * 尝试从指定路径加载 JSON 配置文件
 * 如果文件不存在或解析失败，返回 null 而非抛出异常
 * @param path - 配置文件路径
 */
function loadJsonFile(path: string): Partial<Config> | null {
  try {
    if (!existsSync(path)) return null;
    const raw = readFileSync(path, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null; // 文件不存在或 JSON 格式错误时静默失败
  }
}

/**
 * 从环境变量读取配置覆盖
 * 支持通过环境变量设置 API 密钥、提供商和模型
 * 环境变量优先级高于配置文件
 */
function envOverrides(): Partial<Config> {
  const overrides: Partial<Config> = {};
  const apiKeys: Partial<Config['apiKeys']> = {};

  // 读取各 API 密钥环境变量
  if (process.env.ANTHROPIC_API_KEY) apiKeys.anthropic = process.env.ANTHROPIC_API_KEY;
  if (process.env.OPENAI_API_KEY) apiKeys.openai = process.env.OPENAI_API_KEY;
  if (process.env.TAVILY_API_KEY) apiKeys.tavily = process.env.TAVILY_API_KEY;
  if (Object.keys(apiKeys).length > 0) overrides.apiKeys = apiKeys as Config['apiKeys'];

  // AI Agent 专属配置
  if (process.env.AI_AGENT_PROVIDER) overrides.provider = process.env.AI_AGENT_PROVIDER;
  if (process.env.AI_AGENT_MODEL) overrides.model = process.env.AI_AGENT_MODEL;

  return overrides;
}

/**
 * 加载配置的主函数
 *
 * 配置优先级（后加载的覆盖先加载的）：
 * 1. 默认配置（defaultConfig）
 * 2. 配置文件（自定义路径 → 工作目录 → 用户主目录）
 * 3. 环境变量覆盖
 *
 * @param customPath - 可选的配置文件自定义路径
 * @returns 合并并校验后的最终配置对象
 */
export function loadConfig(customPath?: string): Config {
  // 配置搜索路径优先级：自定义路径 > 当前工作目录 > 用户主目录
  const searchPaths = [
    customPath,
    resolve(process.cwd(), 'ai-agent.config.json'),
    resolve(homedir(), '.ai-agent', 'config.json'),
  ].filter(Boolean) as string[];

  let fileConfig: Partial<Config> = {};

  // 遍历搜索路径，使用第一个成功加载的配置
  for (const p of searchPaths) {
    const loaded = loadJsonFile(p);
    if (loaded) {
      fileConfig = loaded;
      break;
    }
  }

  // 合并默认配置和文件配置
  const merged = {
    ...defaultConfig,
    ...fileConfig,
  };

  // 应用环境变量覆盖
  const env = envOverrides();
  const final = {
    ...merged,
    ...env,
    apiKeys: {
      ...merged.apiKeys,
      ...(env.apiKeys || {}),
    },
  };

  // 使用 zod schema 校验最终配置
  const parsed = ConfigSchema.safeParse(final);
  if (!parsed.success) {
    // 配置校验失败时打印详细的错误信息
    console.error('Config validation errors:');
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    // 校验失败时回退到默认配置，确保程序可以启动
    return defaultConfig as Config;
  }

  return parsed.data as Config;
}
