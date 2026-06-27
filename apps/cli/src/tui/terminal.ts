/** True when stdin/stdout are TTYs suitable for Ink raw-mode input. */
export function isInteractiveTerminal(
  stdin: NodeJS.ReadStream = process.stdin,
  stdout: NodeJS.WriteStream = process.stdout,
): boolean {
  return Boolean(stdin.isTTY && stdout.isTTY);
}

/** Node major versions tested in CI (20 LTS, 22 LTS, 24 LTS). */
export const SUPPORTED_NODE_MAJORS = [20, 22, 24] as const;

export function isSupportedNodeVersion(
  version = process.versions.node,
): boolean {
  const major = Number.parseInt(version.split('.')[0] ?? '', 10);
  return (
    Number.isFinite(major) &&
    major >= 20 &&
    (SUPPORTED_NODE_MAJORS as readonly number[]).includes(major)
  );
}
