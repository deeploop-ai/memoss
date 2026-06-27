import { Box, Text } from 'ink';
import type { LogEntry } from '../types.js';

const ROLE_COLORS: Record<LogEntry['role'], string> = {
  user: 'green',
  assistant: 'white',
  system: 'cyan',
  stream: 'gray',
  error: 'red',
};

const ROLE_LABELS: Record<LogEntry['role'], string> = {
  user: 'you',
  assistant: 'memoss',
  system: '·',
  stream: '···',
  error: '!',
};

function truncate(text: string, max = 4000): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max)}…`;
}

export function LogLine({ entry }: { entry: LogEntry }) {
  const color = ROLE_COLORS[entry.role];
  const label = ROLE_LABELS[entry.role];
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={color} bold={entry.role === 'user'}>
        {label}
        {entry.task ? ` (${entry.task})` : ''}
      </Text>
      <Text wrap="wrap">{truncate(entry.content)}</Text>
    </Box>
  );
}

export function Transcript({ entries }: { entries: LogEntry[] }) {
  const visible = entries.slice(-40);
  return (
    <Box flexDirection="column" flexGrow={1}>
      {visible.map((entry) => (
        <LogLine key={entry.id} entry={entry} />
      ))}
    </Box>
  );
}
