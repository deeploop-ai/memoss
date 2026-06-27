import { describe, expect, it } from 'vitest';
import { createToolRegistry } from '../tools/registry.js';
import { PolicyRunner } from '../policies/runner.js';
import { FsKnowledgeStore } from '../adapters/fs-store.js';
import { SimpleGitAdapter } from '../adapters/simple-git.js';
import { createDefaultVaultConfig } from '../config/vault-config.js';
import {
  INGEST_TOOL_NAMES,
  LINT_TOOL_NAMES,
  LINT_FIX_TOOL_NAMES,
  pickTools,
  QUERY_SAVE_TOOL_NAMES,
  QUERY_TOOL_NAMES,
} from './pick-tools.js';

function createRegistry() {
  return createToolRegistry({
    store: new FsKnowledgeStore('/tmp/unused'),
    git: new SimpleGitAdapter('/tmp/unused'),
    config: createDefaultVaultConfig(),
    policies: new PolicyRunner(createDefaultVaultConfig()),
    draftMode: true,
  });
}

describe('pickTools', () => {
  it('selects ingest tool subset', () => {
    const registry = createRegistry();
    const tools = pickTools(registry, INGEST_TOOL_NAMES);
    expect(Object.keys(tools).sort()).toEqual([...INGEST_TOOL_NAMES].sort());
  });

  it('selects query tools without write by default', () => {
    const registry = createRegistry();
    const tools = pickTools(registry, QUERY_TOOL_NAMES);
    expect(Object.keys(tools)).not.toContain('write_page');
  });

  it('includes write tools in query save mode', () => {
    const registry = createRegistry();
    const tools = pickTools(registry, QUERY_SAVE_TOOL_NAMES);
    expect(Object.keys(tools)).toContain('write_page');
    expect(Object.keys(tools)).toContain('append_log');
  });

  it('adds fix tools for lint fix mode', () => {
    const registry = createRegistry();
    const readOnly = pickTools(registry, LINT_TOOL_NAMES);
    const fix = pickTools(registry, LINT_FIX_TOOL_NAMES);

    expect(Object.keys(fix).length).toBeGreaterThan(Object.keys(readOnly).length);
    expect(Object.keys(fix)).toContain('git_commit');
  });
});
