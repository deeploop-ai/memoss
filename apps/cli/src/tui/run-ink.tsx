import { render } from 'ink';
import { ShellApp } from './app.js';

export async function runInkShell(vaultArg?: string): Promise<void> {
  const { waitUntilExit } = render(<ShellApp vaultArg={vaultArg} />);
  await waitUntilExit();
}
