import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { consola } from 'consola';
import {
  ShellSession,
  classifyIntentFastPath,
  computeHealthScore,
  executeShellTask,
  FsKnowledgeStore,
  isWriteTask,
  loadVaultConfig,
  runDeterministicLint,
  runShellAgentTurn,
  runTuningPass,
  type ShellTaskProposal,
} from '@memoss/core';
import { resolveVaultRoot } from '../utils/vault.js';

async function resolveShellVault(vaultArg?: string): Promise<string> {
  if (vaultArg) {
    return vaultArg;
  }
  try {
    return resolveVaultRoot({});
  } catch {
    throw new Error('No vault found. Run memoss init or use -C <vault>.');
  }
}

async function promptConfirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(`${message} [Y/n/edit] `);
    const normalized = answer.trim().toLowerCase();
    if (normalized === '' || normalized === 'y' || normalized === 'yes') {
      return true;
    }
    if (normalized === 'edit') {
      return true;
    }
    return false;
  } finally {
    rl.close();
  }
}

async function promptEmphasis(): Promise<string | undefined> {
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question('补充 emphasis（可留空）: ');
    const trimmed = answer.trim();
    return trimmed || undefined;
  } finally {
    rl.close();
  }
}

function printHeader(vaultRoot: string): void {
  const config = loadVaultConfig(vaultRoot);
  const store = new FsKnowledgeStore(vaultRoot);
  void store.listPages().then(async (pages) => {
    const lint = await runDeterministicLint(store);
    const score = computeHealthScore(lint.issues, lint.pageCount);
    consola.info(
      `Vault: ${config.name} · pages: ${pages.length} · health: ${score}/100`,
    );
  });
}

async function resolveProposal(
  vaultRoot: string,
  message: string,
  session: ShellSession,
): Promise<ShellTaskProposal | undefined> {
  const fast = classifyIntentFastPath(message);
  if (fast) {
    return fast.proposal;
  }

  const turn = await runShellAgentTurn({
    vaultRoot,
    message,
    session,
  });

  if (turn.text) {
    consola.log(turn.text);
    session.addAssistantTurn(turn.text);
  }

  return turn.proposal;
}

async function confirmAndRunTask(
  vaultRoot: string,
  proposal: ShellTaskProposal,
  session: ShellSession,
): Promise<void> {
  if (proposal.task === 'ingest') {
    const source = String(proposal.params.source ?? '');
    consola.info(`计划 ingest: ${source}`);
    try {
      const tuning = await runTuningPass({ vaultRoot, source });
      consola.log(`\n${tuning.overlay}\n`);
      session.addAssistantTurn(tuning.report.summary, 'ingest');
    } catch (error) {
      consola.warn('Tuning pass skipped:', error);
    }
  } else if (proposal.task === 'query') {
    consola.info(`计划 query: ${String(proposal.params.question ?? '')}`);
  } else {
    consola.info(`计划 ${proposal.task}: ${proposal.rationale ?? ''}`);
  }

  if (isWriteTask(proposal.task)) {
    const confirmed = await promptConfirm('确认执行？');
    if (!confirmed) {
      consola.info('已取消。');
      return;
    }
  }

  let emphasis: string | undefined;
  if (proposal.task === 'ingest') {
    emphasis = await promptEmphasis();
  }

  const outcome = await executeShellTask({
    vaultRoot,
    proposal,
    emphasis,
  });

  session.setLastTask(outcome.result);
  if (outcome.result.detail) {
    consola.log('\n' + outcome.result.detail);
  }
  consola.info(outcome.result.summary);

  if (proposal.task === 'ingest' && outcome.ingest?.draftBranch) {
    consola.info(`Draft branch: ${outcome.ingest.draftBranch}`);
    const approve = await promptConfirm('批准合并到 main？');
    if (approve) {
      const approved = await executeShellTask({
        vaultRoot,
        proposal: { task: 'approve', params: {} },
      });
      consola.info(approved.result.summary);
      session.setLastTask(approved.result);
    }
  }
}

export async function runShellRepl(vaultArg?: string): Promise<void> {
  let vaultRoot: string;
  try {
    vaultRoot = await resolveShellVault(vaultArg);
  } catch (error) {
    consola.error(error instanceof Error ? error.message : String(error));
    return;
  }

  printHeader(vaultRoot);
  consola.log(
    'Memoss Shell — 自然语言驱动（导入 URL、提问、lint、批准 draft）。输入 exit 退出。\n',
  );

  const session = new ShellSession();
  const rl = readline.createInterface({ input, output });

  try {
    while (true) {
      const message = (await rl.question('> ')).trim();
      if (!message) {
        continue;
      }
      if (/^(exit|quit|q|退出)$/i.test(message)) {
        break;
      }

      session.addUserTurn(message);

      try {
        const proposal = await resolveProposal(vaultRoot, message, session);
        if (!proposal) {
          consola.warn('未能识别任务，请换种说法或给出 URL/问题。');
          continue;
        }
        await confirmAndRunTask(vaultRoot, proposal, session);
      } catch (error) {
        consola.error(error instanceof Error ? error.message : String(error));
      }
    }
  } finally {
    rl.close();
  }
}
