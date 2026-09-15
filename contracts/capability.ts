import {z} from 'zod';
import {
  capabilitySchema,
  outroCapabilitySchema,
  sceneRoleSchema,
  toJsonSchema
} from './storyboard.ts';

export const capabilityIds = [
  'motion.symbol',
  'motion.diagram',
  'chart.metrics',
  'classic.card',
  'classic.flow',
  'story.readAlong',
  'typography.stage',
  'media.fullScene',
  'outro.brand'
] as const;

export const capabilityIdSchema = z.enum(capabilityIds);
export const capabilityTierSchema = z.enum(['builtin', 'verified', 'shared', 'local']);
export const capabilityStatusSchema = z.enum(['accepted', 'experimental']);
export const capabilityPackageIdSchema = z.string()
  .min(3)
  .max(100)
  .regex(/^(?!(?:__proto__|constructor|prototype)(?:\.|$))[a-z][a-zA-Z0-9-]*(?:\.[a-z][a-zA-Z0-9-]*)+$/);

const jsonObjectSchema = z.record(z.string(), z.unknown());

export const capabilityWhenSchema = z.strictObject({
  use: z.array(z.string().min(1)).min(1),
  avoid: z.array(z.string().min(1)).min(1),
  roles: z.array(sceneRoleSchema).min(1)
});

export const capabilityAssetSchema = z.strictObject({
  slot: z.string().min(1),
  kind: z.enum(['image', 'video', 'audio', 'font', 'data']),
  optional: z.boolean(),
  note: z.string()
});

export const capabilityConstraintsSchema = z.strictObject({
  aspect: z.array(z.enum(['16:9', '9:16'])).min(1),
  minSeconds: z.number().finite().nonnegative(),
  maxSeconds: z.number().finite().positive(),
  languages: z.array(z.string().min(2)).min(1)
}).superRefine((value, context) => {
  if (value.maxSeconds < value.minSeconds) {
    context.addIssue({
      code: 'custom',
      path: ['maxSeconds'],
      message: 'maxSeconds must be greater than or equal to minSeconds'
    });
  }
});

export const capabilityTimingSchema = z.strictObject({
  enter: z.string(),
  hold: z.string(),
  exit: z.string()
});

/**
 * Examples retain a real legacy scene (or board for board-level capabilities)
 * plus the settings needed to normalize it. `source` is repository-relative so
 * tests and authoring tools can trace the example back to its original job.
 */
export const capabilityExampleSchema = z.strictObject({
  source: z.string().min(1),
  scene: jsonObjectSchema.optional(),
  board: jsonObjectSchema.optional(),
  settings: jsonObjectSchema
}).superRefine((value, context) => {
  if ((value.scene === undefined) === (value.board === undefined)) {
    context.addIssue({
      code: 'custom',
      path: [],
      message: 'an example must contain exactly one of scene or board'
    });
  }
});

export const capabilityAntiExampleSchema = z.strictObject({
  why: z.string().min(1),
  scene: jsonObjectSchema
});

export const capabilityAuthorSchema = z.strictObject({
  name: z.string().min(1),
  fingerprint: z.string()
});

export const capabilityImplementationSchema = z.strictObject({
  kind: z.enum(['component', 'declarative', 'lottie']),
  ref: z.string().min(1)
});

export const capabilityPackageSchema = z.strictObject({
  id: capabilityPackageIdSchema,
  version: z.number().int().min(1),
  tier: capabilityTierSchema,
  name: z.string().min(1),
  summary: z.string().min(1),
  when: capabilityWhenSchema,
  inputs: jsonObjectSchema,
  assets: z.array(capabilityAssetSchema),
  constraints: capabilityConstraintsSchema,
  timing: capabilityTimingSchema,
  examples: z.array(capabilityExampleSchema).min(1),
  antiExamples: z.array(capabilityAntiExampleSchema).optional(),
  golden: z.array(z.string().min(1)),
  status: capabilityStatusSchema,
  license: z.string().min(1),
  author: capabilityAuthorSchema,
  implementation: capabilityImplementationSchema,
  aliases: z.array(z.string().min(1)).optional(),
  authoringGuide: z.array(z.string().min(1)).optional(),
  notes: z.string().min(1).optional()
});

export type CapabilityId = z.infer<typeof capabilityIdSchema>;
export type CapabilityPackage = z.infer<typeof capabilityPackageSchema>;

function paramsSchemaFromBranch(branch: Record<string, unknown>): Record<string, unknown> | null {
  const properties = branch.properties as Record<string, Record<string, unknown>> | undefined;
  const params = properties?.params;
  return params ? structuredClone(params) : null;
}

/**
 * Returns the local params JSON Schema already defined by storyboard.ts.
 * Registry code can use this instead of maintaining another parameter contract.
 */
export function getCapabilityInputsSchema(id: CapabilityId): Record<string, unknown> {
  const source = toJsonSchema(id === 'outro.brand' ? outroCapabilitySchema : capabilitySchema);
  if (id === 'outro.brand') {
    const params = paramsSchemaFromBranch(source);
    if (params) return params;
  } else {
    const branches = source.anyOf as Record<string, unknown>[] | undefined;
    for (const branch of branches ?? []) {
      const properties = branch.properties as Record<string, Record<string, unknown>> | undefined;
      if (properties?.id?.const === id) {
        const params = paramsSchemaFromBranch(branch);
        if (params) return params;
      }
    }
  }
  throw new Error(`No storyboard params schema found for capability: ${id}`);
}

export const capabilityInputsSchemas = Object.fromEntries(
  capabilityIds.map((id) => [id, getCapabilityInputsSchema(id)])
) as Record<CapabilityId, Record<string, unknown>>;
