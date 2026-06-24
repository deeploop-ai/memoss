import { AugmentPolicy } from './augment.js';
import { CitationPolicy } from './citation.js';
import { ReferenceMintPolicy } from './reference-mint.js';

export class PolicyRunner {
  readonly augment = new AugmentPolicy();
  readonly citation = new CitationPolicy();
  readonly referenceMint = new ReferenceMintPolicy();

  reset(): void {
    this.augment.reset();
  }
}
