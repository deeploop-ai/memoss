import type { ShellTaskProposal, ShellTaskType } from '@memoss/core';

export type LogRole = 'user' | 'assistant' | 'system' | 'stream' | 'error';

export interface LogEntry {
  id: string;
  role: LogRole;
  content: string;
  task?: ShellTaskType;
}

export interface VaultHeader {
  name: string;
  pageCount: number;
  healthScore: number;
}

export type PromptMode =
  | { type: 'input' }
  | { type: 'confirm'; proposal: ShellTaskProposal }
  | { type: 'emphasis'; proposal: ShellTaskProposal }
  | { type: 'open_refs'; links: string[]; detail: string }
  | { type: 'approve'; draftBranch: string };

export interface PendingRun {
  proposal: ShellTaskProposal;
  emphasis?: string;
}
