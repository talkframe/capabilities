import {z} from 'zod';
import {toJsonSchema} from './storyboard.ts';

const supportedDimensionSchema = z.union([
  z.literal(1920), z.literal(1080), z.literal(1280), z.literal(720)
]);
const fpsSchema = z.union([z.literal(24), z.literal(25), z.literal(30)]);
const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const recordKeySchema = z.string().min(1).max(100).regex(/^(?!(?:__proto__|constructor|prototype)$)[\w-]+$/);
const assetIdSchema = z.string().regex(/^[a-f0-9]{24}-[a-f0-9]{12}$/);
const localMusicFileSchema = z.string().regex(/^(?:$|(?!\.)[^/\\]+)$/);

export const settingsThemeSchema = z.looseObject({
  background: hexColorSchema,
  accent: hexColorSchema,
  text: hexColorSchema,
  muted: hexColorSchema
});

export const sceneAssetSelectionSchema = z.strictObject({
  assetId: assetIdSchema,
  fit: z.enum(['contain', 'cover']).optional()
});

const baseSettingsSchema = z.looseObject({
  width: supportedDimensionSchema,
  height: supportedDimensionSchema,
  fps: fpsSchema,
  targetSeconds: z.number().finite().min(30).max(1800),
  voice: z.string().min(1).max(100),
  speechRate: z.number().finite().min(120).max(360),
  narration: z.boolean(),
  presenter: z.boolean(),
  visualStyle: z.enum(['motion', 'classic', 'story', 'typography']).optional(),
  typographyPreset: z.enum(['poetry', 'science']).optional(),
  brandOutro: z.enum(['off', 'ignite', 'ribbon', 'ember']).optional(),
  musicFile: localMusicFileSchema.optional(),
  musicVolume: z.number().finite().min(0).max(0.5),
  concurrency: z.number().finite().min(1).max(8),
  theme: settingsThemeSchema,
  direction: z.string().max(1500).optional(),
  sceneHolds: z.record(recordKeySchema, z.number().finite().min(0).max(8)).optional(),
  maxDurationSeconds: z.number().finite().min(10).max(1800).nullish(),
  sceneAssets: z.record(recordKeySchema, sceneAssetSelectionSchema).optional(),
  templateId: z.string().regex(/^[a-z][a-z0-9-]{0,49}$/).nullish()
});

export const settingsSchema = baseSettingsSchema.superRefine((settings, context) => {
  if (settings.sceneAssets && Object.keys(settings.sceneAssets).length > 120) {
    context.addIssue({code: 'custom', path: ['sceneAssets'], message: 'at most 120 scene assets are allowed'});
  }
  if (settings.visualStyle === 'classic' && settings.sceneAssets && Object.keys(settings.sceneAssets).length > 0) {
    context.addIssue({code: 'custom', path: ['sceneAssets'], message: 'classic profile does not accept scene assets'});
  }
});

export const settingsJsonSchema = (() => {
  const schema = toJsonSchema(settingsSchema);
  const properties = schema.properties as Record<string, Record<string, unknown>>;
  properties.sceneAssets.maxProperties = 120;
  schema.allOf = [{
    if: {properties: {visualStyle: {const: 'classic'}}, required: ['visualStyle']},
    then: {properties: {sceneAssets: {maxProperties: 0}}}
  }];
  return schema;
})();
export type VideoSettings = z.infer<typeof settingsSchema>;
