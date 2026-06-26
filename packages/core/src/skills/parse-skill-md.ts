import { parse as parseYaml } from 'yaml';

export interface ParsedSkillMd {
  name: string;
  description: string;
  compatibility?: string;
  allowedTools?: string;
  body: string;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

function coerceDescription(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  if (value != null) {
    const text = String(value).trim();
    return text || undefined;
  }
  return undefined;
}

function parseFrontmatterYaml(raw: string): Record<string, unknown> {
  try {
    const parsed = parseYaml(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Lenient retry for unquoted colons in description values.
    const lines = raw.split('\n');
    const fixed = lines.map((line) => {
      if (/^description:\s*.+:.+/.test(line) && !line.includes('"') && !line.includes("'")) {
        const value = line.replace(/^description:\s*/, '');
        return `description: "${value.replace(/"/g, '\\"')}"`;
      }
      return line;
    });
    const reparsed = parseYaml(fixed.join('\n'));
    if (reparsed && typeof reparsed === 'object' && !Array.isArray(reparsed)) {
      return reparsed as Record<string, unknown>;
    }
  }
  return {};
}

export function parseSkillMd(content: string): ParsedSkillMd | null {
  const match = FRONTMATTER_RE.exec(content);
  if (!match) {
    return null;
  }

  const frontmatter = parseFrontmatterYaml(match[1]);
  const name = typeof frontmatter.name === 'string' ? frontmatter.name.trim() : '';
  const description = coerceDescription(frontmatter.description);

  if (!name || !description) {
    return null;
  }

  const allowedToolsRaw = frontmatter['allowed-tools'];
  return {
    name,
    description,
    compatibility:
      typeof frontmatter.compatibility === 'string'
        ? frontmatter.compatibility
        : undefined,
    allowedTools:
      typeof allowedToolsRaw === 'string' ? allowedToolsRaw : undefined,
    body: match[2].trim(),
  };
}
