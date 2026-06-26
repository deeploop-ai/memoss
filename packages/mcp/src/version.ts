import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function readVersionFromPackageJson(path: string): string | undefined {
  if (!existsSync(path)) {
    return undefined;
  }
  const pkg = JSON.parse(readFileSync(path, 'utf8')) as { version?: string };
  return pkg.version;
}

function resolvePackageVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return (
    readVersionFromPackageJson(join(here, 'package.json')) ??
    readVersionFromPackageJson(join(here, '..', 'package.json')) ??
    '0.0.0'
  );
}

/** @memoss/mcp-server version from package.json */
export const MCP_SERVER_VERSION = resolvePackageVersion();
