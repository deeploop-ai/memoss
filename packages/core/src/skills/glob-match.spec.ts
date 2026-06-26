import { describe, expect, it } from 'vitest';
import { matchGlob, resolveSkillOverride } from './glob-match.js';

describe('matchGlob', () => {
  it('matches wildcard patterns', () => {
    expect(matchGlob('https://docs.example.com/*', 'https://docs.example.com/guide')).toBe(true);
    expect(matchGlob('https://docs.example.com/*', 'https://other.example.com/guide')).toBe(false);
  });
});

describe('resolveSkillOverride', () => {
  it('picks the longest matching override', () => {
    const skill = resolveSkillOverride('https://docs.example.com/guide/intro', {
      'https://*': 'generic-web',
      'https://docs.example.com/*': 'docs-scraper',
    });
    expect(skill).toBe('docs-scraper');
  });
});
