import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(root, 'apps', 'cli', 'dist');
const pkgPath = join(distDir, 'package.json');
const source = JSON.parse(readFileSync(pkgPath, 'utf8'));

const schemaPackSrc = join(root, 'schema-packs');
const schemaPackDest = join(distDir, 'utils', 'schema-packs');
if (existsSync(schemaPackSrc)) {
  cpSync(schemaPackSrc, schemaPackDest, { recursive: true });
}

const prepared = {
  name: 'memoss',
  version: source.version,
  description:
    'Agent-native knowledge runtime - ingest, query, and lint your OKF knowledge base from the CLI.',
  license: 'Apache-2.0',
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
  files: [
    'main.js',
    'cli.js',
    'exit-codes.js',
    'commands',
    'utils',
    'workspace_modules',
  ],
  dependencies: source.dependencies,
};

writeFileSync(pkgPath, `${JSON.stringify(prepared, null, 2)}\n`);

writeFileSync(
  join(distDir, '.npmignore'),
  ['apps', 'tsconfig.app.tsbuildinfo', 'pnpm-lock.yaml', 'package.json.bak'].join('\n') + '\n',
);

console.log(`Prepared ${pkgPath} for npm publish as memoss@${prepared.version}`);
