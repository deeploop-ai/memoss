import { cpSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function copyMarkdownPrompts() {
  const src = join(root, 'src', 'engine', 'prompts');
  const dest = join(root, 'dist', 'engine', 'prompts');
  mkdirSync(dest, { recursive: true });
  for (const file of readdirSync(src)) {
    if (file.endsWith('.md')) {
      cpSync(join(src, file), join(dest, file));
    }
  }
  console.log('Copied engine prompts to dist/engine/prompts');
}

function copyViewerAssets() {
  const src = join(root, 'src', 'viewer', 'assets');
  const dest = join(root, 'dist', 'viewer', 'assets');
  mkdirSync(dest, { recursive: true });
  for (const file of readdirSync(src)) {
    cpSync(join(src, file), join(dest, file));
  }
  console.log('Copied viewer assets to dist/viewer/assets');
}

copyMarkdownPrompts();
copyViewerAssets();
