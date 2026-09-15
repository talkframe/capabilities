import {z} from 'zod';
import {visualKindSchema} from './visuals.ts';

export const MAX_TRANSITIONS = 120;
const MAX_ARRAY_ITEMS = 4_294_967_295;

export const transitionKinds = ['cut', 'crossfade', 'handoff', 'wipe'] as const;
export const transitionOverlaps = ['anchor', 'trim'] as const;
export const transitionEasings = ['smoothstep'] as const;
export const transitionElementNames = [
  'background',
  'kicker',
  'title',
  'bullets',
  'particles',
  'captions'
] as const;

export const transitionKindSchema = z.enum(transitionKinds);
export const transitionOverlapSchema = z.enum(transitionOverlaps).default('anchor');
export const transitionEasingSchema = z.enum(transitionEasings);
export const transitionElementNameSchema = z.enum(transitionElementNames);
export const transitionVisualSchema = z.union([visualKindSchema, z.literal('scatter')]);

export const transitionMorphSchema = z.strictObject({
  from: transitionVisualSchema,
  to: transitionVisualSchema
});

export const sharedElementSchema = z.strictObject({
  from: transitionElementNameSchema,
  to: transitionElementNameSchema,
  morph: transitionMorphSchema.optional()
});

export const sharedElementInputSchema = z.union([
  transitionElementNameSchema,
  sharedElementSchema
]);

export const lightPhaseSchema = z.strictObject({
  from: z.boolean(),
  to: z.boolean()
});

export const wipeParamsSchema = z.strictObject({
  direction: z.enum(['left', 'right', 'up', 'down']).default('left'),
  feather: z.number().finite().min(0).max(1).default(0)
});

export const handoffParamsSchema = z.strictObject({
  lightPhase: lightPhaseSchema.optional()
});

export const emptyTransitionParamsSchema = z.strictObject({});

const locatorShape = {
  after: z.number().int().nonnegative().optional(),
  between: z.tuple([z.string().min(1), z.string().min(1)]).optional()
};

const commonShape = {
  overlap: transitionOverlapSchema,
  sharedElements: z.array(sharedElementInputSchema).min(0).max(transitionElementNames.length).optional(),
  easing: transitionEasingSchema.optional(),
  transitionVisual: transitionVisualSchema.optional()
};

const withExclusiveLocator = <T extends z.ZodType>(schema: T) => schema.superRefine(
  (value: z.output<T>, context) => {
    const candidate = value as {after?: number; between?: [string, string]};
    if ((candidate.after === undefined) === (candidate.between === undefined)) {
      context.addIssue({
        code: 'custom',
        path: [],
        message: 'exactly one of after or between is required'
      });
    }
  }
);

export const cutTransitionSchema = withExclusiveLocator(z.strictObject({
  kind: z.literal('cut'),
  ...locatorShape,
  ...commonShape,
  duration: z.literal(0),
  params: emptyTransitionParamsSchema.optional()
}));

export const crossfadeTransitionSchema = withExclusiveLocator(z.strictObject({
  kind: z.literal('crossfade'),
  ...locatorShape,
  ...commonShape,
  duration: z.number().finite().positive(),
  params: emptyTransitionParamsSchema.optional()
}));

export const handoffTransitionSchema = withExclusiveLocator(z.strictObject({
  kind: z.literal('handoff'),
  ...locatorShape,
  ...commonShape,
  duration: z.number().finite().positive(),
  sharedElements: z.array(sharedElementInputSchema).min(1).max(transitionElementNames.length),
  params: handoffParamsSchema.optional()
}));

export const wipeTransitionSchema = withExclusiveLocator(z.strictObject({
  kind: z.literal('wipe'),
  ...locatorShape,
  ...commonShape,
  duration: z.number().finite().positive(),
  params: wipeParamsSchema.optional()
}));

export const transitionSchema = z.union([
  cutTransitionSchema,
  crossfadeTransitionSchema,
  handoffTransitionSchema,
  wipeTransitionSchema
]);

export const transitionsSchema = z.array(transitionSchema).min(0).max(MAX_TRANSITIONS);
export const transitionDeclarationSchema = transitionSchema;
export const transitionDeclarationsSchema = transitionsSchema;

const transitionOutCommonShape = {
  ...commonShape
};

export const transitionOutSchema = z.union([
  z.strictObject({
    kind: z.literal('cut'),
    ...transitionOutCommonShape,
    duration: z.literal(0),
    params: emptyTransitionParamsSchema.optional()
  }),
  z.strictObject({
    kind: z.literal('crossfade'),
    ...transitionOutCommonShape,
    duration: z.number().finite().positive(),
    params: emptyTransitionParamsSchema.optional()
  }),
  z.strictObject({
    kind: z.literal('handoff'),
    ...transitionOutCommonShape,
    duration: z.number().finite().positive(),
    sharedElements: z.array(sharedElementInputSchema).min(1).max(transitionElementNames.length),
    params: handoffParamsSchema.optional()
  }),
  z.strictObject({
    kind: z.literal('wipe'),
    ...transitionOutCommonShape,
    duration: z.number().finite().positive(),
    params: wipeParamsSchema.optional()
  })
]);

export const transitionDeclarationSourcesSchema = z.looseObject({
  transitions: transitionsSchema.optional(),
  scenes: z.array(z.looseObject({transitionOut: transitionOutSchema.optional()})).min(0).max(MAX_ARRAY_ITEMS)
}).superRefine((value, context) => {
  if (value.transitions !== undefined && value.scenes.some((scene) => scene.transitionOut !== undefined)) {
    context.addIssue({
      code: 'custom',
      path: ['transitions'],
      message: 'top-level transitions and scene transitionOut declarations are mutually exclusive'
    });
  }
});

export const withTransitionDeclarationExclusivity = <T extends z.ZodType>(schema: T) =>
  schema.superRefine((value: z.output<T>, context) => {
    const candidate = value as {transitions?: unknown; scenes?: Array<{transitionOut?: unknown}>};
    if (candidate.transitions !== undefined && candidate.scenes?.some((scene) => scene.transitionOut !== undefined)) {
      context.addIssue({
        code: 'custom',
        path: ['transitions'],
        message: 'top-level transitions and scene transitionOut declarations are mutually exclusive'
      });
    }
  });

export const timelineRangeSchema = z.strictObject({
  transitionIndex: z.number().int().nonnegative(),
  start: z.number().int(),
  end: z.number().int()
});

export const timelineSegmentSchema = z.strictObject({
  index: z.number().int().nonnegative(),
  sceneId: z.string().min(1),
  start: z.number().int().nonnegative(),
  end: z.number().int().positive(),
  durationInFrames: z.number().int().positive(),
  visibleStart: z.number().int(),
  overlapIn: timelineRangeSchema.nullable(),
  overlapOut: timelineRangeSchema.nullable(),
  exclusiveStart: z.number().int().nonnegative(),
  exclusiveEnd: z.number().int().nonnegative()
});

export const resolvedTransitionSchema = z.strictObject({
  index: z.number().int().nonnegative(),
  kind: transitionKindSchema,
  overlap: z.enum(transitionOverlaps),
  from: z.string().min(1),
  to: z.string().min(1),
  outIndex: z.number().int().nonnegative(),
  inIndex: z.number().int().nonnegative().nullable(),
  duration: z.number().finite().nonnegative(),
  durationInFrames: z.number().int().nonnegative(),
  sharedElements: z.array(sharedElementSchema).min(0).max(transitionElementNames.length),
  params: z.union([emptyTransitionParamsSchema, handoffParamsSchema, wipeParamsSchema]),
  easing: transitionEasingSchema,
  transitionVisual: transitionVisualSchema.nullable(),
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative()
});

export const captionOverlapWarningSchema = z.union([
  z.strictObject({
    code: z.literal('CAPTION_IN_OVERLAP'),
    side: z.literal('outgoing'),
    scene: z.string().min(1),
    caption: z.string(),
    captionEnd: z.number().finite(),
    overlapLocalStart: z.number().int().nonnegative()
  }),
  z.strictObject({
    code: z.literal('CAPTION_IN_OVERLAP'),
    side: z.literal('incoming'),
    scene: z.string().min(1),
    caption: z.string(),
    captionStart: z.number().finite(),
    overlapLocalEnd: z.number().int().nonnegative()
  })
]);

export const timelineBrandOutroSchema = z.strictObject({
  variant: z.enum(['ignite', 'ribbon', 'ember']),
  version: z.union([z.literal(4), z.literal(5)]).optional(),
  durationInFrames: z.number().int().positive(),
  start: z.number().int().nonnegative(),
  visibleStart: z.number().int(),
  originalStart: z.number().int().nonnegative(),
  end: z.number().int().positive()
});

export const compiledTimelineSchema = z.strictObject({
  policy: z.enum(transitionOverlaps),
  fps: z.number().int().positive(),
  segments: z.array(timelineSegmentSchema).min(0).max(MAX_ARRAY_ITEMS),
  transitions: z.array(resolvedTransitionSchema).min(0).max(MAX_TRANSITIONS),
  brandOutro: timelineBrandOutroSchema.nullable(),
  totalDurationInFrames: z.number().int().nonnegative(),
  contentDurationInFrames: z.number().int().nonnegative(),
  warnings: z.array(captionOverlapWarningSchema).min(0).max(MAX_ARRAY_ITEMS).optional()
});

export type TransitionKind = z.infer<typeof transitionKindSchema>;
export type TransitionOverlap = z.infer<typeof transitionOverlapSchema>;
export type TransitionEasing = z.infer<typeof transitionEasingSchema>;
export type TransitionVisual = z.infer<typeof transitionVisualSchema>;
export type SharedElement = z.infer<typeof sharedElementSchema>;
export type TransitionDeclarationInput = z.input<typeof transitionSchema>;
export type TransitionDeclaration = z.output<typeof transitionSchema>;
export type TransitionOutInput = z.input<typeof transitionOutSchema>;
export type TransitionOut = z.output<typeof transitionOutSchema>;
export type TimelineRange = z.infer<typeof timelineRangeSchema>;
export type TimelineSegment = z.infer<typeof timelineSegmentSchema>;
export type ResolvedTransition = z.infer<typeof resolvedTransitionSchema>;
export type CaptionOverlapWarning = z.infer<typeof captionOverlapWarningSchema>;
export type TimelineBrandOutro = z.infer<typeof timelineBrandOutroSchema>;
export type CompiledTimeline = z.infer<typeof compiledTimelineSchema>;
