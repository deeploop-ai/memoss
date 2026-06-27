import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Text, useApp } from 'ink';
import {
  ShellSession,
  classifyIntentFastPath,
  executeShellTask,
  extractVaultLinks,
  getUserConfigDir,
  isWriteTask,
  loadShellSession,
  openObsidianPage,
  openVaultPage,
  runShellAgentTurn,
  runTuningPass,
  saveShellSession,
  type ShellTaskProposal,
} from '@memoss/core';
import { Header } from './components/header.js';
import { PromptArea } from './components/prompt-area.js';
import { Transcript } from './components/transcript.js';
import type { LogEntry, PendingRun, PromptMode, VaultHeader } from './types.js';
import { loadVaultHeader, resolveShellVault } from './vault.js';

function createLogIdFactory() {
  let seq = 0;
  return () => {
    seq += 1;
    return String(seq);
  };
}

export function ShellApp({ vaultArg }: { vaultArg?: string }) {
  const { exit } = useApp();
  const nextLogIdRef = useRef(createLogIdFactory());
  const sessionRef = useRef<ShellSession>(new ShellSession());
  const userConfigDirRef = useRef(getUserConfigDir());
  const vaultRootRef = useRef<string | null>(null);
  const streamLogIdRef = useRef<string | null>(null);
  const pendingRunRef = useRef<PendingRun | null>(null);

  const [header, setHeader] = useState<VaultHeader | null>(null);
  const [restoredTurns, setRestoredTurns] = useState<number | undefined>();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [input, setInput] = useState('');
  const [promptMode, setPromptMode] = useState<PromptMode>({ type: 'input' });
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('');
  const [bootError, setBootError] = useState<string | null>(null);

  const appendLog = useCallback(
    (role: LogEntry['role'], content: string, task?: LogEntry['task']) => {
      setLogs((prev) => [
        ...prev,
        { id: nextLogIdRef.current(), role, content, task },
      ]);
    },
    [],
  );

  const persistSession = useCallback(() => {
    const vaultRoot = vaultRootRef.current;
    if (!vaultRoot) {
      return;
    }
    saveShellSession(
      userConfigDirRef.current,
      vaultRoot,
      sessionRef.current.toJSON(),
    );
  }, []);

  const refreshHeader = useCallback(async () => {
    const vaultRoot = vaultRootRef.current;
    if (!vaultRoot) {
      return;
    }
    setHeader(await loadVaultHeader(vaultRoot));
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const vaultRoot = await resolveShellVault(vaultArg);
        vaultRootRef.current = vaultRoot;
        const saved = loadShellSession(userConfigDirRef.current, vaultRoot);
        if (saved) {
          sessionRef.current = ShellSession.fromState(saved);
          if (saved.turns.length > 0) {
            setRestoredTurns(saved.turns.length);
          }
        }
        setHeader(await loadVaultHeader(vaultRoot));
      } catch (error) {
        setBootError(error instanceof Error ? error.message : String(error));
      }
    })();
  }, [vaultArg]);

  const appendStreamDelta = useCallback((delta: string) => {
    setLogs((prev) => {
      const streamId = streamLogIdRef.current;
      if (!streamId) {
        const id = nextLogIdRef.current();
        streamLogIdRef.current = id;
        return [...prev, { id, role: 'stream', content: delta }];
      }
      return prev.map((entry) =>
        entry.id === streamId
          ? { ...entry, content: entry.content + delta }
          : entry,
      );
    });
  }, []);

  const runTask = useCallback(
    async (proposal: ShellTaskProposal, emphasis?: string) => {
      const vaultRoot = vaultRootRef.current;
      if (!vaultRoot) {
        return;
      }

      setBusy(true);
      setBusyLabel(`执行 ${proposal.task}…`);
      streamLogIdRef.current = null;

      try {
        const outcome = await executeShellTask({
          vaultRoot,
          proposal,
          emphasis,
          onTextDelta: proposal.task === 'query' ? appendStreamDelta : undefined,
        });

        sessionRef.current.setLastTask(outcome.result);
        streamLogIdRef.current = null;

        if (outcome.result.detail && proposal.task !== 'query') {
          appendLog('assistant', outcome.result.detail, proposal.task);
        } else if (outcome.result.detail && proposal.task === 'query') {
          setLogs((prev) => {
            const hasStream = prev.some((e) => e.role === 'stream');
            if (hasStream) {
              return prev;
            }
            return [
              ...prev,
              {
                id: nextLogIdRef.current(),
                role: 'assistant',
                content: outcome.result.detail ?? '',
                task: 'query',
              },
            ];
          });
        }

        appendLog('system', outcome.result.summary, proposal.task);

        await refreshHeader();

        if (proposal.task === 'query' && outcome.result.detail) {
          const links = extractVaultLinks(outcome.result.detail).slice(0, 5);
          if (links.length > 0) {
            setPromptMode({
              type: 'open_refs',
              links,
              detail: outcome.result.detail,
            });
            setBusy(false);
            setBusyLabel('');
            persistSession();
            return;
          }
        }

        if (proposal.task === 'ingest' && outcome.ingest?.draftBranch) {
          setPromptMode({
            type: 'approve',
            draftBranch: outcome.ingest.draftBranch,
          });
          setBusy(false);
          setBusyLabel('');
          persistSession();
          return;
        }
      } catch (error) {
        appendLog(
          'error',
          error instanceof Error ? error.message : String(error),
        );
      }

      setBusy(false);
      setBusyLabel('');
      setPromptMode({ type: 'input' });
      persistSession();
    },
    [appendLog, appendStreamDelta, persistSession, refreshHeader],
  );

  const beginTaskFlow = useCallback(
    async (proposal: ShellTaskProposal) => {
      if (proposal.task === 'ingest') {
        const source = String(proposal.params.source ?? '');
        appendLog('system', `计划 ingest: ${source}`, 'ingest');
        if (proposal.params.crawl) {
          appendLog(
            'system',
            `Crawl: ${JSON.stringify(proposal.params.crawl)}`,
            'ingest',
          );
        }
        setBusy(true);
        setBusyLabel('Tuning pass…');
        try {
          const tuning = await runTuningPass({ vaultRoot: vaultRootRef.current!, source });
          appendLog('assistant', tuning.overlay, 'ingest');
          sessionRef.current.addAssistantTurn(tuning.report.summary, 'ingest');
        } catch (error) {
          appendLog(
            'system',
            `Tuning pass skipped: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        setBusy(false);
        setBusyLabel('');
      } else if (proposal.task === 'query') {
        appendLog(
          'system',
          `计划 query: ${String(proposal.params.question ?? '')}`,
          'query',
        );
      } else {
        appendLog(
          'system',
          `计划 ${proposal.task}: ${proposal.rationale ?? ''}`,
          proposal.task,
        );
      }

      if (isWriteTask(proposal.task)) {
        pendingRunRef.current = { proposal };
        setPromptMode({ type: 'confirm', proposal });
        return;
      }

      await runTask(proposal);
    },
    [appendLog, runTask],
  );

  const resolveProposal = useCallback(
    async (message: string): Promise<ShellTaskProposal | undefined> => {
      const vaultRoot = vaultRootRef.current;
      if (!vaultRoot) {
        return undefined;
      }

      const fast = classifyIntentFastPath(message);
      if (fast) {
        return fast.proposal;
      }

      setBusy(true);
      setBusyLabel('Shell agent 解析意图…');
      try {
        const turn = await runShellAgentTurn({
          vaultRoot,
          message,
          session: sessionRef.current,
        });
        if (turn.text) {
          appendLog('assistant', turn.text);
          sessionRef.current.addAssistantTurn(turn.text);
        }
        return turn.proposal;
      } finally {
        setBusy(false);
        setBusyLabel('');
      }
    },
    [appendLog],
  );

  const handleSubmit = useCallback(
    async (raw: string) => {
      const message = raw.trim();
      if (promptMode.type === 'emphasis') {
        const pending = pendingRunRef.current;
        setInput('');
        setPromptMode({ type: 'input' });
        if (pending) {
          await runTask(pending.proposal, message || undefined);
        }
        pendingRunRef.current = null;
        return;
      }

      if (promptMode.type !== 'input' || busy) {
        return;
      }

      if (!message) {
        return;
      }

      if (/^(exit|quit|q|退出)$/i.test(message)) {
        persistSession();
        exit();
        return;
      }

      setInput('');
      sessionRef.current.addUserTurn(message);
      appendLog('user', message);

      setBusy(true);
      setBusyLabel('识别任务…');
      try {
        const proposal = await resolveProposal(message);
        if (!proposal) {
          appendLog('system', '未能识别任务，请换种说法或给出 URL/问题。');
          persistSession();
          return;
        }
        await beginTaskFlow(proposal);
      } catch (error) {
        appendLog(
          'error',
          error instanceof Error ? error.message : String(error),
        );
        persistSession();
      } finally {
        if (promptMode.type === 'input') {
          setBusy(false);
          setBusyLabel('');
        }
      }
    },
    [
      appendLog,
      beginTaskFlow,
      busy,
      exit,
      persistSession,
      promptMode.type,
      resolveProposal,
    ],
  );

  const handleConfirm = useCallback(
    async (accepted: boolean) => {
      const pending = pendingRunRef.current;
      if (!pending) {
        setPromptMode({ type: 'input' });
        return;
      }
      if (!accepted) {
        appendLog('system', '已取消。');
        pendingRunRef.current = null;
        setPromptMode({ type: 'input' });
        persistSession();
        return;
      }
      if (pending.proposal.task === 'ingest') {
        pendingRunRef.current = pending;
        setInput('');
        setPromptMode({ type: 'emphasis', proposal: pending.proposal });
        return;
      }
      pendingRunRef.current = null;
      setPromptMode({ type: 'input' });
      await runTask(pending.proposal, pending.emphasis);
    },
    [appendLog, persistSession, runTask],
  );

  const handleOpenRefs = useCallback(
    async (choice: 'default' | 'obsidian' | 'skip') => {
      const vaultRoot = vaultRootRef.current;
      if (promptMode.type !== 'open_refs' || !vaultRoot) {
        setPromptMode({ type: 'input' });
        return;
      }
      if (choice !== 'skip') {
        for (const link of promptMode.links) {
          const opened =
            choice === 'obsidian'
              ? await openObsidianPage(vaultRoot, link)
              : await openVaultPage(vaultRoot, link);
          if (!opened) {
            appendLog('error', `无法打开: ${link}`);
          }
        }
      }
      setPromptMode({ type: 'input' });
      persistSession();
    },
    [appendLog, persistSession, promptMode],
  );

  const handleApprove = useCallback(
    async (accepted: boolean) => {
      if (!accepted) {
        appendLog('system', '已跳过合并。');
        setPromptMode({ type: 'input' });
        persistSession();
        return;
      }
      setBusy(true);
      setBusyLabel('合并 draft…');
      try {
        const outcome = await executeShellTask({
          vaultRoot: vaultRootRef.current!,
          proposal: { task: 'approve', params: {} },
        });
        sessionRef.current.setLastTask(outcome.result);
        appendLog('system', outcome.result.summary, 'approve');
        await refreshHeader();
      } catch (error) {
        appendLog(
          'error',
          error instanceof Error ? error.message : String(error),
        );
      }
      setBusy(false);
      setBusyLabel('');
      setPromptMode({ type: 'input' });
      persistSession();
    },
    [appendLog, persistSession, refreshHeader],
  );

  if (bootError) {
    return (
      <Box flexDirection="column">
        <Text color="red">{bootError}</Text>
        <Text dimColor>按 Ctrl+C 退出</Text>
      </Box>
    );
  }

  if (!header) {
    return (
      <Box>
        <Text color="yellow">加载 vault…</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      <Header header={header} restoredTurns={restoredTurns} />
      <Transcript entries={logs} />
      <PromptArea
        mode={promptMode}
        busy={busy}
        busyLabel={busyLabel}
        input={input}
        onInputChange={setInput}
        onSubmit={handleSubmit}
        onConfirm={(accepted) => {
          void handleConfirm(accepted);
        }}
        onOpenRefs={(choice) => {
          void handleOpenRefs(choice);
        }}
        onApprove={(accepted) => {
          void handleApprove(accepted);
        }}
      />
    </Box>
  );
}
