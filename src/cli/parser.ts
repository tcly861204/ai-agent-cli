export type ParsedInput =
  | { type: 'command'; command: string; args: string[] }
  | { type: 'message'; text: string }
  | { type: 'multiline'; text: string }
  | { type: 'empty' };

export function parseInput(input: string): ParsedInput {
  const trimmed = input.trim();

  if (!trimmed) {
    return { type: 'empty' };
  }

  if (trimmed.startsWith('/')) {
    const parts = trimmed.slice(1).split(/\s+/);
    const command = parts[0]?.toLowerCase() ?? '';
    const args = parts.slice(1);
    return { type: 'command', command, args };
  }

  if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
    const delimiter = trimmed[0]!;
    const content = trimmed.slice(3);
    // If the closing delimiter is on the last line, strip it
    const lines = content.split('\n');
    if (lines.length > 1 && lines[lines.length - 1]?.trim() === delimiter.repeat(3)) {
      lines.pop();
    }
    return { type: 'multiline', text: lines.join('\n').trim() };
  }

  return { type: 'message', text: trimmed };
}
