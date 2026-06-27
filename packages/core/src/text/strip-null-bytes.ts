/** Remove embedded NUL bytes from extracted text (common in PDF parsers). */
export function stripNullBytes(text: string): string {
  return text.includes('\0') ? text.replaceAll('\0', '') : text;
}
