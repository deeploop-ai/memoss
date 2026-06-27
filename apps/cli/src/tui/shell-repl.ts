import { runInkShell } from './run-ink.js';
import { runReadlineShell } from './shell-repl-readline.js';
import { isInteractiveTerminal } from './terminal.js';

export async function runShellRepl(vaultArg?: string): Promise<void> {
  if (isInteractiveTerminal()) {
    await runInkShell(vaultArg);
    return;
  }
  await runReadlineShell(vaultArg);
}
