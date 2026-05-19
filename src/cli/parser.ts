/**
 * 输入解析器
 *
 * 负责将用户的文本输入分类为不同的类型：
 * - /command: 以斜杠开头的内建命令
 * - """ 或 ''' 包裹的多行文本块
 * - 普通消息
 * - 空输入
 */

/**
 * 解析后的输入类型
 * - command: 内建命令（以 / 开头）
 * - message: 普通文本消息
 * - multiline: 多行文本块（以 """ 或 ''' 包裹）
 * - empty: 空输入
 */
export type ParsedInput =
  | { type: 'command'; command: string; args: string[] }
  | { type: 'message'; text: string }
  | { type: 'multiline'; text: string }
  | { type: 'empty' };

/**
 * 解析用户输入文本
 *
 * 逻辑优先级：
 * 1. 空输入 → empty
 * 2. 以 / 开头 → command（提取命令名和参数）
 * 3. 以 """ 或 ''' 开头 → multiline（支持可选闭合标记）
 * 4. 其他 → message
 *
 * @param input - 用户输入的原始文本
 * @returns 解析后的结构化输入
 */
export function parseInput(input: string): ParsedInput {
  const trimmed = input.trim();

  if (!trimmed) {
    return { type: 'empty' };
  }

  // 检测命令模式：以 / 开头的输入
  if (trimmed.startsWith('/')) {
    const parts = trimmed.slice(1).split(/\s+/);
    const command = parts[0]?.toLowerCase() ?? '';
    const args = parts.slice(1);
    return { type: 'command', command, args };
  }

  // 检测多行模式：以 """ 或 ''' 开头
  if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
    const delimiter = trimmed[0]!; // 判断使用的定界符类型
    const content = trimmed.slice(3);
    // 如果最后一行是闭合标记，则将其移除
    const lines = content.split('\n');
    if (lines.length > 1 && lines[lines.length - 1]?.trim() === delimiter.repeat(3)) {
      lines.pop();
    }
    return { type: 'multiline', text: lines.join('\n').trim() };
  }

  // 默认：普通文本消息
  return { type: 'message', text: trimmed };
}
