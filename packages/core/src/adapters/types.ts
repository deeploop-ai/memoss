import type { OKFDocument } from '../okf/types.js';

export interface KnowledgeStore {
  readonly vaultRoot: string;

  readPage(relativePath: string): Promise<OKFDocument>;
  writePage(relativePath: string, doc: OKFDocument): Promise<void>;
  deletePage(relativePath: string): Promise<void>;
  listPages(dir?: string): Promise<string[]>;
  readIndex(dir?: string): Promise<string | null>;
  writeIndex(dir: string, content: string): Promise<void>;
  readLog(): Promise<string>;
  appendLog(line: string, date?: string): Promise<void>;
  exists(relativePath: string): Promise<boolean>;
}

export interface GitCommit {
  hash: string;
  message: string;
  date: string;
  author: string;
}

export interface GitAdapter {
  isRepo(): Promise<boolean>;
  init(): Promise<void>;
  getCurrentBranch(): Promise<string>;
  createBranch(name: string): Promise<void>;
  checkout(branch: string): Promise<void>;
  merge(branch: string, options?: { ffOnly?: boolean }): Promise<void>;
  deleteBranch(name: string, force?: boolean): Promise<void>;
  commit(message: string): Promise<string>;
  diff(ref?: string): Promise<string>;
  log(limit?: number): Promise<GitCommit[]>;
  listLocalBranches(): Promise<string[]>;
}

export type SourceKind = 'file' | 'web' | 'github';

export interface SourceItem {
  id: string;
  title?: string;
  mime?: string;
}

export interface SourceContent {
  id: string;
  title?: string;
  mime: string;
  text: string;
  metadata?: Record<string, unknown>;
}

export interface SourceAdapter {
  readonly kind: SourceKind;
  readonly uri: string;
  listItems(): Promise<SourceItem[]>;
  readItem(id: string): Promise<SourceContent>;
}

export interface CreateSourceAdapterInput {
  kind: SourceKind;
  uri: string;
}
