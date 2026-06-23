import { fetchUrl } from './fetch.js';
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
    const result = await fetchUrl(id);
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
