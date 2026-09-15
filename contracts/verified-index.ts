import {z} from 'zod';
import {capabilityPackageIdSchema} from './capability.ts';

export const capabilityLevelSchema = z.enum(['L1', 'L2', 'L3']);

/**
 * Public indexes describe where metadata came from. The registry normalizes all
 * entries from an explicitly configured, trusted index to the runtime
 * `verified` tier instead of treating this source field as an execution grant.
 */
export const verifiedIndexEntrySchema = z.strictObject({
  id: capabilityPackageIdSchema,
  version: z.number().int().min(1),
  tier: z.enum(['builtin', 'verified']),
  level: capabilityLevelSchema,
  name: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  license: z.enum(['MIT', 'CC-BY-4.0']),
  sourceCommit: z.string().regex(/^[0-9a-f]{40}$/i, 'sourceCommit must be a full Git commit hash')
});

export const verifiedIndexSchema = z.strictObject({
  schemaVersion: z.literal(1),
  capabilities: z.array(verifiedIndexEntrySchema)
}).superRefine((index, context) => {
  const seen = new Set<string>();
  index.capabilities.forEach((entry, position) => {
    const key = `${entry.id}@${entry.version}`;
    if (seen.has(key)) {
      context.addIssue({
        code: 'custom',
        path: ['capabilities', position],
        message: `duplicate capability version: ${key}`
      });
    }
    seen.add(key);
  });
});

export type CapabilityLevel = z.infer<typeof capabilityLevelSchema>;
export type VerifiedIndexEntry = z.infer<typeof verifiedIndexEntrySchema>;
export type VerifiedIndex = z.infer<typeof verifiedIndexSchema>;
