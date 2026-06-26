import type { SkillRecord } from './types.js';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildSkillCatalogXml(skills: Iterable<SkillRecord>): string {
  const items = [...skills];
  if (items.length === 0) {
    return '<available_skills />';
  }

  const body = items
    .map(
      (skill) => `  <skill>
    <name>${escapeXml(skill.name)}</name>
    <description>${escapeXml(skill.description)}</description>
    <location>${escapeXml(skill.location)}</location>
  </skill>`,
    )
    .join('\n');

  return `<available_skills>\n${body}\n</available_skills>`;
}

export function buildSkillCatalog(skills: Map<string, SkillRecord>): {
  xml: string;
  names: string[];
} {
  const names = [...skills.keys()].sort();
  return {
    xml: buildSkillCatalogXml(names.map((name) => skills.get(name)!)),
    names,
  };
}
