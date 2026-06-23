export type Confidence = 'high' | 'medium' | 'low';

export interface SourceRef {
  source_id: string;
  section?: string;
}

/** YAML frontmatter block on an OKF page. */
export interface OKFFrontmatter {
  type?: string;
  title?: string;
  description?: string;
  resource?: string;
  tags?: string[];
  timestamp?: string;
  sources?: SourceRef[];
  verified_at?: string;
  supersedes?: string;
  confidence?: Confidence;
  [key: string]: unknown;
}

export interface OKFDocument {
  frontmatter: OKFFrontmatter;
  body: string;
}

/** Concept identifier as path segments (e.g. `['topics', 'foo']`). */
export type ConceptId = readonly string[];

export interface ConceptRef {
  id: ConceptId;
  /** Vault-relative path with forward slashes. */
  path: string;
}

/** Plain-markdown index catalog (no YAML frontmatter). */
export interface IndexDocument {
  body: string;
}

/** One action line under a date heading in log.md (Phase 1b). */
export interface LogEntry {
  date: string;
  action: string;
  detail: string;
}
