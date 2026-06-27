import { cpSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const coreRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoSchemaPacks = join(coreRoot, '..', '..', 'schema-packs');
const dest = join(coreRoot, 'dist', 'schema-packs');

if (!existsSync(repoSchemaPacks)) {
  console.warn(`copy-schema-packs: source not found at ${repoSchemaPacks}`);
  process.exit(0);
}

cpSync(repoSchemaPacks, dest, { recursive: true });
console.log(`Copied schema-packs to ${dest}`);
