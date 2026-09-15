import {Ajv} from 'ajv';
import {buildAiSchema, storyboardSchema as storyboardContract, storyboardSchemaLegacy, toJsonSchema, visualKinds as contractVisualKinds, MAX_SCENES, storyboardSchemaV2, sceneSchemaV2} from './storyboard.ts';
import {durationBudget} from './duration-budget.ts';
import {buildEvidence} from './evidence.ts';
import {normalizeTransitionDeclarations, TransitionError} from './transition-declarations.ts';
export interface ValidationContext {profiles: Array<{id: string, allowedCapabilities: string[]}>; capabilities: Array<{id: string, version: number, assets: Array<{slot: string, optional: boolean}>}>;}
export interface StoryboardDiagnostic {sceneId: string|null; path: string; code: string; message: string; hint: string; closestMatch?: string; similarity?: number;}
export interface StoryboardValidation {ok: boolean; errors: StoryboardDiagnostic[]; warnings: StoryboardDiagnostic[];}
/** @typedef {{sceneId:string|null,path:string,code:string,message:string,hint:string,closestMatch?:string,similarity?:number}} StoryboardDiagnostic */

/** Preserve the public Ajv shape used by existing diagram tests and callers. */
/** @param {unknown} value @returns {any} */
function flattenNullableObjects(value: unknown): any {
  if (Array.isArray(value)) return value.map(flattenNullableObjects);
  if (!value || typeof value !== 'object') return value;
  const record = (value as Record<string, any>);
  if (Array.isArray(record.anyOf) && record.anyOf.length === 2) {
    const objectBranch = record.anyOf.find((branch) => branch?.type === 'object');
    const nullBranch = record.anyOf.find((branch) => branch?.type === 'null');
    if (objectBranch && nullBranch) return flattenNullableObjects({...objectBranch, type: ['object', 'null']});
  }
  return Object.fromEntries(Object.entries(record).map(([key, child]) => [key, flattenNullableObjects(child)]));
}

export const visualKinds = [...contractVisualKinds];
export const storyboardSchema = flattenNullableObjects(toJsonSchema(storyboardContract));

export function getAiStoryboardSchema() {
  return buildAiSchema({legacy: true});
}
const legacyCompatibleSchema = flattenNullableObjects(toJsonSchema(storyboardSchemaLegacy));
const validateLegacy = /** @type {import('ajv').ValidateFunction<import('./storyboard.ts').Storyboard>} */ (
  new Ajv({allErrors: true}).compile(legacyCompatibleSchema)
);
/** @param {string} s */
const normalize = (s: string) => s.replace(/\s+/g, '').toLowerCase();

/** @param {string} value */
function bigrams(value: string) {
  const text = normalize(value);
  if (!text) return new Set();
  if ([...text].length === 1) return new Set([text]);
  const chars = [...text];
  return new Set(chars.slice(0, -1).map((char, index) => char + chars[index + 1]));
}

/** @param {string} left @param {string} right */
function bigramJaccard(left: string, right: string) {
  const a = bigrams(left), b = bigrams(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const item of a) if (b.has(item)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

/** @param {string} quote @param {string} source */
function nearestSentence(quote: string, source: string) {
  const sentences = source.match(/[^。！？!?\r\n]+[。！？!?]?/gu)?.map(sentence => sentence.trim()).filter(Boolean) || [];
  let closestMatch = '', similarity = -1;
  for (const sentence of sentences) {
    const score = bigramJaccard(quote, sentence);
    if (score > similarity) ({closestMatch, similarity} = {closestMatch: sentence, similarity: score});
  }
  return closestMatch ? {closestMatch, similarity: Math.round(similarity * 10_000) / 10_000} : {};
}

/** @param {{sceneId:string|null,path:string,code:string}} left @param {{sceneId:string|null,path:string,code:string}} right */
function compareDiagnostic(left: {sceneId:string|null,path:string,code:string}, right: {sceneId:string|null,path:string,code:string}) {
  const a = `${left.sceneId ?? ''}\u0000${left.path}\u0000${left.code}`;
  const b = `${right.sceneId ?? ''}\u0000${right.path}\u0000${right.code}`;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** @param {any} board @param {import('ajv').ErrorObject} issue */
function schemaDiagnostic(board: any, issue: import('ajv').ErrorObject) {
  const segments = issue.instancePath.split('/').slice(1).map(value => value.replace(/~1/g, '/').replace(/~0/g, '~'));
  if (issue.keyword === 'required' && typeof issue.params?.missingProperty === 'string') segments.push(issue.params.missingProperty);
  if (issue.keyword === 'additionalProperties' && typeof issue.params?.additionalProperty === 'string') segments.push(issue.params.additionalProperty);
  const sceneIndex = segments[0] === 'scenes' && /^\d+$/.test(segments[1] || '') ? Number(segments[1]) : null;
  const path = segments.slice(sceneIndex === null ? 0 : 2).join('.');
  return {
    sceneId: sceneIndex === null || typeof board?.scenes?.[sceneIndex]?.id !== 'string' ? null : board.scenes[sceneIndex].id,
    path,
    code: 'SCHEMA_INVALID',
    message: issue.message || '字段不符合分镜 schema',
    hint: '按分镜 schema 修正字段'
  };
}

/** @param {any} board @param {string} source @returns {StoryboardDiagnostic[]} */
function legacySemanticErrors(board: any, source: string): StoryboardDiagnostic[] {
  /** @type {StoryboardDiagnostic[]} */
  const errors: StoryboardDiagnostic[] = [];
  /** @param {unknown} sceneId @param {string} path @param {string} code @param {string} message @param {string} hint */
  const add = (sceneId: unknown, path: string, code: string, message: string, hint: string) => errors.push({sceneId: typeof sceneId === 'string' ? sceneId : null, path, code, message, hint});
  const scenes = Array.isArray(board?.scenes) ? board.scenes : [];
  if (scenes.length < 2 || scenes.length > MAX_SCENES) add(null, 'scenes', 'SCENE_COUNT', `请使用 2～${MAX_SCENES} 个场景`, `调整为 2～${MAX_SCENES} 幕`);
  const ids = new Set();
  for (const scene of scenes) {
    if (!scene || typeof scene !== 'object') continue;
    const sceneId = typeof scene.id === 'string' ? scene.id : null;
    if (sceneId !== null) {
      if (ids.has(sceneId)) add(sceneId, 'id', 'DUPLICATE_SCENE_ID', `场景编号重复：${sceneId}`, '使用唯一场景编号');
      ids.add(sceneId);
    }
    if (typeof scene.title === 'string' && (!scene.title.trim() || [...scene.title].length > 32)) add(sceneId, 'title', 'TITLE_LENGTH', `场景 ${sceneId} 的标题需要 1～32 字`, '调整标题长度');
    if (Array.isArray(scene.bullets) && (scene.bullets.length > 3 || scene.bullets.some(/** @param {unknown} item */ (item: unknown) => typeof item === 'string' && [...item].length > 32))) add(sceneId, 'bullets', 'BULLET_LENGTH', `场景 ${sceneId} 最多 3 条要点，每条不超过 32 字`, '精简要点');
    if (Array.isArray(scene.nodes) && (scene.nodes.length > 5 || scene.nodes.some(/** @param {unknown} item */ (item: unknown) => typeof item === 'string' && [...item].length > 18))) add(sceneId, 'nodes', 'NODE_LENGTH', `场景 ${sceneId} 最多 5 个节点，每个不超过 18 字`, '精简流程节点');
    if (Array.isArray(scene.metrics) && (scene.metrics.length > 4 || scene.metrics.some(/** @param {any} metric */ (metric: any) => metric && typeof metric === 'object' && (!Number.isFinite(metric.value) || metric.value < 0 || (typeof metric.label === 'string' && metric.label.length > 20) || (typeof metric.unit === 'string' && metric.unit.length > 12))))) add(sceneId, 'metrics', 'METRIC_INVALID', `场景 ${sceneId} 的数值或标签不符合图表要求`, '核对数值、标签与单位');
    if (scene.type === 'chart' && Array.isArray(scene.metrics) && !scene.metrics.length) add(sceneId, 'metrics', 'CHART_METRICS_REQUIRED', `场景 ${sceneId} 是图表，请至少填写一条有原文依据的数据`, '增加一条有原文依据的数据');
    if (typeof scene.narration === 'string' && (!scene.narration.trim() || scene.narration.length > 450)) add(sceneId, 'narration', 'NARRATION_LENGTH', `场景 ${sceneId} 的旁白需要 1～450 字`, '调整旁白长度');
    if (source && typeof scene.sourceQuote === 'string' && (!scene.sourceQuote.trim() || !normalize(source).includes(normalize(scene.sourceQuote)))) add(sceneId, 'sourceQuote', 'QUOTE_NOT_FOUND', `场景 ${sceneId} 的原文引用未在文档中找到，请核对来源后修改`, '从原文复制连续文字，不加省略号');
    const diagram = scene.diagram;
    if (!diagram || typeof diagram !== 'object') continue;
    const nodes = Array.isArray(diagram.nodes) ? diagram.nodes : [];
    const edges = Array.isArray(diagram.edges) ? diagram.edges : [];
    if (diagram.layout === 'split' && nodes.length > 3) add(sceneId, 'diagram.nodes', 'SPLIT_MAX_3_NODES', `场景 ${sceneId} 的 split 图示需要 2～3 个节点`, '减少节点或改用 pipeline');
    if (diagram.layout === 'hub' && nodes.length < 3) add(sceneId, 'diagram.nodes', 'HUB_NEEDS_3_NODES', `场景 ${sceneId} 的 hub 图示需要 3～5 个节点，首个节点为中心`, '增加节点或改用 layout=split');
    const nodeIds = new Set();
    for (const node of nodes) {
      if (!node || typeof node.id !== 'string') continue;
      if (nodeIds.has(node.id)) add(sceneId, 'diagram.nodes', 'DUPLICATE_NODE_ID', `场景 ${sceneId} 的图示节点编号重复：${node.id}`, '使用唯一节点编号');
      nodeIds.add(node.id);
    }
    for (const edge of edges) {
      if (!edge || typeof edge !== 'object') continue;
      if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) add(sceneId, 'diagram.edges', 'EDGE_NODE_NOT_FOUND', `场景 ${sceneId} 的图示连线引用了不存在的节点：${edge.from} → ${edge.to}`, 'from/to 必须引用本幕节点');
      if (edge.from === edge.to) add(sceneId, 'diagram.edges', 'SELF_EDGE', `场景 ${sceneId} 的图示连线不能指向自身：${edge.from}`, '连接两个不同节点');
    }
  }
  return errors;
}

/** @param {StoryboardDiagnostic} error @param {any} scene @returns {StoryboardDiagnostic} */
function translateLegacyV2Path(error: StoryboardDiagnostic, scene: any): StoryboardDiagnostic {
  const capability = scene?.capability;
  if (capability?.id === 'motion.diagram' && error.path.startsWith('diagram.')) return {...error, path: `capability.params.${error.path.slice('diagram.'.length)}`};
  if (capability?.params && error.path === 'nodes' && Array.isArray(capability.params.nodes) && capability.id !== 'motion.diagram') return {...error, path: 'capability.params.nodes'};
  if (capability?.params && error.path === 'metrics' && Array.isArray(capability.params.metrics)) return {...error, path: 'capability.params.metrics'};
  return error;
}

/** @param {any} board @returns {StoryboardDiagnostic[]} */
function v2CapabilitySemanticErrors(board: any): StoryboardDiagnostic[] {
  /** @type {StoryboardDiagnostic[]} */
  const errors: StoryboardDiagnostic[] = [];
  const scenes = Array.isArray(board?.scenes) ? board.scenes : [];
  for (const scene of scenes) {
    if (!scene || typeof scene !== 'object') continue;
    const sceneId = typeof scene.id === 'string' ? scene.id : null;
    const capability = scene.capability;
    const params = capability?.params;
    if (!params || typeof params !== 'object') continue;
    const nodes = ['motion.symbol', 'media.fullScene', 'classic.flow'].includes(capability.id) && Array.isArray(params.nodes) ? params.nodes : null;
    if (nodes && (nodes.length > 5 || nodes.some(/** @param {unknown} item */ (item: unknown) => typeof item === 'string' && [...item].length > 18))) errors.push({sceneId, path: 'capability.params.nodes', code: 'NODE_LENGTH', message: `场景 ${sceneId} 最多 5 个节点，每个不超过 18 字`, hint: '精简流程节点'});
    const metrics = ['motion.symbol', 'media.fullScene', 'chart.metrics'].includes(capability.id) && Array.isArray(params.metrics) ? params.metrics : null;
    if (metrics && (metrics.length > 4 || metrics.some(/** @param {any} metric */ (metric: any) => metric && typeof metric === 'object' && (!Number.isFinite(metric.value) || metric.value < 0 || (typeof metric.label === 'string' && metric.label.length > 20) || (typeof metric.unit === 'string' && metric.unit.length > 12))))) errors.push({sceneId, path: 'capability.params.metrics', code: 'METRIC_INVALID', message: `场景 ${sceneId} 的数值或标签不符合图表要求`, hint: '核对数值、标签与单位'});
    if (scene.role === 'chart' && (!metrics || !metrics.length)) errors.push({sceneId, path: 'capability.params.metrics', code: 'CHART_METRICS_REQUIRED', message: `场景 ${sceneId} 是图表，请至少填写一条有原文依据的数据`, hint: '增加一条有原文依据的数据'});
  }
  return errors;
}

/** @param {StoryboardDiagnostic[]} errors */
function dedupeDiagnostics(errors: StoryboardDiagnostic[]) {
  const seen = new Set();
  return errors.filter(error => {
    const key = `${error.sceneId ?? ''}\u0000${error.path}\u0000${error.code}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** @param {any} board @param {any} settings @returns {StoryboardDiagnostic[]} */
function storyboardWarnings(board: any, settings: any): StoryboardDiagnostic[] {
  /** @type {StoryboardDiagnostic[]} */
  const warnings: StoryboardDiagnostic[] = [];
  const scenes = Array.isArray(board?.scenes) ? board.scenes : [];
  if (typeof board?.title === 'string' && [...board.title].length > 22) warnings.push({sceneId: null, path: 'title', code: 'BOARD_TITLE_SOFT_LIMIT', message: '视频主标题超过编导建议的 22 字', hint: '缩短视频主标题'});
  for (const scene of scenes) {
    if (!scene || typeof scene !== 'object') continue;
    const sceneId = typeof scene.id === 'string' ? scene.id : null;
    if (typeof scene.title === 'string' && [...scene.title].length > 18) warnings.push({sceneId, path: 'title', code: 'TITLE_SOFT_LIMIT', message: '标题超过编导建议的 18 字', hint: '缩短屏显标题以便扫读'});
    if (typeof scene.kicker === 'string' && [...scene.kicker].length > 20) warnings.push({sceneId, path: 'kicker', code: 'KICKER_SOFT_LIMIT', message: '眉题超过编导建议的 20 字', hint: '缩短眉题以便扫读'});
    if (Array.isArray(scene.bullets)) scene.bullets.forEach(/** @param {unknown} bullet @param {number} index */ (bullet: unknown, index: number) => {
      if (typeof bullet === 'string' && [...bullet].length > 20) warnings.push({sceneId, path: `bullets.${index}`, code: 'BULLET_SOFT_LIMIT', message: '要点超过编导建议的 20 字', hint: '缩短屏显要点，细节放入旁白'});
    });
  }
  const targetSeconds = settings?.targetSeconds ?? 60;
  if (Number.isFinite(targetSeconds) && targetSeconds > 0 && targetSeconds <= 1800) {
    const budget = durationBudget(targetSeconds);
    const characters = scenes.reduce(/** @param {number} total @param {any} scene */ (total: number, scene: any) => total + (typeof scene?.narration === 'string' ? [...scene.narration].length : 0), 0);
    if (characters > budget.characters) warnings.push({sceneId: null, path: 'scenes.narration', code: 'NARRATION_BUDGET_EXCEEDED', message: `总旁白 ${characters} 字，超过 ${targetSeconds} 秒建议预算 ${budget.characters} 字`, hint: '精简旁白或提高目标时长；实际时长仍以本地语音为准'});
  }
  return warnings.sort(compareDiagnostic);
}

/**
 * Collect every independently checkable storyboard diagnostic without throwing.
 * @param {any} board
 * @param {string} [source]
 * @param {any} [settings]
 * @returns {{ok:boolean,errors:StoryboardDiagnostic[],warnings:StoryboardDiagnostic[]}}
 */
export function validateStoryboardDetailed(board: any, source: string = '', settings: any = {}, context: ValidationContext): StoryboardValidation {
  const safeSource = typeof source === 'string' ? source : '';
  /** @type {StoryboardDiagnostic[]} */
  let errors: StoryboardDiagnostic[];
  if (board?.contractVersion === 2) {
    const scenes = Array.isArray(board?.scenes) ? board.scenes : [];
    const legacy = legacySemanticErrors(board, safeSource).map(error => translateLegacyV2Path(error, scenes.find(/** @param {any} scene */ (scene: any) => scene?.id === error.sceneId)));
    errors = [...legacy, ...v2CapabilitySemanticErrors(board), ...validateBoardV2(board, safeSource, context).errors.map(error => ({...error}))];
  } else {
    validateLegacy(board);
    errors = (validateLegacy.errors || []).map(issue => schemaDiagnostic(board, issue));
    errors.push(...legacySemanticErrors(board, safeSource));
  }
  errors = dedupeDiagnostics(errors);
  const specificPaths = new Set(errors.filter(error => error.code !== 'SCHEMA_INVALID').map(error => `${error.sceneId ?? ''}\u0000${error.path}`));
  errors = errors.filter(error => error.code !== 'SCHEMA_INVALID' || !specificPaths.has(`${error.sceneId ?? ''}\u0000${error.path}`));
  /** @type {Map<string|null, any[]>} */
  const missingQuotes: Map<string|null, any[]> = new Map();
  const normalizedSource = normalize(safeSource);
  if (safeSource && Array.isArray(board?.scenes)) for (const scene of board.scenes) {
    if (!scene || typeof scene.sourceQuote !== 'string' || (scene.sourceQuote.trim() && normalizedSource.includes(normalize(scene.sourceQuote)))) continue;
    const sceneId = typeof scene.id === 'string' ? scene.id : null;
    missingQuotes.set(sceneId, [...(missingQuotes.get(sceneId) || []), scene]);
  }
  for (const error of errors) if (error.code === 'QUOTE_NOT_FOUND') {
    const scene = missingQuotes.get(error.sceneId)?.shift();
    if (typeof scene?.sourceQuote === 'string') Object.assign(error, nearestSentence(scene.sourceQuote, safeSource));
  }
  errors.sort(compareDiagnostic);
  const warnings = storyboardWarnings(board, settings);
  return {ok: errors.length === 0, errors, warnings};
}

/** Structured, read-only validation: no source repair or writes.
 * @param {any} board @param {string} [source]
 */
export function validateBoardV2(board: any, source: string = '', context: ValidationContext) {
  /** @type {Array<{sceneId: string|null, path: string, code: string, message: string, hint: string}>} */
  const errors: Array<{sceneId: string|null, path: string, code: string, message: string, hint: string}> = [];
  /** @param {any} sceneId @param {string} path @param {string} code @param {string} message @param {string} hint */
  const add = (sceneId: any,path: string,code: string,message: string,hint: string) => errors.push({sceneId: typeof sceneId === 'string' ? sceneId : null,path,code,message,hint});
  try { normalizeTransitionDeclarations(board); }
  catch (error) {
    if (!(error instanceof TransitionError)) throw error;
    add(null, 'transitions', error.code, error.message, '每个边界只声明一次，并使用同一种 overlap 策略');
  }
  const parsed = storyboardSchemaV2.safeParse(board);
  if (!parsed.success) for (const issue of parsed.error.issues) {
    const index = issue.path[0] === 'scenes' && typeof issue.path[1] === 'number' ? issue.path[1] : undefined;
    add(index === undefined ? null : board?.scenes?.[index]?.id, issue.path.slice(index === undefined ? 0 : 2).join('.'), 'SCHEMA_INVALID', issue.message, '按当前 profile 的分镜 schema 修正字段');
  }
  const scenes = Array.isArray(board?.scenes) ? board.scenes : [];
  const profile = ['motion','classic','story','typography'].includes(board?.profile) ? context.profiles.find(profile => profile.id === board.profile) : null;
  const packages = context.capabilities;
  /** @param {any} reference @param {any} sceneId @param {string} prefix */
  const checkVersion = (reference: any, sceneId: any, prefix: string) => {
    if (reference && typeof reference.id === 'string' && reference.version != null && !packages.some(item => item.id === reference.id && item.version === reference.version)) add(sceneId, `${prefix}.version`, 'CAPABILITY_VERSION_NOT_FOUND', `未安装能力版本：${reference.id}@${reference.version}`, '选择目录中已安装的版本');
  };
  checkVersion(board?.outro?.capability, null, 'outro.capability');
  const ids = new Set();
  for (const scene of scenes) {
    if (!scene || typeof scene !== 'object') continue;
    if (ids.has(scene.id)) add(scene.id,'id','DUPLICATE_SCENE_ID',`场景编号重复：${scene.id}`,'使用唯一场景编号');
    ids.add(scene.id);
    const cap = scene.capability;
    checkVersion(cap, scene.id, 'capability');
    if (profile && cap && !profile.allowedCapabilities.filter(/** @param {string} id */ (id: string) => id !== 'outro.brand').includes(cap.id)) add(scene.id,'capability.id','CAPABILITY_NOT_ALLOWED','当前风格不支持此场景能力','选择 profile.allowedCapabilities 中的场景能力');
    const diagram = cap?.id === 'motion.diagram' ? cap.params : null;
    if (Array.isArray(diagram?.nodes)) {
      if (diagram.layout === 'hub' && diagram.nodes.length < 3) add(scene.id,'capability.params.nodes','HUB_NEEDS_3_NODES',`场景 ${scene.id} 的 hub 图示需要 3～5 个节点，首个节点为中心`,'增加节点或改用 layout=split');
      if (diagram.layout === 'split' && diagram.nodes.length > 3) add(scene.id,'capability.params.nodes','SPLIT_MAX_3_NODES',`场景 ${scene.id} 的 split 图示需要 2～3 个节点`,'减少节点或改用 pipeline');
      const nodeIds = new Set();
      for (const node of diagram.nodes) {
        if (!node || typeof node.id !== 'string') continue;
        if (nodeIds.has(node.id)) add(scene.id,'capability.params.nodes','DUPLICATE_NODE_ID','图示节点编号重复','使用唯一节点编号');
        nodeIds.add(node.id);
      }
      for (const edge of Array.isArray(diagram.edges) ? diagram.edges : []) {
        if (!edge) continue;
        if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) add(scene.id,'capability.params.edges','EDGE_NODE_NOT_FOUND','图示连线引用了不存在的节点','from/to 必须引用本幕节点');
        if (edge.from === edge.to) add(scene.id,'capability.params.edges','SELF_EDGE','图示连线不能指向自身','连接两个不同节点');
      }
    }
    if (!sceneSchemaV2.safeParse(scene).success) continue;
    const metadata = packages.find(item => item.id === cap.id);
    // when.roles is authoring guidance, not a new gate on historical narrative roles.
    if (metadata) {
      const slots = new Set();
      for (const asset of scene.assets) {
        const descriptor = metadata.assets.find(/** @param {any} slot */ (slot: any) => slot.slot === asset.slot || (slot.slot === 'nodes[].media' && /^nodes\[\d+\]\.media$/.test(asset.slot)));
        if (!descriptor) add(scene.id,'assets','ASSET_SLOT_NOT_ALLOWED',`能力不支持素材槽：${asset.slot}`,'使用能力目录声明的素材槽');
        if (slots.has(asset.slot)) add(scene.id,'assets','DUPLICATE_ASSET_SLOT',`素材槽重复：${asset.slot}`,'每个素材槽只绑定一次');
        slots.add(asset.slot);
        const nodeSlot = /^nodes\[(\d+)\]\.media$/.exec(asset.slot);
        if (cap.id === 'motion.diagram' && nodeSlot && Number(nodeSlot[1]) >= cap.params.nodes.length) add(scene.id,'assets','ASSET_NODE_NOT_FOUND','素材槽引用了不存在的节点','绑定到本幕已有节点');
      }
      for (const slot of metadata.assets) if (!slot.optional && !slots.has(slot.slot)) add(scene.id,'assets','ASSET_REQUIRED',`能力缺少素材槽：${slot.slot}`,'绑定此能力所需素材');
    }
    // Legacy standalone diagram examples name media slots without job selections.
    // Preserve them here; resolveBoardAssets remains the source of missing-binding
    // errors before production. Normalization must not invent or drop those names.

    if (scene.type && scene.type !== scene.role) add(scene.id,'role','ROLE_MISMATCH','role 与旧 type 不一致','保持叙事角色一致');
    if (!scene.title.trim() || [...scene.title].length > 32) add(scene.id,'title','TITLE_LENGTH','标题需要 1～32 字','缩短标题');
    if (scene.bullets.length > 3 || scene.bullets.some(/** @param {string} s */ (s: string) => [...s].length > 32)) add(scene.id,'bullets','BULLET_LENGTH','最多 3 条要点，每条不超过 32 字','精简要点');
    if (!scene.narration.trim() || scene.narration.length > 450) add(scene.id,'narration','NARRATION_LENGTH','旁白需要 1～450 字','调整旁白长度');
    const sentenceIds = new Set();
    for (const sentence of scene.sentences) {if (sentenceIds.has(sentence.id)) add(scene.id,'sentences','DUPLICATE_SENTENCE_ID','句子编号重复','使用唯一句子编号'); sentenceIds.add(sentence.id);}
    if (scene.sentences.map(/** @param {any} s */ (s: any) => s.text).join('').replace(/\s/g,'') !== scene.narration.replace(/\s/g,'')) add(scene.id,'sentences','SENTENCE_TEXT_MISMATCH','句子文本与旁白不一致','保留完整旁白内容');
  }
  if (source) for (const evidence of buildEvidence({scenes: scenes.filter(/** @param {any} scene */ (scene: any) => typeof scene?.sourceQuote === 'string')},source).scenes) if (evidence.matched === 'missing') add(evidence.id,'sourceQuote','QUOTE_NOT_FOUND','引用未在原文中找到','从原文复制连续文字，不加省略号');
  errors.sort((a,b) => `${a.sceneId ?? ''}/${a.path}/${a.code}`.localeCompare(`${b.sceneId ?? ''}/${b.path}/${b.code}`));
  return {ok: errors.length === 0, errors};
}
