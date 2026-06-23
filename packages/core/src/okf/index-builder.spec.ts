import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { regenerateIndexes } from './index-builder.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('regenerateIndexes', () => {
  it('writes index.md files for directories with pages', () => {
    const root = mkdtempSync(join(tmpdir(), 'memoss-index-'));
    tempDirs.push(root);

    const topics = join(root, 'topics');
    mkdirSync(topics, { recursive: true });
    writeFileSync(
      join(topics, 'alpha.md'),
      `---
type: Topic
title: Alpha
description: First topic.
---

# Alpha
`,
      'utf8',
    );
    writeFileSync(
      join(topics, 'beta.md'),
      `---
type: Topic
title: Beta
description: Second topic.
---

# Beta
`,
      'utf8',
    );

    const written = regenerateIndexes(root);
    expect(written).toContain(join(root, 'index.md'));
    expect(written).toContain(join(topics, 'index.md'));

    const topicsIndex = readFileSync(join(topics, 'index.md'), 'utf8');
    expect(topicsIndex).toContain('[Alpha](alpha.md)');
    expect(topicsIndex).toContain('[Beta](beta.md)');
  });
});
