import { parseModelOverride, type ModelSpec } from '@memoss/core';

export function resolveModelArgs(args: {
  model?: string;
  baseUrl?: string;
}): ModelSpec | undefined {
  if (!args.model) {
    return undefined;
  }
  return parseModelOverride(args.model, args.baseUrl);
}
