import type { VaultConfig } from '../config/vault-config.js';
import { AugmentPolicy } from './augment.js';
import { CitationPolicy } from './citation.js';
import { ReferenceMintPolicy } from './reference-mint.js';

export class PolicyRunner {
  readonly augment: AugmentPolicy;
  readonly citation: CitationPolicy;
  readonly referenceMint: ReferenceMintPolicy;
  readonly writtenPages: string[] = [];

  constructor(config: VaultConfig) {
    this.augment = new AugmentPolicy(config.policies.augment);
    this.citation = new CitationPolicy(config.policies.citation);
    this.referenceMint = new ReferenceMintPolicy(config.policies.reference_mint);
  }

  reset(): void {
    this.augment.reset();
    this.writtenPages.length = 0;
  }

  recordWrite(path: string): void {
    const normalized = path.replace(/\\/g, '/');
    if (!this.writtenPages.includes(normalized)) {
      this.writtenPages.push(normalized);
    }
  }
}
