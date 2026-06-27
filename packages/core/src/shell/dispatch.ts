import { FsKnowledgeStore } from '../adapters/fs-store.js';
import { SimpleGitAdapter } from '../adapters/simple-git.js';
import { loadVaultConfig } from '../config/vault-config.js';
import { runIngest } from '../engine/ingest-runner.js';
import { runLint } from '../engine/lint-runner.js';
import { runQuery } from '../engine/query-runner.js';
import { runTuningPass } from '../engine/tuning-runner.js';
import type {
  IngestRunResult,
  LintRunResult,
  QueryRunResult,
  AgentStepSummary,
} from '../engine/types.js';
import { runDeterministicLint } from '../lint/checks.js';
import { computeHealthScore } from '../lint/score.js';
import type { ShellTaskProposal, ShellTaskResult } from './session.js';

export interface ExecuteShellTaskOptions {
  vaultRoot: string;
  proposal: ShellTaskProposal;
  emphasis?: string;
  onStepFinish?: (step: AgentStepSummary) => void;
}

export interface ExecuteShellTaskOutcome {
  result: ShellTaskResult;
  ingest?: IngestRunResult;
  query?: QueryRunResult;
  lint?: LintRunResult;
  tuningSummary?: string;
}

export async function executeShellTask(
  opts: ExecuteShellTaskOptions,
): Promise<ExecuteShellTaskOutcome> {
  const { proposal, vaultRoot } = opts;
  const params = proposal.params;

  switch (proposal.task) {
    case 'ingest': {
      const source = String(params.source ?? '');
      if (!source) {
        return {
          result: {
            task: 'ingest',
            success: false,
            summary: 'Missing source URL or path.',
          },
        };
      }

      const emphasis =
        opts.emphasis ??
        (typeof params.emphasis === 'string' ? params.emphasis : undefined);

      let tuningSummary: string | undefined;
      let qualityOverlay: string | undefined;
      try {
        const tuning = await runTuningPass({
          vaultRoot,
          source,
          emphasis,
        });
        tuningSummary = tuning.report.summary;
        qualityOverlay = tuning.overlay;
      } catch {
        tuningSummary = undefined;
      }

      const ingest = await runIngest({
        vaultRoot,
        source,
        skill: typeof params.skill === 'string' ? params.skill : undefined,
        emphasis,
        qualityOverlay,
        skipTuning: true,
        crawl: params.crawl as import('../engine/types.js').IngestRunOptions['crawl'],
        onStepFinish: opts.onStepFinish,
      });

      const success = ingest.status === 'complete';
      return {
        result: {
          task: 'ingest',
          success,
          summary: success
            ? `Ingest complete${ingest.affects?.length ? ` (${ingest.affects.length} pages)` : ''}.`
            : ingest.status === 'rejected'
              ? 'Ingest rejected by validation.'
              : 'Ingest incomplete.',
          detail: ingest.text,
        },
        ingest,
        tuningSummary,
      };
    }

    case 'query': {
      const question = String(params.question ?? '');
      const save = params.save === true;
      const format =
        params.format === 'comparison' ? 'comparison' : 'default';
      let streamed = '';
      const query = await runQuery({
        vaultRoot,
        question,
        save,
        suggestSave: !save,
        format,
        onTextDelta: (delta) => {
          streamed += delta;
          process.stdout.write(delta);
        },
        onStepFinish: opts.onStepFinish,
      });
      if (streamed && !streamed.endsWith('\n')) {
        process.stdout.write('\n');
      }
      return {
        result: {
          task: 'query',
          success: query.status === 'complete',
          summary: query.status === 'complete' ? 'Query answered.' : 'Query incomplete.',
          detail: query.text,
        },
        query,
      };
    }

    case 'lint': {
      const fix = params.fix === true;
      const lint = await runLint({
        vaultRoot,
        fix,
        onStepFinish: opts.onStepFinish,
      });
      const store = new FsKnowledgeStore(vaultRoot);
      const check = await runDeterministicLint(store);
      const score = computeHealthScore(check.issues, check.pageCount);
      return {
        result: {
          task: 'lint',
          success: lint.status === 'complete',
          summary: `Lint complete. Health score: ${score}/100.`,
          detail: lint.text,
        },
        lint,
      };
    }

    case 'approve': {
      const git = new SimpleGitAdapter(vaultRoot);
      const branch = await git.getCurrentBranch();
      if (!branch.startsWith('memoss/draft/')) {
        return {
          result: {
            task: 'approve',
            success: false,
            summary: `Not on a draft branch (current: ${branch}).`,
          },
        };
      }
      const main = (await git.listLocalBranches()).includes('main')
        ? 'main'
        : 'master';
      await git.checkout(main);
      await git.merge(branch, { ffOnly: true });
      await git.deleteBranch(branch);
      return {
        result: {
          task: 'approve',
          success: true,
          summary: `Merged ${branch} into ${main}.`,
        },
      };
    }

    case 'reject': {
      const git = new SimpleGitAdapter(vaultRoot);
      const branch =
        typeof params.branch === 'string'
          ? params.branch
          : await git.getCurrentBranch();
      if (!branch.startsWith('memoss/draft/')) {
        return {
          result: {
            task: 'reject',
            success: false,
            summary: `Not a draft branch: ${branch}`,
          },
        };
      }
      const main = (await git.listLocalBranches()).includes('main')
        ? 'main'
        : 'master';
      const current = await git.getCurrentBranch();
      if (current === branch) {
        await git.checkout(main);
      }
      await git.deleteBranch(branch, true);
      return {
        result: {
          task: 'reject',
          success: true,
          summary: `Discarded draft branch ${branch}.`,
        },
      };
    }

    case 'status': {
      const config = loadVaultConfig(vaultRoot);
      const store = new FsKnowledgeStore(vaultRoot);
      const pages = await store.listPages();
      const check = await runDeterministicLint(store);
      const score = computeHealthScore(check.issues, check.pageCount);
      const git = new SimpleGitAdapter(vaultRoot);
      const branch = config.git.enabled
        ? await git.getCurrentBranch().catch(() => 'n/a')
        : 'disabled';
      return {
        result: {
          task: 'status',
          success: true,
          summary: `${config.name}: ${pages.length} pages, health ${score}/100, branch ${branch}.`,
        },
      };
    }

    default:
      return {
        result: {
          task: proposal.task,
          success: false,
          summary: `Unknown task: ${proposal.task as string}`,
        },
      };
  }
}
