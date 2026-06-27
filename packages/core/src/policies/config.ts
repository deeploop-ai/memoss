import { z } from 'zod';

export const policyActionSchema = z.enum(['error', 'warn', 'off']);

export type PolicyAction = z.infer<typeof policyActionSchema>;

export const DEFAULT_REFERENCE_SLUG_BLOCKLIST = [
  'overview',
  'intro',
  'introduction',
  'getting-started',
  'quickstart',
  'tutorial',
  'walkthrough',
  'release-notes',
  'changelog',
  'roadmap',
  'faq',
] as const;

export const policiesConfigSchema = z.object({
  augment: z
    .object({
      require_read_before_write: z.boolean().default(true),
      preserve_headings: policyActionSchema.default('error'),
      preserve_resource_field: policyActionSchema.default('error'),
      body_shrink_threshold: z.number().min(0).max(1).default(0.3),
      body_shrink_action: policyActionSchema.default('warn'),
    })
    .default({
      require_read_before_write: true,
      preserve_headings: 'error',
      preserve_resource_field: 'error',
      body_shrink_threshold: 0.3,
      body_shrink_action: 'warn',
    }),
  reference_mint: z
    .object({
      enabled: z.boolean().default(true),
      gate_mode: z.enum(['block', 'warn', 'off']).default('warn'),
      slug_blocklist: z
        .array(z.string())
        .default([...DEFAULT_REFERENCE_SLUG_BLOCKLIST]),
    })
    .default({
      enabled: true,
      gate_mode: 'warn',
      slug_blocklist: [...DEFAULT_REFERENCE_SLUG_BLOCKLIST],
    }),
  citation: z
    .object({
      require_section: policyActionSchema.default('warn'),
    })
    .default({ require_section: 'warn' }),
  provenance: z
    .object({
      track_affects: z.boolean().default(true),
      stale_check_on_lint: policyActionSchema.default('warn'),
    })
    .default({ track_affects: true, stale_check_on_lint: 'warn' }),
  confirm: z
    .object({
      ingest: z.enum(['always', 'auto']).default('always'),
    })
    .default({ ingest: 'always' }),
});

export type PoliciesConfig = z.infer<typeof policiesConfigSchema>;

export function parsePoliciesConfig(data: unknown): PoliciesConfig {
  return policiesConfigSchema.parse(data ?? {});
}
