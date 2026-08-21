import { GROUP_IDS, MODULE_ID, SETTING_KEYS } from "../constants.js";
import { capturePublishedSnapshot, getPreviewSession, isPreviewActive, markPreviewPresetSaved, replacePreviewDraft } from "./preview-service.js";
import { normalizeSceneState, setSceneState } from "./scene-state.js";
import { setPersistentState } from "./persistent-state.js";
import { normalizePortraitEntry } from "./portrait-entry.js";

function clone(value) {
  return foundry.utils.deepClone(value);
}

function normalizePreset(source) {
  if (!source || typeof source !== "object") return null;
  return {
    id: String(source.id || foundry.utils.randomID()),
    name: String(source.name || game.i18n.localize("RNPS.Presets.Untitled")),
    createdAt: Number(source.createdAt) || Date.now(),
    updatedAt: Number(source.updatedAt) || Date.now(),
    scene: normalizeSceneState(source.scene),
    persistent: normalizeSceneState(source.persistent),
    reserve: Array.isArray(source.reserve)
      ? source.reserve.map(entry => normalizePortraitEntry(entry)).filter(Boolean)
      : []
  };
}

export function getCastPresets() {
  const value = game.settings.get(MODULE_ID, SETTING_KEYS.CAST_PRESETS);
  return (Array.isArray(value) ? value : []).map(normalizePreset).filter(Boolean);
}

async function store(presets) {
  await game.settings.set(MODULE_ID, SETTING_KEYS.CAST_PRESETS, presets.map(normalizePreset));
}

export async function saveCastPreset(name, scene = canvas.scene) {
  const session = getPreviewSession();
  const source = isPreviewActive() && session.draft?.sceneId === scene?.id
    ? session.draft
    : capturePublishedSnapshot(scene);
  const preset = normalizePreset({ ...clone(source), id: foundry.utils.randomID(), name });
  await store([...getCastPresets(), preset]);
  return preset;
}

export async function deleteCastPreset(id) {
  await store(getCastPresets().filter(preset => preset.id !== id));
}

export async function updateCastPreset(id, scene = canvas.scene) {
  const session = getPreviewSession();
  const preset = getCastPresets().find(item => item.id === id);
  if (!preset || !session.draft || session.draft.sceneId !== scene?.id) return false;
  const updated = normalizePreset({
    ...clone(session.draft),
    id: preset.id,
    name: preset.name,
    createdAt: preset.createdAt,
    updatedAt: Date.now()
  });
  await store(getCastPresets().map(item => item.id === id ? updated : item));
  await markPreviewPresetSaved(updated);
  return updated;
}

export async function previewCastPreset(id, scene = canvas.scene) {
  const preset = getCastPresets().find(item => item.id === id);
  if (!preset) return false;
  await replacePreviewDraft(preset, scene, { presetId: preset.id, presetName: preset.name });
  return true;
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

export async function applyCastPreset(id, {
  scene = canvas.scene,
  castMode = "merge",
  reserveMode = "keep"
} = {}) {
  const preset = getCastPresets().find(item => item.id === id);
  if (!preset || !scene) return false;
  const current = capturePublishedSnapshot(scene);
  let sceneState = current.scene;
  let persistentState = current.persistent;
  if (castMode === "merge") {
    sceneState = mergeState(sceneState, preset.scene);
    persistentState = mergeState(persistentState, preset.persistent);
  } else if (castMode === "replaceScene") sceneState = preset.scene;
  else if (castMode === "replacePersistent") persistentState = preset.persistent;
  else if (castMode === "replaceAll") {
    sceneState = preset.scene;
    persistentState = preset.persistent;
  }
  let reserve = current.reserve;
  if (reserveMode === "merge") reserve = mergeReserve(reserve, preset.reserve);
  else if (reserveMode === "replace") reserve = preset.reserve;
  await setSceneState(scene, sceneState);
  await setPersistentState(persistentState);
  await game.settings.set(MODULE_ID, SETTING_KEYS.RESERVE_ACTORS, reserve);
  return true;
}
