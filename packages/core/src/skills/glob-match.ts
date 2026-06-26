function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

/** Simple glob match (`*` = any chars). Case-insensitive. */
export function matchGlob(pattern: string, value: string): boolean {
  const normalized = pattern.trim();
  if (!normalized) {
    return false;
  }

  let regex = '^';
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    if (char === '*') {
      regex += '.*';
      continue;
    }
    regex += escapeRegex(char);
  }
  regex += '$';

  return new RegExp(regex, 'i').test(value);
}

export function resolveSkillOverride(
  source: string,
  overrides: Record<string, string>,
): string | undefined {
  const matches = Object.entries(overrides)
    .filter(([pattern]) => matchGlob(pattern, source))
    .sort((left, right) => right[0].length - left[0].length);

  return matches[0]?.[1];
}
