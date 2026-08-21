import { CAST_LAYERS, GROUP_IDS, HOOKS, MODULE_ID, SETTING_KEYS } from "../constants.js";
import { normalizePortraitEntry } from "./portrait-entry.js";
import { getPersistentState, setPersistentState } from "./persistent-state.js";
import { createDefaultSceneState, getSceneState, normalizeSceneState, setSceneState } from "./scene-state.js";

let previewSuspended = 0;

function clone(value) {
  return foundry.utils.deepClone(value);
}

function publishedReserve() {
  const value = game.settings.get(MODULE_ID, SETTING_KEYS.RESERVE_ACTORS);
  if (!Array.isArray(value)) return [];
  return value.map(entry => normalizePortraitEntry(entry)).filter(Boolean);
}

function revisionOf(snapshot) {
  const text = JSON.stringify(snapshot);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function capturePublishedSnapshot(scene = canvas.scene) {
  const snapshot = {
    sceneId: scene?.id ?? null,
    scene: scene ? getSceneState(scene) : createDefaultSceneState(),
    persistent: getPersistentState(),
    reserve: publishedReserve()
  };
  return { ...snapshot, revision: revisionOf(snapshot) };
}

export function getPreviewSession() {
  const raw = game.settings.get(MODULE_ID, SETTING_KEYS.PREVIEW_SESSION);
  return {
    active: raw?.active === true,
    dirty: raw?.dirty === true,
    baseRevision: typeof raw?.baseRevision === "string" ? raw.baseRevision : null,
    draft: raw?.draft && typeof raw.draft === "object" ? clone(raw.draft) : null,
    drafts: raw?.drafts && typeof raw.drafts === "object" ? clone(raw.drafts) : {},
    presetId: typeof raw?.presetId === "string" ? raw.presetId : null,
    presetName: typeof raw?.presetName === "string" ? raw.presetName : null,
    resetDraft: raw?.resetDraft && typeof raw.resetDraft === "object" ? clone(raw.resetDraft) : null
  };
}

export function isPreviewActive() {
  const session = getPreviewSession();
  const sceneId = globalThis.canvas?.scene?.id ?? null;
  return previewSuspended === 0
    && game.user?.isGM === true
    && session.active
    && (!sceneId || session.draft?.sceneId === sceneId);
}

export async function withoutPreview(callback) {
  previewSuspended += 1;
  try {
    return await callback();
  } finally {
    previewSuspended -= 1;
  }
}

async function store(session) {
  const drafts = { ...(session.drafts ?? {}) };
  if (session.draft?.sceneId) drafts[session.draft.sceneId] = clone(session.draft);
  await game.settings.set(MODULE_ID, SETTING_KEYS.PREVIEW_SESSION, { ...session, drafts });
  Hooks.callAll(HOOKS.STATE_CHANGED, { preview: true });
  return getPreviewSession();
}

export async function togglePreview(scene = canvas.scene) {
  const current = getPreviewSession();
  if (current.active && current.draft?.sceneId === scene?.id) return store({ ...current, active: false });
  const published = capturePublishedSnapshot(scene);
  const savedDraft = current.draft?.sceneId === published.sceneId
    ? current.draft
    : current.drafts?.[published.sceneId];
  const canResume = savedDraft?.sceneId === published.sceneId;
  return store(canResume
    ? { ...current, active: true, dirty: true, draft: savedDraft }
    : {
      ...current,
      active: true,
      dirty: false,
      baseRevision: published.revision,
      draft: published,
      presetId: null,
      presetName: null,
      resetDraft: null
    });
}

export async function syncPreviewScene(scene = canvas.scene) {
  const current = getPreviewSession();
  if (!current.active || current.draft?.sceneId === scene?.id) return current;
  const published = capturePublishedSnapshot(scene);
  const savedDraft = current.drafts?.[published.sceneId];
  return store(savedDraft
    ? { ...current, active: true, dirty: true, draft: savedDraft }
    : { ...current, active: true, dirty: false, baseRevision: published.revision, draft: published });
}

export async function resetPreview(scene = canvas.scene) {
  const current = getPreviewSession();
  if (current.presetId && current.resetDraft?.sceneId === scene?.id) {
    return store({ ...current, active: true, dirty: false, draft: clone(current.resetDraft) });
  }
  const published = capturePublishedSnapshot(scene);
  return store({ ...current, active: true, dirty: false, baseRevision: published.revision, draft: published });
}

export function getPreviewLayer(layer, scene = canvas.scene) {
  const session = getPreviewSession();
  if (!session.active || !session.draft || session.draft.sceneId !== scene?.id) return null;
  return normalizeSceneState(layer === CAST_LAYERS.PERSISTENT
    ? session.draft.persistent
    : session.draft.scene);
}

export async function setPreviewLayer(layer, state, scene = canvas.scene) {
  const session = getPreviewSession();
  if (!session.active) return null;
  const draft = session.draft ?? capturePublishedSnapshot(scene);
  draft.sceneId = scene?.id ?? null;
  draft[layer === CAST_LAYERS.PERSISTENT ? "persistent" : "scene"] = normalizeSceneState(state);
  return store({ ...session, dirty: true, draft });
}

export function getPreviewReserve(scene = canvas.scene) {
  const session = getPreviewSession();
  if (!session.active || !session.draft || session.draft.sceneId !== scene?.id) return null;
  return clone(session.draft.reserve ?? []).map(entry => normalizePortraitEntry(entry)).filter(Boolean);
}

export async function setPreviewReserve(entries, scene = canvas.scene) {
  const session = getPreviewSession();
  if (!session.active) return null;
  const draft = session.draft ?? capturePublishedSnapshot(scene);
  draft.reserve = entries.map(entry => normalizePortraitEntry(entry)).filter(Boolean);
  return store({ ...session, dirty: true, draft });
}

export function previewIsStale(scene = canvas.scene) {
  const session = getPreviewSession();
  return Boolean(session.draft && session.baseRevision && session.baseRevision !== capturePublishedSnapshot(scene).revision);
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

export async function applyPreview(scene = canvas.scene, {
  castMode = "replaceAll",
  reserveMode = "replace"
} = {}) {
  const session = getPreviewSession();
  if (!session.draft || session.draft.sceneId !== scene?.id) return false;
  const publishedBefore = capturePublishedSnapshot(scene);
  let sceneState = publishedBefore.scene;
  let persistentState = publishedBefore.persistent;
  if (castMode === "merge") {
    sceneState = mergeState(sceneState, session.draft.scene);
    persistentState = mergeState(persistentState, session.draft.persistent);
  } else if (castMode === "replaceScene") sceneState = session.draft.scene;
  else if (castMode === "replacePersistent") persistentState = session.draft.persistent;
  else {
    sceneState = session.draft.scene;
    persistentState = session.draft.persistent;
  }
  let reserve = publishedBefore.reserve;
  if (reserveMode === "merge") reserve = mergeReserve(reserve, session.draft.reserve ?? []);
  else if (reserveMode === "replace") reserve = session.draft.reserve ?? [];
  await setSceneState(scene, sceneState);
  await setPersistentState(persistentState);
  await game.settings.set(MODULE_ID, SETTING_KEYS.RESERVE_ACTORS, reserve);
  const published = capturePublishedSnapshot(scene);
  await store({ ...session, active: true, dirty: false, baseRevision: published.revision, draft: published });
  return true;
}

export async function replacePreviewDraft(snapshot, scene = canvas.scene, {
  presetId = null,
  presetName = null
} = {}) {
  const normalized = {
    sceneId: scene?.id ?? null,
    scene: normalizeSceneState(snapshot?.scene),
    persistent: normalizeSceneState(snapshot?.persistent),
    reserve: Array.isArray(snapshot?.reserve)
      ? snapshot.reserve.map(entry => normalizePortraitEntry(entry)).filter(Boolean)
      : []
  };
  const published = capturePublishedSnapshot(scene);
  const current = getPreviewSession();
  return store({
    ...current,
    active: true,
    dirty: false,
    baseRevision: published.revision,
    draft: normalized,
    presetId,
    presetName,
    resetDraft: presetId ? clone(normalized) : null
  });
}

export async function markPreviewPresetSaved(snapshot) {
  const current = getPreviewSession();
  if (!current.presetId) return current;
  const normalized = {
    sceneId: current.draft?.sceneId ?? canvas.scene?.id ?? null,
    scene: normalizeSceneState(snapshot.scene),
    persistent: normalizeSceneState(snapshot.persistent),
    reserve: Array.isArray(snapshot.reserve)
      ? snapshot.reserve.map(entry => normalizePortraitEntry(entry)).filter(Boolean)
      : []
  };
  return store({ ...current, dirty: false, draft: normalized, resetDraft: clone(normalized) });
}
