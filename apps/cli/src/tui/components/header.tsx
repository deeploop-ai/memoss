import { Box, Text } from 'ink';
import type { VaultHeader } from '../types.js';

export function Header({
  header,
  restoredTurns,
}: {
  header: VaultHeader;
  restoredTurns?: number;
}) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="magenta">
        Memoss Shell
      </Text>
      <Text dimColor>
        Vault: {header.name} · pages: {header.pageCount} · health:{' '}
        {header.healthScore}/100
      </Text>
      {restoredTurns ? (
        <Text dimColor>已恢复会话（{restoredTurns} 轮历史）</Text>
      ) : null}
      <Text dimColor>
        自然语言驱动 — 导入 URL、提问、lint、批准 draft。输入 exit 退出。
      </Text>
    </Box>
  );
}

export function StatusBar({ label }: { label: string }) {
  return (
    <Box marginTop={1}>
      <Text color="yellow">{label}</Text>
    </Box>
  );
}
