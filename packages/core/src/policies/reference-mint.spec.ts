import { describe, expect, it } from 'vitest';
import { ReferenceMintPolicy } from './reference-mint.js';
import { parsePoliciesConfig } from './config.js';

describe('ReferenceMintPolicy', () => {
  it('blocks overview slug references', () => {
    const policy = new ReferenceMintPolicy(parsePoliciesConfig({}).reference_mint);
    const violation = policy.checkNewReferencePage(
      'references/overview.md',
      { type: 'Reference', title: 'Overview', description: 'x' },
      'x'.repeat(100),
    );
    expect(violation?.code).toBe('REFERENCE_SLUG_BLOCKED');
  });

  it('allows concrete reference slugs', () => {
    const policy = new ReferenceMintPolicy(parsePoliciesConfig({}).reference_mint);
    const violation = policy.checkNewReferencePage(
      'references/event_parameters.md',
      { type: 'Reference', title: 'Event parameters', description: 'GA4 event params' },
      'Defines event parameters used across analytics tables with field-level semantics.\n\n# Fields\n\n- user_id — stable identifier\n- event_name — GA4 event key\n- session_id — browsing session\n',
    );
    expect(violation).toBeUndefined();
  });
});
