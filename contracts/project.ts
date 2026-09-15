import {z} from 'zod';
import {transitionsSchema, compiledTimelineSchema, withTransitionDeclarationExclusivity} from './transitions.ts';
import {
  MAX_ARRAY_ITEMS,
  sceneSchemaLegacy,
  storyboardSchemaLegacyV1
} from './storyboard.ts';

const boundedArray = <T extends z.ZodType>(item: T) => z.array(item).min(0).max(MAX_ARRAY_ITEMS);

export const captionSchema = z.strictObject({
  text: z.string(),
  startFrame: z.number(),
  endFrame: z.number()
});

export const timedSceneSchema = sceneSchemaLegacy.extend({
  durationInFrames: z.number(),
  audioSrc: z.string(),
  captions: boundedArray(captionSchema)
});

export const sceneMediaAssetSchema = z.strictObject({
  assetId: z.string(),
  src: z.string(),
  fit: z.enum(['contain', 'cover']),
  alt: z.string(),
  width: z.number(),
  height: z.number(),
  metadata: z.strictObject({
    kind: z.enum(['figma', 'web', 'local']),
    url: z.string(),
    title: z.string(),
    credit: z.string(),
    license: z.string(),
    description: z.string()
  })
});

export const videoProjectSchema = withTransitionDeclarationExclusivity(storyboardSchemaLegacyV1.omit({scenes: true}).extend({
  transitions: transitionsSchema.optional(),
  timeline: compiledTimelineSchema.optional(),
  scenes: boundedArray(timedSceneSchema),
  fps: z.number(),
  width: z.number(),
  height: z.number(),
  presenter: z.boolean(),
  visualStyle: z.enum(['motion', 'classic', 'story', 'typography']).optional(),
  typographyPreset: z.enum(['poetry', 'science']).optional(),
  brandOutro: z.strictObject({
    variant: z.enum(['ignite', 'ribbon', 'ember']),
    version: z.union([z.literal(4), z.literal(5)]).optional(),
    durationInFrames: z.number()
  }).optional(),
  sceneMedia: z.record(z.string(), sceneMediaAssetSchema).optional(),
  theme: z.strictObject({
    background: z.string(),
    accent: z.string(),
    text: z.string(),
    muted: z.string()
  }),
  music: z.strictObject({src: z.string(), volume: z.number()})
}));

export type Caption = z.infer<typeof captionSchema>;
export type TimedScene = z.infer<typeof timedSceneSchema>;
export type SceneMediaAsset = z.infer<typeof sceneMediaAssetSchema>;
export type VideoProject = z.infer<typeof videoProjectSchema>;
