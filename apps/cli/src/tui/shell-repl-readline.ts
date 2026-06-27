import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { consola } from 'consola';
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
import { resolveShellVault, loadVaultHeader } from './vault.js';

async function resolveShellVaultLocal(vaultArg?: string): Promise<string> {
  return resolveShellVault(vaultArg);
}

async function printHeader(vaultRoot: string): Promise<void> {
  const header = await loadVaultHeader(vaultRoot);
  consola.info(
    `Vault: ${header.name} · pages: ${header.pageCount} · health: ${header.healthScore}/100`,
  );
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

async function promptOpenRefs(vaultRoot: string, detail?: string): Promise<void> {
  if (!detail) {
    return;
  }
  const links = extractVaultLinks(detail).slice(0, 5);
  if (links.length === 0) {
    return;
  }

  const rl = readline.createInterface({ input, output });
  try {
    consola.info(`引用页: ${links.join(', ')}`);
    const answer = await rl.question('打开引用页？[o=系统默认/b=Obsidian/n] ');
    const choice = answer.trim().toLowerCase();
    if (choice === 'n' || choice === 'no') {
      return;
    }
    const useObsidian = choice === 'b' || choice === 'obsidian';
    for (const link of links) {
      const opened = useObsidian
        ? await openObsidianPage(vaultRoot, link)
        : await openVaultPage(vaultRoot, link);
      if (!opened) {
        consola.warn(`无法打开: ${link}`);
      }
    }
  } finally {
    rl.close();
  }
}

function printHeaderSync(vaultRoot: string): void {
  void printHeader(vaultRoot);
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
    if (proposal.params.crawl) {
      consola.info(`Crawl: ${JSON.stringify(proposal.params.crawl)}`);
    }
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
  if (outcome.result.detail && proposal.task !== 'query') {
    consola.log('\n' + outcome.result.detail);
  }
  consola.info(outcome.result.summary);

  if (proposal.task === 'query') {
    await promptOpenRefs(vaultRoot, outcome.result.detail);
  }

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

export async function runReadlineShell(vaultArg?: string): Promise<void> {
  let vaultRoot: string;
  try {
    vaultRoot = await resolveShellVaultLocal(vaultArg);
  } catch (error) {
    consola.error(error instanceof Error ? error.message : String(error));
    return;
  }

  printHeaderSync(vaultRoot);
  consola.log(
    'Memoss Shell — 自然语言驱动（导入 URL、提问、lint、批准 draft）。输入 exit 退出。\n',
  );

  const userConfigDir = getUserConfigDir();
  const saved = loadShellSession(userConfigDir, vaultRoot);
  const session = saved ? ShellSession.fromState(saved) : new ShellSession();
  if (saved && saved.turns.length > 0) {
    consola.info(`已恢复会话（${saved.turns.length} 轮历史）。`);
  }

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
          saveShellSession(userConfigDir, vaultRoot, session.toJSON());
          continue;
        }
        await confirmAndRunTask(vaultRoot, proposal, session);
        saveShellSession(userConfigDir, vaultRoot, session.toJSON());
      } catch (error) {
        consola.error(error instanceof Error ? error.message : String(error));
        saveShellSession(userConfigDir, vaultRoot, session.toJSON());
      }
    }
  } finally {
    saveShellSession(userConfigDir, vaultRoot, session.toJSON());
    rl.close();
  }
}
