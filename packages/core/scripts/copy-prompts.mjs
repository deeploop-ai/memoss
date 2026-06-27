import { cpSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function copyMarkdownTree(srcDir, destDir) {
  mkdirSync(destDir, { recursive: true });
  for (const entry of readdirSync(srcDir)) {
    const srcPath = join(srcDir, entry);
    const destPath = join(destDir, entry);
    if (statSync(srcPath).isDirectory()) {
      copyMarkdownTree(srcPath, destPath);
    } else if (entry.endsWith('.md')) {
      cpSync(srcPath, destPath);
    }
  }
}

function copyMarkdownPrompts() {
  const src = join(root, 'src', 'engine', 'prompts');
  const dest = join(root, 'dist', 'engine', 'prompts');
  copyMarkdownTree(src, dest);
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
