import { FileSourceAdapter } from './source-file.js';
import { GitHubSourceAdapter } from './source-github.js';
import { WebSourceAdapter } from './source-web.js';
import type { CreateSourceAdapterInput, SourceAdapter } from './types.js';

export function createSourceAdapter(input: CreateSourceAdapterInput): SourceAdapter {
  switch (input.kind) {
    case 'file':
      return new FileSourceAdapter(input.uri);
    case 'web':
      return new WebSourceAdapter(input.uri);
    case 'github':
      return new GitHubSourceAdapter(input.uri);
    default: {
      const exhaustive: never = input.kind;
      throw new Error(`Unsupported source kind: ${exhaustive}`);
    }
  }
}
