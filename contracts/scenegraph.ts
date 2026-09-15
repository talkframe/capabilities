import {z} from 'zod';

/** Product limits are explicit rejection thresholds, not performance claims. */
export const DECLARATIVE_LIMITS = Object.freeze({
  objects: 4096,
  depth: 24,
  elements: 512,
  actions: 1024,
  list: 128,
  frames: 1800,
  scopeValues: 20000,
  stringLength: 2048,
  expressionFrameMs: 5,
  externalStateBytes: 256 * 1024
});

export type JsonValue = null | boolean | number | string | JsonValue[] | {[key: string]: JsonValue};
export type Expression = {$: string};
export type TypedPlaceholder = `{${string}}`;
export type StaticCondition = boolean | string;
/** The complete placeholder retains its source JSON type; embedded text does not. */
export type DeclarativeTemplate = JsonValue;
export type EachControl = {
  $each: {in: string | JsonValue[]; as: string; index?: string; template: {[key: string]: JsonValue} | JsonValue[]};
  if?: StaticCondition;
};

const forbidden = new Set(['__proto__', 'constructor', 'prototype']);
const finite = z.number().finite();
const id = z.string().min(1).max(128).regex(/^[A-Za-z_][A-Za-z0-9_.:-]*$/)
  .refine((value) => !value.split(/[.:-]/).some((part) => forbidden.has(part)), '危险的标识符');
const text = z.string().max(DECLARATIVE_LIMITS.stringLength);
const vec2 = z.tuple([finite, finite]);
const vec3 = z.tuple([finite, finite, finite]);
const vector = z.array(finite).min(2).max(4);
export type Vec3 = z.infer<typeof vec3>;

/** Bound plain JSON before a recursive schema sees it. Reject accessors without invoking them. */
export function inspectDeclarativeJson(value: unknown): string | null {
  const active = new Set<object>();
  let values = 0;
  let objects = 0;
  const visit = (item: unknown, depth: number): string | null => {
    if (++values > DECLARATIVE_LIMITS.scopeValues) return '数据值数量超过预算';
    if (depth > DECLARATIVE_LIMITS.depth) return '数据结构深度超过预算';
    if (typeof item === 'number') return Number.isFinite(item) ? null : '数值必须有限';
    if (typeof item === 'string') return item.length <= DECLARATIVE_LIMITS.stringLength ? null : '文本长度超过预算';
    if (item === null || typeof item === 'boolean') return null;
    if (typeof item !== 'object') return '只接受 JSON 数据';
    if (++objects > DECLARATIVE_LIMITS.objects) return '对象数量超过预算';
    if (active.has(item)) return '数据不能循环引用';
    if (!Array.isArray(item) && Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) return '只接受普通 JSON 对象';
    if (Array.isArray(item) && (item.length > DECLARATIVE_LIMITS.scopeValues || Object.keys(item).length !== item.length)) return '数组超过预算或存在空位';
    active.add(item);
    for (const key of Reflect.ownKeys(item)) {
      if (typeof key !== 'string' || forbidden.has(key)) return '数据含危险属性名';
      if (Array.isArray(item) && key === 'length') continue;
      if (Array.isArray(item) && !/^(0|[1-9]\d*)$/.test(key)) return '数组不能包含附加属性';
      const descriptor = Object.getOwnPropertyDescriptor(item, key);
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) return '数据不能包含访问器或隐藏属性';
      const error = visit(descriptor.value, depth + 1);
      if (error) return error;
    }
    active.delete(item);
    return null;
  };
  return visit(value, 0);
}

export const boundedDeclarativeJsonSchema = z.custom<JsonValue>((value) => inspectDeclarativeJson(value) === null, '数据必须为预算内的有限 JSON');
const jsonRecord = z.record(z.string().refine((key) => !forbidden.has(key)), boundedDeclarativeJsonSchema);
const localName = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/).refine((value) => value !== 'params' && !forbidden.has(value), '局部变量名不得遮蔽 params 或危险属性');
export const typedPlaceholderSchema = z.string().regex(/^\{[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*\}$/);
export const eachControlSchema = z.strictObject({
  $each: z.strictObject({
    in: z.union([text.min(1), z.array(boundedDeclarativeJsonSchema).max(DECLARATIVE_LIMITS.list)]),
    as: localName, index: localName.optional(),
    template: z.union([jsonRecord, z.array(jsonRecord).max(DECLARATIVE_LIMITS.list)])
  }),
  if: z.union([z.boolean(), text]).optional()
}).superRefine((control, ctx) => {
  if (control.$each.as === control.$each.index) ctx.addIssue({code: 'custom', path: ['$each', 'index'], message: '序号变量不能遮蔽当前项变量'});
});
export const expressionSchema = z.strictObject({$: z.string().min(1).max(512)});
const numeric = z.union([finite, expressionSchema]);
const numericVector = z.union([vector, expressionSchema]);

export const cameraSchema = z.strictObject({
  position: vec3,
  lookAt: vec3,
  fov: finite.gt(0).lt(180).optional(),
  near: finite.positive().optional(),
  far: finite.positive().optional()
}).superRefine((camera, ctx) => {
  if (camera.near !== undefined && camera.far !== undefined && camera.near >= camera.far) ctx.addIssue({code: 'custom', path: ['far'], message: '远裁剪面必须大于近裁剪面'});
});
export type Camera = z.infer<typeof cameraSchema>;

const scaleTime = {spaceScale: finite.positive().optional(), timeScale: finite.positive().optional()};
export const spaceSchema = z.discriminatedUnion('type', [
  z.strictObject({id, type: z.literal('space2d'), coordinates: z.enum(['pixels', 'normalized']).optional(), ...scaleTime}),
  z.strictObject({id, type: z.literal('space3d'), lengthUnit: text.min(1), handedness: z.literal('right'), camera: cameraSchema, ...scaleTime}),
  z.strictObject({id, type: z.literal('mathSpace'), xRange: vec2, yRange: vec2, unit: text.min(1), aspectLock: z.boolean().optional(), ...scaleTime})
]).superRefine((space, ctx) => {
  if (space.type === 'mathSpace') for (const name of ['xRange', 'yRange'] as const) {
    if (space[name][0] >= space[name][1]) ctx.addIssue({code: 'custom', path: [name], message: '坐标范围必须递增'});
  }
});
export type Space = z.infer<typeof spaceSchema>;

export const transformSchema = z.strictObject({
  x: numeric.optional(), y: numeric.optional(), position: numericVector.optional(),
  rotation: z.union([numeric, numericVector]).optional(), scale: z.union([numeric, numericVector]).optional()
});
export const elementTypes = ['text', 'formula', 'shape', 'image', 'group', 'axis', 'grid', 'body', 'trail', 'label'] as const;
export type ElementType = typeof elementTypes[number];
export type ExpandedElement = {
  id: string; type: ElementType; space?: string;
  transform?: z.infer<typeof transformSchema>;
  style?: Record<string, JsonValue>;
  props?: Record<string, JsonValue>;
  bind?: Record<string, Expression>;
  children?: ExpandedElement[];
};
export const expandedElementSchema: z.ZodType<ExpandedElement> = z.lazy(() => z.strictObject({
  id, type: z.enum(elementTypes), space: id.optional(), transform: transformSchema.optional(),
  style: jsonRecord.optional(), props: jsonRecord.optional(),
  bind: z.record(z.string().min(1).max(128), expressionSchema).optional(),
  children: z.array(expandedElementSchema).max(DECLARATIVE_LIMITS.elements).optional()
}));

export const anchorSchema = z.union([
  z.literal('sceneEnd'),
  z.strictObject({seconds: finite.nonnegative()}),
  z.strictObject({sentenceId: id, offset: finite.optional()}),
  z.strictObject({anchor: z.literal('sceneEnd'), offset: finite.optional()})
]);
export type TimelineAnchor = z.infer<typeof anchorSchema>;
export const actionTypes = ['enter', 'exit', 'move', 'rotate', 'scale', 'opacity', 'highlight', 'set', 'follow', 'camera'] as const;
export const timelineActionSchema = z.strictObject({
  target: z.union([id, z.literal('*')]), action: z.enum(actionTypes),
  at: anchorSchema.optional(), from: anchorSchema.optional(), until: anchorSchema.optional(),
  duration: finite.nonnegative().optional(), easing: z.enum(['linear', 'motion.settle']).optional(),
  preset: z.enum(['fade', 'riseSoft', 'handoff']).optional(), fromTarget: id.optional(),
  space: id.optional(), source: z.string().max(512).optional(), property: z.string().max(128).optional(),
  value: boundedDeclarativeJsonSchema.optional(), to: boundedDeclarativeJsonSchema.optional(), mode: z.literal('exclusive').optional()
}).superRefine((action, ctx) => {
  const issue = (path: string, message: string) => ctx.addIssue({code: 'custom', path: [path], message});
  if ((action.at === undefined) === (action.from === undefined)) issue('at', '动作必须且只能指定一个开始锚点');
  if (action.action === 'follow') {
    if (action.until === undefined) issue('until', 'follow 必须指定结束锚点');
    if (!action.source?.startsWith('sim.')) issue('source', 'follow 仅接受 sim 状态引用');
  } else if (action.duration === undefined) issue('duration', '动作必须指定时长');
  if (action.action === 'set' && (action.duration !== 0 || action.property === undefined || action.value === undefined)) issue('duration', 'set 必须指定属性和值，且时长为 0');
  if (['move', 'rotate', 'scale', 'opacity', 'camera'].includes(action.action) && action.to === undefined) issue('to', '动作必须指定完成值');
});
export type TimelineAction = z.infer<typeof timelineActionSchema>;

const sceneGraphShape = z.strictObject({
  spaces: z.array(spaceSchema).min(1).max(DECLARATIVE_LIMITS.list),
  elements: z.array(expandedElementSchema).max(DECLARATIVE_LIMITS.elements)
});
export const expandedSceneGraphSchema = z.unknown().refine((value) => inspectDeclarativeJson(value) === null, '数据必须为预算内的有限 JSON').pipe(sceneGraphShape).superRefine((scene, ctx) => {
  const ids = new Set<string>();
  const spaces = new Set<string>();
  for (const space of scene.spaces) {
    if (spaces.has(space.id)) ctx.addIssue({code: 'custom', path: ['spaces'], message: `空间 ID 重复：${space.id}`});
    spaces.add(space.id);
  }
  let count = 0;
  const visit = (elements: ExpandedElement[], parentSpace?: string) => {
    for (const element of elements) {
      if (++count > DECLARATIVE_LIMITS.elements) {ctx.addIssue({code: 'custom', path: ['elements'], message: '展开后元素数量超过预算'}); return;}
      if (ids.has(element.id)) ctx.addIssue({code: 'custom', path: ['elements'], message: `元素 ID 重复：${element.id}`});
      ids.add(element.id);
      const space = element.space ?? parentSpace;
      if (!space || !spaces.has(space)) ctx.addIssue({code: 'custom', path: ['elements'], message: `元素空间不存在：${element.id}`});
      if (parentSpace && space !== parentSpace) ctx.addIssue({code: 'custom', path: ['elements'], message: '不支持跨空间的父子组合'});
      if (element.children && element.type !== 'group') ctx.addIssue({code: 'custom', path: ['elements'], message: '只有 group 可以包含子元素'});
      visit(element.children ?? [], space);
    }
  };
  visit(scene.elements);
});
export type ExpandedSceneGraph = z.infer<typeof expandedSceneGraphSchema>;
export const expandedDeclarativeCapabilitySchema = z.object({
  id, version: z.number().int().positive().optional(), name: text.optional(), inputs: jsonRecord,
  scene: expandedSceneGraphSchema, timeline: z.array(timelineActionSchema).max(DECLARATIVE_LIMITS.actions).optional(),
  sims: jsonRecord.optional(), checks: z.array(jsonRecord).max(DECLARATIVE_LIMITS.list).optional(),
  implementation: z.object({kind: z.literal('declarative')}).optional()
}).passthrough();

export const geometrySchema = z.strictObject({
  vertices: z.array(z.array(finite).max(4)).min(1).max(16),
  edges: z.array(z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()])).max(32)
}).superRefine((geometry, ctx) => {
  if (geometry.edges.some((edge) => edge.some((index) => index >= geometry.vertices.length))) ctx.addIssue({code: 'custom', path: ['edges'], message: '几何边引用了不存在的顶点'});
  if (geometry.vertices.some((vertex) => vertex.length !== geometry.vertices[0].length)) ctx.addIssue({code: 'custom', path: ['vertices'], message: '几何顶点维数必须一致'});
});
export type Geometry = z.infer<typeof geometrySchema>;
export const elementStateStyleSchema = z.object({
  opacity: finite.optional(), color: text.optional(), highlight: z.union([finite, z.boolean()]).optional()
}).catchall(boundedDeclarativeJsonSchema);
export const elementStateSchema = z.strictObject({
  id, type: z.enum(elementTypes), space: id, parent: id.nullable(),
  transform: z.strictObject({position: vec3, x: finite.optional(), y: finite.optional(), rotation: z.union([finite, vec3]).optional(), scale: z.union([finite, vec3]).optional()}),
  style: elementStateStyleSchema, props: jsonRecord.default({}), geometry: geometrySchema.optional(),
  points: z.array(vec3).max(DECLARATIVE_LIMITS.frames).optional()
});
export type ElementState = z.infer<typeof elementStateSchema>;
export const renderFrameSchema = z.strictObject({
  states: z.record(z.string().min(1).max(140), z.union([elementStateSchema, z.strictObject({camera: cameraSchema})]))
}).superRefine((frame, ctx) => {
  if (Object.keys(frame.states).length > DECLARATIVE_LIMITS.elements + DECLARATIVE_LIMITS.list) ctx.addIssue({code: 'custom', path: ['states'], message: '帧状态数量超过预算'});
});
export type RenderFrame = z.infer<typeof renderFrameSchema>;
const relativePath = z.string().min(1).max(2048).refine((value) => !/^(?:[A-Za-z][A-Za-z0-9+.-]*:|[/\\])/.test(value) && !value.includes('\\') && !value.split('/').some((part) => part === '..' || part === '.' || part === '') && !/[\u0000-\u001f]/.test(value), '路径必须是安全的项目相对路径');
export const stateTableReferenceSchema = z.strictObject({
  path: relativePath, src: relativePath.optional(), sha256: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z.number().int().positive(), frames: z.number().int().min(1).max(DECLARATIVE_LIMITS.frames)
});
export type StateTableReference = z.infer<typeof stateTableReferenceSchema>;
export const compiledSceneSchema = z.strictObject({
  id, fps: finite.positive().max(120), seconds: finite.positive(),
  width: z.number().int().positive().max(7680), height: z.number().int().positive().max(7680),
  spaces: z.record(id, spaceSchema), annotations: z.array(text).max(DECLARATIVE_LIMITS.list),
  renderFrames: z.array(renderFrameSchema).min(1).max(DECLARATIVE_LIMITS.frames).optional(),
  stateTable: stateTableReferenceSchema.optional(),
  elements: z.array(jsonRecord).max(DECLARATIVE_LIMITS.elements).optional(),
  actions: z.array(jsonRecord).max(DECLARATIVE_LIMITS.actions).optional(),
  checks: z.array(jsonRecord).max(DECLARATIVE_LIMITS.list).optional(),
  metrics: jsonRecord.optional(), limits: jsonRecord.optional(),
  warnings: z.array(boundedDeclarativeJsonSchema).max(DECLARATIVE_LIMITS.frames).optional(),
  workerEvents: z.array(boundedDeclarativeJsonSchema).max(DECLARATIVE_LIMITS.list).optional()
}).superRefine((scene, ctx) => {
  if ((scene.renderFrames === undefined) === (scene.stateTable === undefined)) ctx.addIssue({code: 'custom', path: ['renderFrames'], message: '帧表必须且只能采用内联或外部文件其中一种形式'});
  const frames = Math.round(scene.fps * scene.seconds);
  if (frames < 1 || frames > DECLARATIVE_LIMITS.frames) ctx.addIssue({code: 'custom', path: ['seconds'], message: '总帧数超过预算'});
  if ((scene.renderFrames?.length ?? scene.stateTable?.frames) !== frames) ctx.addIssue({code: 'custom', path: ['renderFrames'], message: '帧表长度与时长不一致'});
  for (const [key, space] of Object.entries(scene.spaces)) if (key !== space.id) ctx.addIssue({code: 'custom', path: ['spaces', key], message: '空间索引与 ID 不一致'});
});
export type CompiledScene = z.infer<typeof compiledSceneSchema>;
export type CompiledDeclarativeScene = CompiledScene;
export type DeclarativeRenderFrame = RenderFrame;
export type DeclarativeElementState = ElementState;
export type DeclarativeSpace = Space;
export type DeclarativeCamera = Camera;
