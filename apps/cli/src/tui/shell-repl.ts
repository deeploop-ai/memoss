import { runInkShell } from './run-ink.js';

export async function runShellRepl(vaultArg?: string): Promise<void> {
  await runInkShell(vaultArg);
}
