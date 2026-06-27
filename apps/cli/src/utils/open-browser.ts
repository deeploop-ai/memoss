import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'pathe';
import open from 'open';

const execFileAsync = promisify(execFile);

/** Open a local file in the system default browser. */
export async function openInDefaultBrowser(filePath: string): Promise<void> {
  const absolutePath = resolve(filePath);

  try {
    await open(absolutePath);
    return;
  } catch {
    // Fall through to platform-specific launcher.
  }

  if (process.platform === 'win32') {
    await execFileAsync(
      'cmd',
      ['/c', 'start', '', absolutePath],
      { windowsHide: true },
    );
    return;
  }

  if (process.platform === 'darwin') {
    await execFileAsync('open', [absolutePath]);
    return;
  }

  await execFileAsync('xdg-open', [absolutePath]);
}
