import {z} from 'zod';

export const visualKinds = [
  'wallet',
  'key',
  'network',
  'coins',
  'lock',
  'compare',
  'shield',
  'globe',
  'book',
  'rocket'
] as const;

export const visualKindSchema = z.enum(visualKinds);

export type VisualKind = z.infer<typeof visualKindSchema>;
