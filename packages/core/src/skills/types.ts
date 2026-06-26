export interface SkillRecord {
  readonly name: string;
  readonly description: string;
  readonly compatibility?: string;
  readonly allowedTools?: string;
  readonly location: string;
  readonly baseDir: string;
  readonly scope: SkillScope;
}

export type SkillScope = 'vault-memoss' | 'vault-agents' | 'user-memoss' | 'user-agents';

export interface ActivatedSkill {
  readonly record: SkillRecord;
  readonly body: string;
  readonly resources: string[];
}

export type ExtractKind =
  | 'web'
  | 'github'
  | 'pdf'
  | 'markdown'
  | 'text'
  | 'audio'
  | 'video'
  | 'unknown';

export type ExtractRouteSource =
  | 'cli'
  | 'config'
  | 'override'
  | 'auto'
  | 'fallback'
  | 'skip';

export interface ExtractRoute {
  readonly mode: 'skill' | 'auto' | 'fallback' | 'skip';
  readonly skillName?: string;
  readonly source: ExtractRouteSource;
}

export interface ExtractMeta {
  source_uri: string;
  extract_kind: ExtractKind;
  skill?: string;
  skill_location?: string;
  extracted_at: string;
  content_hash: string;
  fallback: boolean;
  fast_path?: boolean;
  cached?: boolean;
}
