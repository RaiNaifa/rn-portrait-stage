import { CAST_LAYERS, GROUP_IDS, HOOKS, MODULE_ID, SETTING_KEYS } from "../constants.js";
import { getActorLibrary, setActorLibrary } from "./actor-library.js";
import { normalizePortraitEntry } from "./portrait-entry.js";
import { getPersistentState, setPersistentState } from "./persistent-state.js";
import { createDefaultSceneState, getSceneState, normalizeSceneState, setSceneState } from "./scene-state.js";

let previewSuspended = 0;
const clone = value => foundry.utils.deepClone(value);
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function publishedReserve() {
  const value = game.settings.get(MODULE_ID, SETTING_KEYS.RESERVE_ACTORS);
  return Array.isArray(value) ? value.map(entry => normalizePortraitEntry(entry)).filter(Boolean) : [];
}

export function capturePublishedSnapshot(scene = canvas.scene) {
  return {
    sceneId: scene?.id ?? null,
    scene: scene ? getSceneState(scene) : createDefaultSceneState(),
    persistent: getPersistentState(),
    reserve: publishedReserve()
  };
}

function normalizeSnapshot(source, scene = canvas.scene) {
  return {
    sceneId: scene?.id ?? source?.sceneId ?? null,
    scene: normalizeSceneState(source?.scene),
    persistent: normalizeSceneState(source?.persistent),
    reserve: Array.isArray(source?.reserve)
      ? source.reserve.map(entry => normalizePortraitEntry(entry)).filter(Boolean)
      : []
  };
}

function mergeArray(base, draft, current, path, conflicts) {
  const keyed = [...base, ...draft, ...current].every(item => item && typeof item === "object" && typeof item.id === "string");
  if (!keyed) {
    if (equal(draft, base)) return clone(current);
    if (!equal(current, base) && !equal(current, draft)) conflicts.push(path);
    return clone(draft);
  }
  const maps = [base, draft, current].map(items => new Map(items.map(item => [item.id, item])));
  const [baseMap, draftMap, currentMap] = maps;
  const draftChangedOrder = !equal(draft.map(item => item.id), base.map(item => item.id));
  const order = [...(draftChangedOrder ? draft : current)].map(item => item.id);
  for (const item of current) if (!order.includes(item.id)) order.push(item.id);
  return order.flatMap(id => {
    const b = baseMap.get(id);
    const d = draftMap.get(id);
    const c = currentMap.get(id);
    if (d === undefined && b !== undefined) {
      if (c !== undefined && !equal(c, b)) conflicts.push(`${path}.${id}`);
      return [];
    }
    if (d === undefined) return c === undefined ? [] : [clone(c)];
    if (c === undefined && b !== undefined) {
      if (!equal(d, b)) conflicts.push(`${path}.${id}`);
      return equal(d, b) ? [] : [clone(d)];
    }
    if (b === undefined) return [clone(d ?? c)];
    return [mergeValue(b, d, c, `${path}.${id}`, conflicts)];
  });
}

function mergeValue(base, draft, current, path, conflicts) {
  if (equal(draft, base)) return clone(current);
  if (equal(current, base) || equal(current, draft)) return clone(draft);
  if (Array.isArray(base) && Array.isArray(draft) && Array.isArray(current)) return mergeArray(base, draft, current, path, conflicts);
  if (base && draft && current && typeof base === "object" && typeof draft === "object" && typeof current === "object") {
    const result = {};
    for (const key of new Set([...Object.keys(base), ...Object.keys(draft), ...Object.keys(current)])) {
      result[key] = mergeValue(base[key], draft[key], current[key], path ? `${path}.${key}` : key, conflicts);
      if (result[key] === undefined) delete result[key];
    }
    return result;
  }
  conflicts.push(path);
  return clone(draft);
}

function effectiveDraft(session, scene = canvas.scene) {
  if (!session.draft || session.draft.sceneId !== scene?.id) return null;
  const current = normalizeSnapshot(capturePublishedSnapshot(scene), scene);
  const base = normalizeSnapshot(session.base ?? current, scene);
  const conflicts = [];
  return {
    snapshot: mergeValue(base, normalizeSnapshot(session.draft, scene), current, "", conflicts),
    conflicts: [...new Set(conflicts.filter(Boolean))]
  };
}

export function getPreviewSession() {
  const raw = game.settings.get(MODULE_ID, SETTING_KEYS.PREVIEW_SESSION);
  const base = raw?.base && typeof raw.base === "object" ? clone(raw.base) : null;
  const draft = raw?.draft && typeof raw.draft === "object" ? clone(raw.draft) : null;
  return {
    active: Boolean(draft),
    dirty: Boolean(draft && !equal(raw?.presetId ? raw?.resetDraft : base, draft)),
    base,
    draft,
    drafts: raw?.drafts && typeof raw.drafts === "object" ? clone(raw.drafts) : {},
    presetId: typeof raw?.presetId === "string" ? raw.presetId : null,
    presetName: typeof raw?.presetName === "string" ? raw.presetName : null,
    resetDraft: raw?.resetDraft && typeof raw.resetDraft === "object" ? clone(raw.resetDraft) : null,
    returnBase: raw?.returnBase && typeof raw.returnBase === "object" ? clone(raw.returnBase) : null,
    returnDraft: raw?.returnDraft && typeof raw.returnDraft === "object" ? clone(raw.returnDraft) : null,
    conflicts: Array.isArray(raw?.conflicts) ? [...raw.conflicts] : []
  };
}

export function isPreviewActive() {
  return previewSuspended === 0 && game.user?.isGM === true && getPreviewSession().draft?.sceneId === globalThis.canvas?.scene?.id;
}

export async function withoutPreview(callback) {
  previewSuspended += 1;
  try { return await callback(); } finally { previewSuspended -= 1; }
}

async function store(session) {
  const drafts = { ...(session.drafts ?? {}) };
  if (session.draft?.sceneId) drafts[session.draft.sceneId] = {
    base: clone(session.base), draft: clone(session.draft), presetId: session.presetId,
    presetName: session.presetName, resetDraft: clone(session.resetDraft),
    returnBase: clone(session.returnBase), returnDraft: clone(session.returnDraft),
    conflicts: [...(session.conflicts ?? [])]
  };
  await game.settings.set(MODULE_ID, SETTING_KEYS.PREVIEW_SESSION, { ...session, drafts });
  Hooks.callAll(HOOKS.STATE_CHANGED, { preview: true });
  return getPreviewSession();
}

export async function ensurePreviewDraft(scene = canvas.scene) {
  if (!game.user?.isGM || !scene) return getPreviewSession();
  const current = getPreviewSession();
  if (current.draft?.sceneId === scene.id && current.base) return current;
  const saved = current.drafts?.[scene.id];
  if (saved?.draft) return store({ ...current, ...saved });
  const published = normalizeSnapshot(capturePublishedSnapshot(scene), scene);
  return store({ ...current, base: published, draft: clone(published), presetId: null, presetName: null, resetDraft: null, returnBase: null, returnDraft: null, conflicts: [] });
}

export async function togglePreview(scene = canvas.scene) {
  await ensurePreviewDraft(scene);
  const visible = game.settings.get(MODULE_ID, SETTING_KEYS.GM_STAGE_VISIBLE);
  await game.settings.set(MODULE_ID, SETTING_KEYS.GM_STAGE_VISIBLE, !visible);
  Hooks.callAll(HOOKS.STATE_CHANGED, { previewVisibility: true });
  return getPreviewSession();
}

export async function syncPreviewScene(scene = canvas.scene) { return ensurePreviewDraft(scene); }

export async function resetPreview(scene = canvas.scene) {
  const current = await ensurePreviewDraft(scene);
  if (current.presetId && current.resetDraft?.sceneId === scene?.id) {
    return store({ ...current, draft: clone(current.resetDraft), conflicts: [] });
  }
  const published = normalizeSnapshot(capturePublishedSnapshot(scene), scene);
  return store({ ...current, base: published, draft: clone(published), presetId: null, presetName: null, resetDraft: null, returnBase: null, returnDraft: null, conflicts: [] });
}

export function getPreviewConflicts(scene = canvas.scene) {
  const session = getPreviewSession();
  return [...new Set([...(session.conflicts ?? []), ...(effectiveDraft(session, scene)?.conflicts ?? [])])];
}

export function getPreviewSnapshot(scene = canvas.scene) {
  return effectiveDraft(getPreviewSession(), scene)?.snapshot ?? normalizeSnapshot(capturePublishedSnapshot(scene), scene);
}

export function getPreviewLayer(layer, scene = canvas.scene) {
  const effective = effectiveDraft(getPreviewSession(), scene)?.snapshot;
  if (!effective) return null;
  return normalizeSceneState(layer === CAST_LAYERS.PERSISTENT ? effective.persistent : effective.scene);
}

export async function setPreviewLayer(layer, state, scene = canvas.scene) {
  const session = await ensurePreviewDraft(scene);
  const effective = effectiveDraft(session, scene)?.snapshot ?? normalizeSnapshot(capturePublishedSnapshot(scene), scene);
  const conflicts = getPreviewConflicts(scene);
  const published = normalizeSnapshot(capturePublishedSnapshot(scene), scene);
  const draft = clone(effective);
  draft[layer === CAST_LAYERS.PERSISTENT ? "persistent" : "scene"] = normalizeSceneState(state);
  return store({ ...session, base: published, draft, conflicts });
}

export function getPreviewReserve(scene = canvas.scene) {
  const effective = effectiveDraft(getPreviewSession(), scene)?.snapshot;
  return effective ? clone(effective.reserve) : null;
}

export async function setPreviewReserve(entries, scene = canvas.scene) {
  const session = await ensurePreviewDraft(scene);
  const effective = effectiveDraft(session, scene)?.snapshot ?? normalizeSnapshot(capturePublishedSnapshot(scene), scene);
  const conflicts = getPreviewConflicts(scene);
  const published = normalizeSnapshot(capturePublishedSnapshot(scene), scene);
  const draft = clone(effective);
  draft.reserve = entries.map(entry => normalizePortraitEntry(entry)).filter(Boolean);
  return store({ ...session, base: published, draft, conflicts });
}

export function previewIsStale(scene = canvas.scene) { return getPreviewConflicts(scene).length > 0; }

async function rememberActiveVariants(snapshot) {
  const byActor = new Map();
  const rememberLayer = entries => {
    for (const entry of entries) byActor.set(entry.actorUuid, entry);
  };
  // A staged entry overrides the reserve copy (favorites may intentionally
  // exist in both places), and the visible scene entry overrides its base.
  rememberLayer(snapshot.reserve);
  rememberLayer(Object.values(GROUP_IDS).flatMap(id => snapshot.persistent.groups[id].entries));
  rememberLayer(Object.values(GROUP_IDS).flatMap(id => snapshot.scene.groups[id].entries));
  for (const entry of byActor.values()) {
    const actor = await fromUuid(entry.actorUuid);
    if (actor?.documentName !== "Actor") continue;
    const library = getActorLibrary(actor);
    if (library.variants.some(variant => variant.id === entry.activeVariantId) && library.lastActiveVariantId !== entry.activeVariantId) {
      await setActorLibrary(actor, { ...library, lastActiveVariantId: entry.activeVariantId });
    }
  }
}

function mergeState(target, source) {
  const result = normalizeSceneState(target);
  const incoming = normalizeSceneState(source);
  for (const groupId of Object.values(GROUP_IDS)) {
    for (const entry of incoming.groups[groupId].entries) {
      let found = null;
      for (const id of Object.values(GROUP_IDS)) {
        const index = result.groups[id].entries.findIndex(item => item.actorUuid === entry.actorUuid);
        if (index >= 0) found = { id, index, entry: result.groups[id].entries[index] };
      }
      if (found) result.groups[found.id].entries.splice(found.index, 1);
      result.groups[groupId].entries.push({ ...clone(entry), id: found?.entry.id ?? entry.id });
    }
  }
  result.layout = { ...result.layout, ...incoming.layout };
  return normalizeSceneState(result);
}

function mergeReserve(target, source) {
  const result = target.map(entry => clone(entry));
  for (const entry of source) {
    const index = result.findIndex(item => item.actorUuid === entry.actorUuid);
    if (index >= 0) result[index] = { ...clone(entry), id: result[index].id };
    else result.push(clone(entry));
  }
  return result;
}

export async function applyPreview(scene = canvas.scene, { castMode = "replaceAll", reserveMode = "replace" } = {}) {
  const session = await ensurePreviewDraft(scene);
  const effective = effectiveDraft(session, scene)?.snapshot;
  if (!effective) return false;
  const current = normalizeSnapshot(capturePublishedSnapshot(scene), scene);
  let sceneState = effective.scene;
  let persistentState = effective.persistent;
  if (castMode === "merge") {
    sceneState = mergeState(current.scene, effective.scene);
    persistentState = mergeState(current.persistent, effective.persistent);
  } else if (castMode === "replaceScene") persistentState = current.persistent;
  else if (castMode === "replacePersistent") sceneState = current.scene;
  let reserve = effective.reserve;
  if (reserveMode === "keep") reserve = current.reserve;
  else if (reserveMode === "merge") reserve = mergeReserve(current.reserve, effective.reserve);
  await setSceneState(scene, sceneState);
  await setPersistentState(persistentState);
  await game.settings.set(MODULE_ID, SETTING_KEYS.RESERVE_ACTORS, reserve);
  await rememberActiveVariants({ scene: sceneState, persistent: persistentState, reserve });
  const published = normalizeSnapshot(capturePublishedSnapshot(scene), scene);
  await store({ ...session, base: published, draft: clone(published), presetId: null, presetName: null, resetDraft: null, returnBase: null, returnDraft: null, conflicts: [] });
  return true;
}

export async function replacePreviewDraft(snapshot, scene = canvas.scene, { presetId = null, presetName = null } = {}) {
  const normalized = normalizeSnapshot(snapshot, scene);
  const current = getPreviewSession();
  const published = normalizeSnapshot(capturePublishedSnapshot(scene), scene);
  return store({
    ...current,
    base: published,
    draft: clone(normalized),
    presetId,
    presetName,
    resetDraft: presetId ? clone(normalized) : null,
    returnBase: presetId && !current.presetId ? clone(current.base) : current.returnBase,
    returnDraft: presetId && !current.presetId ? clone(current.draft) : current.returnDraft,
    conflicts: []
  });
}

export async function closePreviewPreset(scene = canvas.scene) {
  const current = getPreviewSession();
  if (!current.presetId) return current;
  const published = normalizeSnapshot(capturePublishedSnapshot(scene), scene);
  return store({
    ...current,
    base: current.returnBase ?? published,
    draft: current.returnDraft ?? clone(published),
    presetId: null,
    presetName: null,
    resetDraft: null,
    returnBase: null,
    returnDraft: null,
    conflicts: []
  });
}

export async function markPreviewPresetSaved(snapshot) {
  const current = getPreviewSession();
  if (!current.presetId) return current;
  const normalized = normalizeSnapshot(snapshot, canvas.scene);
  return store({ ...current, draft: clone(normalized), resetDraft: clone(normalized) });
}
