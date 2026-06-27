import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import type { PromptMode } from '../types.js';

interface PromptAreaProps {
  mode: PromptMode;
  busy: boolean;
  busyLabel: string;
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onConfirm: (accepted: boolean) => void;
  onOpenRefs: (choice: 'default' | 'obsidian' | 'skip') => void;
  onApprove: (accepted: boolean) => void;
}

export function PromptArea({
  mode,
  busy,
  busyLabel,
  input,
  onInputChange,
  onSubmit,
  onConfirm,
  onOpenRefs,
  onApprove,
}: PromptAreaProps) {
  useInput(
    (char, key) => {
      if (busy) {
        return;
      }
      if (mode.type === 'confirm') {
        if (char === 'y' || char === 'Y' || (char === '' && key.return)) {
          onConfirm(true);
        } else if (char === 'n' || char === 'N') {
          onConfirm(false);
        }
        return;
      }
      if (mode.type === 'open_refs') {
        if (char === 'o' || char === 'O' || (char === '' && key.return)) {
          onOpenRefs('default');
        } else if (char === 'b' || char === 'B') {
          onOpenRefs('obsidian');
        } else if (char === 'n' || char === 'N') {
          onOpenRefs('skip');
        }
        return;
      }
      if (mode.type === 'approve') {
        if (char === 'y' || char === 'Y' || (char === '' && key.return)) {
          onApprove(true);
        } else if (char === 'n' || char === 'N') {
          onApprove(false);
        }
      }
    },
    {
      isActive:
        !busy &&
        (mode.type === 'confirm' ||
          mode.type === 'open_refs' ||
          mode.type === 'approve'),
    },
  );

  if (busy) {
    return (
      <Box>
        <Text color="yellow">
          <Spinner type="dots" /> {busyLabel}
        </Text>
      </Box>
    );
  }

  if (mode.type === 'confirm') {
    return (
      <Box flexDirection="column">
        <Text color="yellow">确认执行？ [Y/n]</Text>
      </Box>
    );
  }

  if (mode.type === 'emphasis') {
    return (
      <Box>
        <Text>补充 emphasis（可留空）: </Text>
        <TextInput
          value={input}
          onChange={onInputChange}
          onSubmit={onSubmit}
          placeholder="留空直接回车"
        />
      </Box>
    );
  }

  if (mode.type === 'open_refs') {
    return (
      <Box flexDirection="column">
        <Text dimColor>引用页: {mode.links.join(', ')}</Text>
        <Text color="yellow">打开引用页？[O=系统默认/B=Obsidian/N=跳过]</Text>
      </Box>
    );
  }

  if (mode.type === 'approve') {
    return (
      <Box flexDirection="column">
        <Text dimColor>Draft branch: {mode.draftBranch}</Text>
        <Text color="yellow">批准合并到 main？ [Y/n]</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Text color="green">&gt; </Text>
      <TextInput
        value={input}
        onChange={onInputChange}
        onSubmit={onSubmit}
        placeholder="输入消息…"
      />
    </Box>
  );
}
