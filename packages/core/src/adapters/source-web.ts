import { fetchUrl } from './fetch.js';
import { MemossError } from '../errors.js';
import type { SourceAdapter, SourceContent, SourceItem } from './types.js';

export class WebSourceAdapter implements SourceAdapter {
  readonly kind = 'web' as const;
  readonly uri: string;

  constructor(uri: string) {
    this.uri = uri;
  }

  async listItems(): Promise<SourceItem[]> {
    return [{ id: this.uri, title: this.uri, mime: 'text/html' }];
  }

  async readItem(id: string): Promise<SourceContent> {
    if (id !== this.uri) {
      throw new MemossError(
        'SOURCE_ERROR',
        `Web source id must match adapter uri: expected ${this.uri}, got ${id}`,
      );
    }
    const result = await fetchUrl(this.uri);
    return {
      id,
      title: result.title ?? id,
      mime: result.mime,
      text: result.text,
      metadata: {
        url: result.url,
        links: result.links,
      },
    };
  }
}
