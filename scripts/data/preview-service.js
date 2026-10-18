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
  const stored = game.settings.get(MODULE_ID, SETTING_KEYS.PREVIEW_SESSION);
  const restoreDraft = value => {
    if (!value?.presetId) return value;
    const { presetId, presetName, resetDraft, returnBase, returnDraft, ...draftState } = value;
    return { ...draftState, base: returnBase ?? null, draft: returnDraft ?? null };
  };
  const raw = restoreDraft(stored);
  const base = raw?.base && typeof raw.base === "object" ? clone(raw.base) : null;
  const draft = raw?.draft && typeof raw.draft === "object" ? clone(raw.draft) : null;
  return {
    active: Boolean(draft),
    dirty: Boolean(draft && !equal(base, draft)),
    base,
    draft,
    drafts: raw?.drafts && typeof raw.drafts === "object"
      ? Object.fromEntries(Object.entries(raw.drafts).map(([sceneId, value]) => [sceneId, restoreDraft(value)]))
      : {},
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
    base: clone(session.base), draft: clone(session.draft),
    conflicts: [...(session.conflicts ?? [])]
  };
  await game.settings.set(MODULE_ID, SETTING_KEYS.PREVIEW_SESSION, { ...session, drafts });
  Hooks.callAll(HOOKS.STATE_CHANGED, { preview: true });
  if (game.settings.get(MODULE_ID, SETTING_KEYS.PREVIEW_AUTO_APPLY)
    && session.draft?.sceneId === canvas.scene?.id
    && !equal(session.base, session.draft)) {
    await applyPreview(canvas.scene);
  }
  return getPreviewSession();
}

export async function setPreviewAutoApply(enabled, scene = canvas.scene) {
  if (!game.user?.isGM) return false;
  await game.settings.set(MODULE_ID, SETTING_KEYS.PREVIEW_AUTO_APPLY, enabled);
  const session = getPreviewSession();
  if (enabled && scene && session.draft?.sceneId === scene.id && session.dirty) {
    await applyPreview(scene);
  }
  return true;
}

export async function ensurePreviewDraft(scene = canvas.scene) {
  if (!game.user?.isGM || !scene) return getPreviewSession();
  const current = getPreviewSession();
  if (current.draft?.sceneId === scene.id && current.base) return current;
  const saved = current.drafts?.[scene.id];
  if (saved?.draft) return store({ ...current, ...saved });
  const published = normalizeSnapshot(capturePublishedSnapshot(scene), scene);
  return store({ ...current, base: published, draft: clone(published), conflicts: [] });
}

export async function syncPreviewScene(scene = canvas.scene) { return ensurePreviewDraft(scene); }

export async function resetPreview(scene = canvas.scene) {
  const current = await ensurePreviewDraft(scene);
  const published = normalizeSnapshot(capturePublishedSnapshot(scene), scene);
  return store({ ...current, base: published, draft: clone(published), conflicts: [] });
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

export async function syncImmediatePresentation(scene, mutateDraft, section) {
  const session = getPreviewSession();
  if (!session.draft || session.draft.sceneId !== scene?.id) return;
  const published = getSceneState(scene);
  const draft = clone(session.draft);
  const base = clone(session.base ?? capturePublishedSnapshot(scene));
  draft.scene = normalizeSceneState(draft.scene);
  base.scene = normalizeSceneState(base.scene);
  mutateDraft(draft.scene);
  draft.scene = normalizeSceneState(draft.scene);
  const sections = Array.isArray(section) ? section : [section];
  for (const key of sections) base.scene[key] = clone(published[key]);
  const prefixes = sections.map(key => `scene.${key}`);
  await store({
    ...session,
    base,
    draft,
    conflicts: (session.conflicts ?? []).filter(path => !prefixes.some(prefix => path === prefix || path.startsWith(`${prefix}.`)))
  });
}

export async function syncImmediateFocus(scene, mutateDraft) {
  const session = getPreviewSession();
  if (!session.draft || session.draft.sceneId !== scene?.id) return;
  const draft = clone(session.draft);
  const base = clone(session.base ?? capturePublishedSnapshot(scene));
  for (const layer of ["scene", "persistent"]) {
    draft[layer] = normalizeSceneState(draft[layer]);
    base[layer] = normalizeSceneState(base[layer]);
  }
  mutateDraft(draft.scene.focus, draft.persistent.focus);
  draft.scene = normalizeSceneState(draft.scene);
  draft.persistent = normalizeSceneState(draft.persistent);
  base.scene.focus = getSceneState(scene).focus;
  base.persistent.focus = getPersistentState().focus;
  await store({
    ...session, base, draft,
    conflicts: (session.conflicts ?? []).filter(path => !["scene.focus", "persistent.focus"].some(prefix => path === prefix || path.startsWith(`${prefix}.`)))
  });
}

export async function syncImmediateBackgroundSelection(scene) {
  const session = getPreviewSession();
  if (!session.draft || session.draft.sceneId !== scene?.id) return;
  const draft = clone(session.draft);
  const base = clone(session.base ?? capturePublishedSnapshot(scene));
  const publishedScene = getSceneState(scene);
  const publishedPersistent = getPersistentState();
  for (const snapshot of [draft, base]) {
    snapshot.scene = normalizeSceneState(snapshot.scene);
    snapshot.persistent = normalizeSceneState(snapshot.persistent);
    snapshot.scene.activeBackgroundId = publishedScene.activeBackgroundId;
    snapshot.scene.background = clone(publishedScene.background);
    snapshot.persistent.backgroundId = publishedPersistent.backgroundId;
    snapshot.persistent.backgroundFollowActive = publishedPersistent.backgroundFollowActive;
  }
  await store({
    ...session, base, draft,
    conflicts: (session.conflicts ?? []).filter(path => ![
      "scene.activeBackgroundId", "scene.background", "persistent.backgroundId", "persistent.backgroundFollowActive"
    ].some(prefix => path === prefix || path.startsWith(`${prefix}.`)))
  });
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
  rememberLayer(Object.values(snapshot.persistent.focus).map(item => item?.entry).filter(Boolean));
  rememberLayer(Object.values(snapshot.scene.focus).map(item => item?.entry).filter(Boolean));
  for (const entry of byActor.values()) {
    const actor = await fromUuid(entry.actorUuid);
    if (actor?.documentName !== "Actor") continue;
    const library = getActorLibrary(actor);
    if (library.variants.some(variant => variant.id === entry.activeVariantId) && library.lastActiveVariantId !== entry.activeVariantId) {
      await setActorLibrary(actor, { ...library, lastActiveVariantId: entry.activeVariantId });
    }
  }
}

export async function applyPreview(scene = canvas.scene) {
  const session = await ensurePreviewDraft(scene);
  const effective = effectiveDraft(session, scene)?.snapshot;
  if (!effective) return false;
  let sceneState = effective.scene;
  let persistentState = effective.persistent;
  // Background selection is immediate. A saved portrait draft must never restore
  // an older background when it is applied after a scene change.
  const publishedScene = getSceneState(scene);
  const publishedPersistent = getPersistentState();
  sceneState = normalizeSceneState({
    ...sceneState,
    background: publishedScene.background,
    activeBackgroundId: publishedScene.activeBackgroundId
  });
  sceneState.backgrounds = [];
  persistentState = normalizeSceneState({
    ...persistentState,
    backgroundId: publishedPersistent.backgroundId,
    backgroundFollowActive: publishedPersistent.backgroundFollowActive
  });
  const reserve = effective.reserve;
  await setSceneState(scene, sceneState);
  await setPersistentState(persistentState);
  await game.settings.set(MODULE_ID, SETTING_KEYS.RESERVE_ACTORS, reserve);
  await rememberActiveVariants({ scene: sceneState, persistent: persistentState, reserve });
  const published = normalizeSnapshot(capturePublishedSnapshot(scene), scene);
  await store({ ...session, base: published, draft: clone(published), conflicts: [] });
  return true;
}
