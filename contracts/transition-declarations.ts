// @ts-check
import {
  handoffParamsSchema,
  transitionKinds,
  transitionOutSchema,
  transitionOverlaps,
  transitionSchema,
  wipeParamsSchema
} from './transitions.ts';

export const TRANSITION_KINDS = transitionKinds;
export const POLICIES = transitionOverlaps;
export const SCENE_ELEMENTS = ['background', 'kicker', 'title', 'bullets', 'particles', 'captions'];
const TEXT_ELEMENTS = new Set(['kicker', 'title', 'bullets']);
export const BRAND_OUTRO_ID = '__brandOutro__';

export class TransitionError extends Error {
  code: string;
  detail?: unknown;
  /** @param {string} code @param {string} message @param {unknown} [detail] */
  constructor(code: string, message: string, detail?: unknown) {
    super(message);
    this.name = 'TransitionError';
    this.code = code;
    this.detail = detail;
  }
}

/** @param {unknown} value @returns {value is Record<string, any>} */
export const isRecord = (value: unknown): value is Record<string, any> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** @template T @param {T} value @returns {T} */
export const clone = <T>(value: T): T => structuredClone(value);

/** @param {unknown} project */
export function scenesOf(project: unknown) {
  if (!isRecord(project) || !Array.isArray(project.scenes)) {
    throw new TransitionError('PROJECT_SCENES', 'project.scenes 必须是数组');
  }
  return project.scenes;
}

/** @param {Record<string, any>} project @param {Array<any>} scenes */
export function validateUniqueSceneIds(project: Record<string, any>, scenes: Array<any>) {
  const byId = new Map();
  scenes.forEach((scene, index) => {
    if (!isRecord(scene) || typeof scene.id !== 'string' || scene.id.length === 0) {
      throw new TransitionError('SCENE_ID', `project.scenes[${index}].id 必须是非空字符串`);
    }
    if (byId.has(scene.id)) {
      throw new TransitionError('DUPLICATE_SCENE_ID', `场景编号重复：${scene.id}`, {
        sceneId: scene.id,
        indexes: [byId.get(scene.id), index]
      });
    }
    byId.set(scene.id, index);
  });
  return byId;
}

/** @param {Record<string, any>} project */
function hasOutro(project: Record<string, any>) {
  return Boolean(project.brandOutro || project.outro);
}

/** @param {unknown} value @param {number} index */
function normalizeSharedElements(value: unknown, index: number) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new TransitionError('SHARED_NOT_ARRAY', `transitions[${index}].sharedElements 必须是数组`);
  }
  return value.map((item, sharedIndex) => {
    const entry = typeof item === 'string' ? {from: item, to: item} : item;
    if (!isRecord(entry) || typeof entry.from !== 'string' || typeof entry.to !== 'string') {
      throw new TransitionError('SHARED_SHAPE', `transitions[${index}].sharedElements[${sharedIndex}] 需要 {from,to} 或字符串`);
    }
    for (const side of ['from', 'to']) {
      if (!SCENE_ELEMENTS.includes(entry[side])) {
        throw new TransitionError(
          'SHARED_UNKNOWN_ELEMENT',
          `transitions[${index}].sharedElements[${sharedIndex}].${side}=${entry[side]} 不是已知元素`,
          {known: SCENE_ELEMENTS}
        );
      }
    }
    if (entry.from === 'captions' || entry.to === 'captions') {
      throw new TransitionError(
        'CAPTIONS_SHARED_UNSUPPORTED',
        '字幕使用独立轨道，当前不支持通过 sharedElements 接力',
        {transitionIndex: index, sharedIndex}
      );
    }
    const sameFamily = (entry.from === 'particles' && entry.to === 'particles')
      || (entry.from === 'background' && entry.to === 'background')
      || (TEXT_ELEMENTS.has(entry.from) && TEXT_ELEMENTS.has(entry.to));
    if (!sameFamily) {
      throw new TransitionError(
        'SHARED_MAPPING_UNSUPPORTED',
        `当前不支持共享元素跨类型映射：${entry.from} → ${entry.to}`,
        {transitionIndex: index, sharedIndex}
      );
    }
    if (entry.morph !== undefined && !(entry.from === 'particles' && entry.to === 'particles')) {
      throw new TransitionError(
        'MORPH_UNSUPPORTED',
        'morph 当前只支持 particles → particles',
        {transitionIndex: index, sharedIndex}
      );
    }
    return clone(entry);
  });
}

/** @param {Record<string, any>} transition @param {number} index */
function validateSupportedFields(transition: Record<string, any>, index: number) {
  if (!TRANSITION_KINDS.includes(transition.kind)) {
    throw new TransitionError('KIND_UNKNOWN', `transitions[${index}].kind=${transition.kind} 不支持`, {known: TRANSITION_KINDS});
  }
  const seconds = transition.duration;
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) {
    throw new TransitionError('DURATION', `transitions[${index}].duration 必须是有限的非负数`);
  }
  if (transition.kind === 'cut' && seconds !== 0) {
    throw new TransitionError('CUT_DURATION', `cut 的 duration 必须为 0（收到 ${seconds}）`);
  }
  if (transition.kind !== 'cut' && seconds === 0) {
    throw new TransitionError('ZERO_DURATION', `${transition.kind} 的 duration 必须 > 0`);
  }
  if (transition.easing !== undefined && transition.easing !== 'smoothstep') {
    throw new TransitionError('EASING_UNSUPPORTED', `easing=${transition.easing} 尚未支持`, {known: ['smoothstep']});
  }
  if (transition.overlap !== 'anchor' && transition.overlap !== 'trim') {
    throw new TransitionError('OVERLAP_UNKNOWN', `overlap=${transition.overlap} 不支持`, {known: POLICIES});
  }
  if (transition.kind === 'handoff' && (!Array.isArray(transition.sharedElements) || transition.sharedElements.length === 0)) {
    throw new TransitionError('HANDOFF_NEEDS_SHARED', 'handoff 需要 sharedElements');
  }
  const params = transition.params;
  if (params !== undefined && !isRecord(params)) {
    throw new TransitionError('PARAMS_UNSUPPORTED', `transitions[${index}].params 必须是对象`);
  }
  const allowed = transition.kind === 'wipe' ? ['direction', 'feather']
    : transition.kind === 'handoff' ? ['lightPhase'] : [];
  const unsupported = isRecord(params) ? Object.keys(params).filter((key) => !allowed.includes(key)) : [];
  if (unsupported.length > 0) {
    throw new TransitionError('PARAMS_UNSUPPORTED', `${transition.kind} 不支持参数：${unsupported.join(', ')}`, {
      transitionIndex: index,
      unsupported,
      allowed
    });
  }
  if (transition.kind === 'wipe' && isRecord(params)) {
    const direction = params.direction ?? 'left';
    if (!['left', 'right', 'up', 'down'].includes(direction)) {
      throw new TransitionError('WIPE_DIRECTION', `wipe.direction=${direction} 不支持`);
    }
    const feather = params.feather ?? 0;
    if (typeof feather !== 'number' || !Number.isFinite(feather) || feather < 0 || feather > 1) {
      throw new TransitionError('WIPE_FEATHER', 'wipe.feather 需为 [0,1] 内的有限数');
    }
  }
  if (transition.kind === 'handoff' && isRecord(params) && params.lightPhase !== undefined) {
    const lightPhase = handoffParamsSchema.safeParse(params);
    if (!lightPhase.success) {
      throw new TransitionError('LIGHT_PHASE', 'handoff.params.lightPhase 需要布尔值 {from,to}', lightPhase.error.issues);
    }
  }
}

/**
 * @param {Record<string, any>} project
 * @param {Record<string, any>} transition
 * @param {number} index
 * @param {Map<string, number>} byId
 */
function resolvePair(project: Record<string, any>, transition: Record<string, any>, index: number, byId: Map<string, number>) {
  const scenes = project.scenes;
  const hasAfter = transition.after !== undefined;
  const hasBetween = transition.between !== undefined;
  if (hasAfter === hasBetween) {
    throw new TransitionError('PAIR_SHAPE', `transitions[${index}] 需要且只能使用 after 或 between`);
  }
  let outIndex;
  if (hasAfter) {
    if (!Number.isInteger(transition.after)) {
      throw new TransitionError('INDEX_RANGE', `transitions[${index}].after 必须是整数`);
    }
    outIndex = transition.after;
  } else {
    if (!Array.isArray(transition.between) || transition.between.length !== 2
      || transition.between.some((id) => typeof id !== 'string' || id.length === 0)) {
      throw new TransitionError('PAIR_SHAPE', `transitions[${index}].between 需要两个非空场景编号`);
    }
    const [from, to] = transition.between;
    const found = byId.get(from);
    if (found === undefined) {
      throw new TransitionError('SCENE_NOT_FOUND', `transitions[${index}].between[0]=${from} 不存在`);
    }
    outIndex = found;
    if (outIndex === scenes.length - 1 && to === BRAND_OUTRO_ID && hasOutro(project)) {
      return outIndex;
    }
    const inIndex = byId.get(to);
    if (inIndex === undefined) {
      throw new TransitionError('SCENE_NOT_FOUND', `transitions[${index}].between[1]=${to} 不存在`);
    }
    if (inIndex !== outIndex + 1) {
      throw new TransitionError('NOT_ADJACENT', `transitions[${index}] 两幕不相邻：${from} → ${to}`);
    }
  }
  if (outIndex < 0 || outIndex >= scenes.length) {
    throw new TransitionError('INDEX_RANGE', `transitions[${index}].after=${outIndex} 越界`);
  }
  if (outIndex === scenes.length - 1 && !hasOutro(project)) {
    throw new TransitionError('NO_OUTRO', `幕 ${scenes[outIndex].id} 是最后一幕且没有品牌片尾，不能接转场`);
  }
  return outIndex;
}

/** @param {Record<string, any>} parsed */
function normalizedParams(parsed: Record<string, any>) {
  if (parsed.kind === 'wipe') return wipeParamsSchema.parse(parsed.params ?? {});
  if (parsed.kind === 'handoff') return handoffParamsSchema.parse(parsed.params ?? {});
  return {};
}

/**
 * Normalize top-level transitions or per-scene transitionOut declarations without
 * requiring timed scenes. The timed compiler performs frame-window validation later.
 *
 * @param {Record<string, any>} project
 * @param {unknown} [transitions]
 * @param {{policy?: 'anchor'|'trim'}} [options]
 * @returns {Array<any>|undefined}
 */
export function normalizeTransitionDeclarations(project: Record<string, any>, transitions?: unknown, options: {policy?: 'anchor'|'trim'} = {}): Array<any>|undefined {
  const scenes = scenesOf(project);
  const byId = validateUniqueSceneIds(project, scenes);
  const fallbackPolicy = options.policy ?? 'anchor';
  if (!POLICIES.includes(fallbackPolicy)) {
    throw new TransitionError('POLICY_UNKNOWN', `policy=${fallbackPolicy} 不支持`, {known: POLICIES});
  }

  const topLevelPresent = transitions !== undefined || Object.prototype.hasOwnProperty.call(project, 'transitions');
  const sceneDeclarations = scenes.flatMap((scene, index) =>
    isRecord(scene) && Object.prototype.hasOwnProperty.call(scene, 'transitionOut')
      ? [{value: scene.transitionOut, sceneIndex: index}]
      : []
  );
  if (topLevelPresent && sceneDeclarations.length > 0) {
    throw new TransitionError(
      'DECLARATION_CONFLICT',
      '顶层 transitions 与场景 transitionOut 不能同时声明',
      {sceneIndexes: sceneDeclarations.map((item) => item.sceneIndex)}
    );
  }

  /** @type {Array<{value: unknown, sceneIndex: number|null}>} */
  let sources: Array<{value: unknown, sceneIndex: number|null}>;
  if (sceneDeclarations.length > 0) {
    sources = sceneDeclarations;
  } else if (topLevelPresent) {
    const topLevel = transitions !== undefined ? transitions : project.transitions;
    if (!Array.isArray(topLevel)) throw new TransitionError('TRANSITIONS_NOT_ARRAY', 'transitions 必须是数组');
    sources = topLevel.map((value) => ({value, sceneIndex: null}));
  } else {
    return undefined;
  }
  if (sources.length === 0) return undefined;

  const normalized = sources.map(({value, sceneIndex}, index) => {
    if (!isRecord(value)) throw new TransitionError('TRANSITION_SHAPE', `transitions[${index}] 必须是对象`);
    if (sceneIndex === null) {
      const hasAfter = value.after !== undefined;
      const hasBetween = value.between !== undefined;
      if (hasAfter === hasBetween) {
        throw new TransitionError('PAIR_SHAPE', `transitions[${index}] 需要且只能使用 after 或 between`);
      }
    } else if (value.after !== undefined || value.between !== undefined) {
      throw new TransitionError('PAIR_SHAPE', `scene.transitionOut 不应再声明 after 或 between`);
    }
    /** @type {Record<string, any>} */
    const candidate: Record<string, any> = {
      ...value,
      overlap: value.overlap ?? fallbackPolicy,
      ...(sceneIndex === null ? {} : {after: sceneIndex})
    };
    validateSupportedFields(candidate, index);
    const sharedElements = normalizeSharedElements(candidate.sharedElements, index);
    if (candidate.sharedElements !== undefined) candidate.sharedElements = sharedElements;
    const parsed = transitionSchema.safeParse(candidate);
    if (!parsed.success) {
      throw new TransitionError('SCHEMA_INVALID', `transitions[${index}] 不符合转场契约`, {
        transitionIndex: index,
        issues: parsed.error.issues
      });
    }
    // Consume the dedicated scene schema too, so authoring and compiled inputs
    // cannot silently diverge.
    if (sceneIndex !== null) {
      const {after: _after, between: _between, ...sceneCandidate} = candidate;
      const sceneParsed = transitionOutSchema.safeParse(sceneCandidate);
      if (!sceneParsed.success) {
        throw new TransitionError('SCHEMA_INVALID', `scene[${sceneIndex}].transitionOut 不符合转场契约`, {
          sceneIndex,
          issues: sceneParsed.error.issues
        });
      }
    }
    const outIndex = resolvePair(project, parsed.data, index, byId);
    const incoming = scenes[outIndex + 1];
    const params = normalizedParams(parsed.data);
    const locator = parsed.data.after !== undefined
      ? {after: outIndex}
      : {between: [scenes[outIndex].id, incoming ? incoming.id : BRAND_OUTRO_ID]};
    return {
      kind: parsed.data.kind,
      ...locator,
      overlap: parsed.data.overlap,
      duration: parsed.data.duration,
      ...(sharedElements.length > 0 ? {sharedElements} : {}),
      ...(Object.keys(params).length > 0 ? {params} : {}),
      ...(parsed.data.easing !== undefined ? {easing: parsed.data.easing} : {}),
      ...(parsed.data.transitionVisual !== undefined ? {transitionVisual: parsed.data.transitionVisual} : {})
    };
  });

  const policies = new Set(normalized.map((transition) => transition.overlap));
  if (policies.size > 1) {
    throw new TransitionError('MIXED_OVERLAP', '同一作品暂不支持混合 anchor 与 trim 转场', {
      policies: [...policies]
    });
  }
  const seenPairs = new Map();
  normalized.forEach((transition, index) => {
    const outIndex = resolvePair(project, transition, index, byId);
    const pair = [scenes[outIndex].id, scenes[outIndex + 1]?.id ?? BRAND_OUTRO_ID];
    const key = pair.join('\0');
    if (seenPairs.has(key)) {
      throw new TransitionError('DUPLICATE', `场景对 ${pair.join(' → ')} 重复声明转场`, {
        pair,
        indexes: [seenPairs.get(key), index]
      });
    }
    seenPairs.set(key, index);
  });
  return normalized;
}
