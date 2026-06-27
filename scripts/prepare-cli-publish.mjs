import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(root, 'apps', 'cli', 'dist');
const pkgPath = join(distDir, 'package.json');

const readPkg = (relativePath) =>
  JSON.parse(readFileSync(join(root, relativePath), 'utf8'));

const cliPkg = readPkg('apps/cli/package.json');
const corePkg = readPkg('packages/core/package.json');
const mcpPkg = readPkg('packages/mcp/package.json');

/** Workspace-only ranges are replaced with published registry versions. */
function externalDeps(pkg) {
  const deps = {};
  for (const [name, range] of Object.entries(pkg.dependencies ?? {})) {
    if (!String(range).startsWith('workspace:')) {
      deps[name] = range;
    }
  }
  return deps;
}

const schemaPackSrc = join(root, 'schema-packs');
const schemaPackDest = join(distDir, 'utils', 'schema-packs');
if (existsSync(schemaPackSrc)) {
  cpSync(schemaPackSrc, schemaPackDest, { recursive: true });
}

const prepared = {
  name: '@memoss/cli',
  version: cliPkg.version,
  description:
    'Agent-native knowledge runtime - ingest, query, and lint your OKF knowledge base from the CLI.',
  license: 'Apache-2.0',
  publishConfig: { access: 'public', registry: 'https://registry.npmjs.org' },
  type: 'module',
  engines: { node: '>=20' },
  repository: {
    type: 'git',
    url: 'git+https://github.com/deeploop-ai/memoss.git',
    directory: 'apps/cli',
  },
  homepage: 'https://github.com/deeploop-ai/memoss#readme',
  bugs: { url: 'https://github.com/deeploop-ai/memoss/issues' },
  keywords: ['memoss', 'knowledge-base', 'okf', 'cli', 'mcp', 'ai', 'wiki'],
  bin: { memoss: 'main.js' },
  files: ['main.js', 'cli.js', 'version.js', 'exit-codes.js', 'commands', 'utils', 'tui'],
  dependencies: {
    '@memoss/core': `^${corePkg.version}`,
    '@memoss/mcp-server': `^${mcpPkg.version}`,
    ...externalDeps(cliPkg),
  },
};

writeFileSync(pkgPath, `${JSON.stringify(prepared, null, 2)}\n`);

writeFileSync(
  join(distDir, '.npmignore'),
  [
    'apps',
    'workspace_modules',
    'tsconfig.app.tsbuildinfo',
    'pnpm-lock.yaml',
    'package.json.bak',
  ].join('\n') + '\n',
);

console.log(
  `Prepared ${pkgPath} for npm publish as @memoss/cli@${prepared.version} ` +
    `(deps: @memoss/core@^${corePkg.version}, @memoss/mcp-server@^${mcpPkg.version})`,
);
