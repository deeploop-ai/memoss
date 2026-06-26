import { describe, expect, it } from 'vitest';
import { parseSkillMd } from './parse-skill-md.js';

describe('parseSkillMd', () => {
  it('parses standard frontmatter and body', () => {
    const parsed = parseSkillMd(`---
name: defuddle
description: Extract clean markdown from web pages.
compatibility: Requires defuddle CLI
---

# Defuddle

Run \`defuddle parse <url> --md\`.
`);
    expect(parsed?.name).toBe('defuddle');
    expect(parsed?.description).toContain('web pages');
    expect(parsed?.body).toContain('# Defuddle');
  });

  it('returns null when description is missing', () => {
    const parsed = parseSkillMd(`---
name: broken
---

Body
`);
    expect(parsed).toBeNull();
  });

  it('tolerates unquoted colons in description', () => {
    const parsed = parseSkillMd(`---
name: web-scrape
description: Use when: the user asks to scrape a URL
---

Instructions
`);
    expect(parsed?.description).toContain('scrape a URL');
  });
});
