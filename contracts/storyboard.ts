import {z} from 'zod';
import {transitionOutSchema, transitionsSchema, withTransitionDeclarationExclusivity} from './transitions.ts';
import {visualKinds, visualKindSchema} from './visuals.ts';
export {visualKinds, visualKindSchema} from './visuals.ts';

export const MAX_ARRAY_ITEMS = 4_294_967_295;
export const MAX_SCENES = 120;

const boundedArray = <T extends z.ZodType>(item: T, max = MAX_ARRAY_ITEMS) =>
  z.array(item).min(0).max(max);

const reservedKeyPattern = /^(?!(?:__proto__|constructor|prototype)$)[a-zA-Z0-9_-]+$/;
const reservedMediaPattern = /^(?!(?:__proto__|constructor|prototype)$)[a-zA-Z0-9_-]{0,80}$/;
const assetIdPattern = /^(?!(?:__proto__|constructor|prototype)$)[a-zA-Z0-9_-]{1,100}$/;
const assetSlotPattern = /^(?!(?:__proto__|constructor|prototype)$)[a-zA-Z0-9_.\[\]-]{1,120}$/;

export const sceneTypes = ['intro', 'keypoints', 'flow', 'chart', 'comparison', 'outro'] as const;
export const sceneRoles = sceneTypes;
export const profiles = ['motion', 'classic', 'story', 'typography'] as const;
export const diagramLayouts = ['split', 'hub', 'pipeline', 'sequence'] as const;
export const diagramTones = ['light', 'dark'] as const;
export const diagramNodeKinds = ['screen', 'person', 'server', 'audience', 'segment', 'document', 'card'] as const;

export const sceneTypeSchema = z.enum(sceneTypes);
export const sceneRoleSchema = z.enum(sceneRoles);
export const profileSchema = z.enum(profiles);
export const diagramNodeIdSchema = z.string().min(1).max(40).regex(reservedKeyPattern);
export const diagramMediaSchema = z.string().max(80).regex(reservedMediaPattern);

export const diagramNodeSchema = z.strictObject({
  id: diagramNodeIdSchema,
  kind: z.enum(diagramNodeKinds),
  label: z.string().min(1).max(20),
  detail: z.string().max(36),
  media: diagramMediaSchema
});

export const diagramEdgeSchema = z.strictObject({
  from: diagramNodeIdSchema,
  to: diagramNodeIdSchema,
  label: z.string().max(24),
  direction: z.enum(['forward', 'both'])
});

export const sceneDiagramObjectSchema = z.strictObject({
  layout: z.enum(diagramLayouts),
  tone: z.enum(diagramTones),
  emphasis: z.string().max(60),
  nodes: boundedArray(diagramNodeSchema, 5).min(2),
  edges: boundedArray(diagramEdgeSchema, 8)
});

export const sceneDiagramSchema = sceneDiagramObjectSchema.nullable();
export const metricSchema = z.strictObject({label: z.string(), value: z.number(), unit: z.string()});

export const sceneBase = {
  id: z.string(),
  type: sceneTypeSchema,
  kicker: z.string(),
  title: z.string(),
  bullets: boundedArray(z.string()),
  narration: z.string(),
  sourceQuote: z.string(),
  nodes: boundedArray(z.string()),
  metrics: boundedArray(metricSchema)
};

/** The original strict v1 scene used for structured AI output. */
export const sceneSchema = z.strictObject({
  ...sceneBase,
  visual: visualKindSchema,
  diagram: sceneDiagramSchema
});

/** The local compatibility boundary: early jobs may omit visual and diagram. */
export const sceneSchemaLegacyV1 = z.strictObject({
  ...sceneBase,
  visual: visualKindSchema.optional(),
  diagram: sceneDiagramSchema.optional()
});

const boardFields = {
  title: z.string(),
  subtitle: z.string(),
  sourceTitle: z.string(),
  sourceUrl: z.string()
};

export const storyboardSchema = z.strictObject({
  ...boardFields,
  scenes: boundedArray(sceneSchema)
});

export const storyboardSchemaLegacyV1 = z.strictObject({
  ...boardFields,
  scenes: boundedArray(sceneSchemaLegacyV1)
});

export const sentenceSchema = z.strictObject({
  id: z.string().min(1).max(100).regex(reservedKeyPattern),
  text: z.string()
});

export const sceneAssetSchema = z.strictObject({
  slot: z.string().regex(assetSlotPattern),
  assetId: z.string().regex(assetIdPattern),
  fit: z.enum(['contain', 'cover'])
});

const capabilityHeaderAi = {
  version: z.number().int().min(1).nullable()
};

const capabilityAi = <I extends string, T extends z.ZodRawShape>(id: I, params: T) => z.strictObject({
  id: z.literal(id),
  ...capabilityHeaderAi,
  params: z.strictObject(params)
});

const capabilityLocal = <I extends string, T extends z.ZodRawShape>(id: I, params: T) => z.strictObject({
  id: z.literal(id),
  version: z.number().int().min(1).nullable().optional(),
  params: z.strictObject(params)
});

const emptyParams = {};
const nodesParam = boundedArray(z.string(), 5);
const metricsParam = boundedArray(metricSchema, 4).min(1);

const motionSymbolParamsAi = {
    visual: visualKindSchema,
    nodes: nodesParam,
    metrics: boundedArray(metricSchema, 4)
};
const motionDiagramParamsAi = {
    layout: z.enum(diagramLayouts),
    tone: z.enum(diagramTones),
    emphasis: z.string().max(60),
    nodes: boundedArray(diagramNodeSchema, 5).min(2),
    edges: boundedArray(diagramEdgeSchema, 8),
    transitionVisual: visualKindSchema.nullable()
};
const mediaFullSceneParamsAi = {
    visual: visualKindSchema.nullable(),
    nodes: nodesParam,
    metrics: boundedArray(metricSchema, 4)
};
const physicsOrbitParams = {
  trails: z.boolean()
};
const physicsMomentum1DParams = {
  m1: z.number().positive().max(1000),
  m2: z.number().positive().max(1000),
  v1: z.number().min(-100).max(100),
  v2: z.number().min(-100).max(100),
  e: z.number().min(0).max(1),
  trails: z.boolean(),
  formula: z.boolean()
};
const geometrySolarAngleParams = {
  phase: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  lowElevation: z.number().min(20).max(90),
  highElevation: z.number().min(20).max(90),
  formula: z.boolean(),
  angleLabels: z.boolean()
};
const dimensionLadderStepSchema = z.strictObject({
  dim: z.number().int().min(0).max(4),
  id: z.string(),
  previous: z.string().nullable(),
  sentence: z.string(),
  x: z.number(),
  scale: z.number(),
  color: z.string()
});
const geometryDimensionLadderParams = {
  steps: boundedArray(dimensionLadderStepSchema, 5).min(1)
};

const storyWolfCryParams = {
  beat: z.number().int().min(0).max(5),
  sheepCount: z.number().int().min(4).max(8),
  villagerCount: z.number().int().min(3).max(6)
};

export const capabilityAiSchema = z.union([
  capabilityAi('motion.symbol', motionSymbolParamsAi),
  capabilityAi('motion.diagram', motionDiagramParamsAi),
  capabilityAi('physics.orbit', physicsOrbitParams),
  capabilityAi('physics.momentum1D', physicsMomentum1DParams),
  capabilityAi('story.wolfCry', storyWolfCryParams),
  capabilityAi('geometry.dimensionLadder', geometryDimensionLadderParams),
  capabilityAi('chart.metrics', {metrics: metricsParam}),
  capabilityAi('classic.card', emptyParams),
  capabilityAi('classic.flow', {nodes: nodesParam.min(2)}),
  capabilityAi('story.readAlong', emptyParams),
  capabilityAi('typography.stage', emptyParams),
  capabilityAi('media.fullScene', mediaFullSceneParamsAi),
  capabilityAi('geometry.solarAngle', geometrySolarAngleParams)
]);

const localMotionDiagramCapability = capabilityLocal('motion.diagram', {
  ...motionDiagramParamsAi,
  transitionVisual: visualKindSchema.nullable().optional()
}).superRefine((value, context) => {
  if (value.params.layout === 'split' && value.params.nodes.length > 3) {
    context.addIssue({code: 'custom', path: ['params', 'nodes'], message: 'split diagrams accept 2 to 3 nodes'});
  }
  if (value.params.layout === 'hub' && value.params.nodes.length < 3) {
    context.addIssue({code: 'custom', path: ['params', 'nodes'], message: 'hub diagrams accept 3 to 5 nodes'});
  }
});

export const capabilitySchema = z.union([
  capabilityLocal('motion.symbol', {
    visual: visualKindSchema,
    nodes: nodesParam.optional(),
    metrics: boundedArray(metricSchema, 4).optional()
  }),
  localMotionDiagramCapability,
  capabilityLocal('physics.orbit', physicsOrbitParams),
  capabilityLocal('physics.momentum1D', physicsMomentum1DParams),
  capabilityLocal('story.wolfCry', storyWolfCryParams),
  capabilityLocal('geometry.dimensionLadder', geometryDimensionLadderParams),
  capabilityLocal('chart.metrics', {metrics: metricsParam}),
  capabilityLocal('classic.card', emptyParams),
  capabilityLocal('classic.flow', {nodes: nodesParam.min(2)}),
  capabilityLocal('story.readAlong', emptyParams),
  capabilityLocal('typography.stage', emptyParams),
  capabilityLocal('media.fullScene', {
    visual: visualKindSchema.nullable().optional(),
    nodes: nodesParam.optional(),
    metrics: boundedArray(metricSchema, 4).optional()
  }),
  capabilityLocal('geometry.solarAngle', geometrySolarAngleParams)
]);

export const outroCapabilityAiSchema = capabilityAi('outro.brand', {
  variant: z.enum(['ignite', 'ribbon', 'ember']).nullable(),
  version: z.union([z.literal(4), z.literal(5)]).nullable()
});

export const outroCapabilitySchema = capabilityLocal('outro.brand', {
  variant: z.enum(['ignite', 'ribbon', 'ember']).nullable().optional(),
  version: z.union([z.literal(4), z.literal(5)]).nullable().optional()
});

export const outroSchema = z.strictObject({capability: outroCapabilitySchema}).nullable();
export const outroAiSchema = z.strictObject({capability: outroCapabilityAiSchema}).nullable();
export const profileSettingsSchema = z.strictObject({
  typographyPreset: z.enum(['poetry', 'science']).nullable()
});

const v2LegacyFields = {
  type: sceneTypeSchema.optional(),
  visual: visualKindSchema.optional(),
  diagram: sceneDiagramSchema.optional(),
  nodes: boundedArray(z.string()).optional(),
  metrics: boundedArray(metricSchema).optional()
};

export const sceneSchemaV2 = z.strictObject({
  transitionOut: transitionOutSchema.optional(),
  id: z.string(),
  role: sceneRoleSchema,
  kicker: z.string(),
  title: z.string(),
  bullets: boundedArray(z.string()),
  narration: z.string(),
  sourceQuote: z.string(),
  capability: capabilitySchema,
  assets: boundedArray(sceneAssetSchema),
  sentences: boundedArray(sentenceSchema).min(1),
  ...v2LegacyFields
});

export const storyboardSchemaV2 = withTransitionDeclarationExclusivity(z.strictObject({
  transitions: transitionsSchema.optional(),
  contractVersion: z.literal(2),
  profile: profileSchema,
  profileSettings: profileSettingsSchema,
  outro: outroSchema,
  ...boardFields,
  scenes: boundedArray(sceneSchemaV2, MAX_SCENES).min(2)
}));

export const sceneSchemaAiV2 = z.strictObject({
  id: z.string(),
  role: sceneRoleSchema,
  kicker: z.string(),
  title: z.string(),
  bullets: boundedArray(z.string()),
  narration: z.string(),
  sourceQuote: z.string(),
  capability: capabilityAiSchema,
  assets: boundedArray(sceneAssetSchema),
  sentences: boundedArray(sentenceSchema).min(1)
});

export const storyboardSchemaAiV2 = z.strictObject({
  contractVersion: z.literal(2),
  profile: profileSchema,
  profileSettings: profileSettingsSchema,
  outro: outroAiSchema,
  ...boardFields,
  scenes: boundedArray(sceneSchemaAiV2, MAX_SCENES).min(2)
});

/** Runtime compatibility contract for v1 jobs enriched with optional v2 data. */
export const sceneSchemaLegacy = sceneSchemaLegacyV1.extend({
  transitionOut: transitionOutSchema.optional(),
  role: sceneRoleSchema.optional(),
  capability: capabilitySchema.optional(),
  assets: boundedArray(sceneAssetSchema).optional(),
  sentences: boundedArray(sentenceSchema).optional()
});

export const storyboardSchemaLegacy = withTransitionDeclarationExclusivity(storyboardSchemaLegacyV1.extend({
  transitions: transitionsSchema.optional(),
  contractVersion: z.literal(2).optional(),
  profile: profileSchema.optional(),
  profileSettings: profileSettingsSchema.optional(),
  outro: outroSchema.optional(),
  scenes: boundedArray(sceneSchemaLegacy)
}));

export const storyboardSchemaCompatible = storyboardSchemaLegacy;

export interface BuildAiSchemaOptions {
  legacy?: boolean;
}

function capabilityConditions(): Record<string, unknown>[] {
  return [{
    if: {
      type: 'object',
      properties: {
        capability: {type: 'object', properties: {id: {const: 'motion.diagram'}}, required: ['id']}
      },
      required: ['capability']
    },
    then: {
      type: 'object',
      properties: {
        capability: {
          type: 'object',
          properties: {
            params: {
              type: 'object',
              allOf: [
                {
                  if: {type: 'object', properties: {layout: {const: 'split'}}, required: ['layout']},
                  then: {type: 'object', properties: {nodes: {type: 'array', minItems: 2, maxItems: 3}}}
                },
                {
                  if: {type: 'object', properties: {layout: {const: 'hub'}}, required: ['layout']},
                  then: {type: 'object', properties: {nodes: {type: 'array', minItems: 3, maxItems: 5}}}
                }
              ]
            }
          }
        }
      }
    }
  }];
}

export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, {target: 'draft-7'}) as Record<string, unknown>;
  const rootProperties = json.properties as Record<string, Record<string, unknown>> | undefined;
  const scenes = rootProperties?.scenes;
  const item = scenes?.items as Record<string, unknown> | undefined;
  const itemProperties = item?.properties as Record<string, unknown> | undefined;
  if (itemProperties?.capability) item!.allOf = capabilityConditions();
  return json;
}

function removeUnsupportedAiKeywords(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  for (const keyword of ['oneOf', 'if', 'then', 'else', 'allOf', 'not']) delete record[keyword];
  if (typeof record.pattern === 'string' && /\(\?[=!<]/.test(record.pattern)) {
    record.pattern = record.pattern
      .replace(/^\^\(\?\!\(\?:__proto__\|constructor\|prototype\)\$\)/, '^');
  }
  for (const child of Object.values(record)) removeUnsupportedAiKeywords(child);
}

/**
 * AI-facing schema. The default is strict v2. The legacy option preserves the
 * current generator contract while storyboard production migrates separately.
 */
export function buildAiSchema(options: BuildAiSchemaOptions = {}): Record<string, unknown> {
  const schema = toJsonSchema(options.legacy ? storyboardSchema : storyboardSchemaAiV2);
  const properties = schema.properties as Record<string, Record<string, unknown>>;
  const scenes = properties.scenes;
  scenes.minItems = 2;
  scenes.maxItems = MAX_SCENES;
  removeUnsupportedAiKeywords(schema);
  return schema;
}

/** Local v2 schema keeps structural conditions that structured output omits. */
export function buildLocalSchema(): Record<string, unknown> {
  return toJsonSchema(storyboardSchemaV2);
}

export type Scene = z.infer<typeof sceneSchemaLegacy>;
export type Storyboard = z.infer<typeof storyboardSchemaCompatible>;
export type SceneV2 = z.infer<typeof sceneSchemaV2>;
export type StoryboardV2 = z.infer<typeof storyboardSchemaV2>;
