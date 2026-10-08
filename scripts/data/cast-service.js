import { CAST_LAYERS, GROUP_IDS } from "../constants.js";
import { getActorLibrary, setActorLibrary } from "./actor-library.js";
import { createPortraitEntry, normalizeGroupId } from "./portrait-entry.js";
import { getPersistentState, setPersistentState } from "./persistent-state.js";
import { getSceneState, setSceneState } from "./scene-state.js";
import { getPreviewLayer, isPreviewActive, setPreviewLayer } from "./preview-service.js";

function requireGm() {
  if (!game.user?.isGM) throw new Error(game.i18n.localize("RNPS.Notifications.GmOnly"));
}

function requireScene(scene) {
  if (!scene) throw new Error(game.i18n.localize("RNPS.Notifications.SceneUnavailable"));
}

function normalizeLayer(layer) {
  return layer === CAST_LAYERS.PERSISTENT ? CAST_LAYERS.PERSISTENT : CAST_LAYERS.SCENE;
}

function getLayerState(layer, scene) {
  if (isPreviewActive()) return getPreviewLayer(normalizeLayer(layer), scene) ?? (
    normalizeLayer(layer) === CAST_LAYERS.PERSISTENT ? getPersistentState() : getSceneState(scene)
  );
  return normalizeLayer(layer) === CAST_LAYERS.PERSISTENT ? getPersistentState() : getSceneState(scene);
}

async function setLayerState(layer, scene, state) {
  if (isPreviewActive()) return setPreviewLayer(normalizeLayer(layer), state, scene);
  return normalizeLayer(layer) === CAST_LAYERS.PERSISTENT
    ? setPersistentState(state)
    : setSceneState(scene, state);
}

function findEntryLocation(state, entryId) {
  for (const groupId of Object.values(GROUP_IDS)) {
    const index = state.groups[groupId].entries.findIndex(entry => entry.id === entryId);
    if (index >= 0) return { groupId, index, entry: state.groups[groupId].entries[index] };
  }
  return null;
}

function resequence(state) {
  for (const groupId of Object.values(GROUP_IDS)) {
    state.groups[groupId].entries.forEach((entry, index) => {
      entry.groupId = groupId;
      entry.sort = (index + 1) * 1000;
    });
  }
  return state;
}

export function getCastLayers(scene = canvas.scene) {
  return {
    [CAST_LAYERS.PERSISTENT]: getLayerState(CAST_LAYERS.PERSISTENT, scene),
    [CAST_LAYERS.SCENE]: getLayerState(CAST_LAYERS.SCENE, scene)
  };
}

export function getCombinedCastState(scene = canvas.scene) {
  const layers = getCastLayers(scene);
  const combined = foundry.utils.deepClone(layers[CAST_LAYERS.PERSISTENT]);
  const sceneState = layers[CAST_LAYERS.SCENE];
  const overriddenActors = new Set(
    Object.values(GROUP_IDS).flatMap(id => sceneState.groups[id].entries.map(entry => entry.actorUuid))
  );
  for (const groupId of Object.values(GROUP_IDS)) {
    combined.groups[groupId].entries = combined.groups[groupId].entries
      .filter(entry => !overriddenActors.has(entry.actorUuid))
      .map(entry => ({ ...entry, layer: CAST_LAYERS.PERSISTENT }));
    combined.groups[groupId].entries.push(
      ...sceneState.groups[groupId].entries.map(entry => ({ ...entry, layer: CAST_LAYERS.SCENE }))
    );
    combined.groups[groupId].entries.sort((a, b) => a.sort - b.sort);
  }
  combined.layout.pcPortraitSize = sceneState.layout.pcPortraitSize
    ?? layers[CAST_LAYERS.PERSISTENT].layout.pcPortraitSize;
  combined.layout.npcPortraitSize = sceneState.layout.npcPortraitSize
    ?? layers[CAST_LAYERS.PERSISTENT].layout.npcPortraitSize;
  combined.layout.tokenHighlight = sceneState.layout.tokenHighlight;
  return resequence(combined);
}

export async function addActorToCast(actorUuid, {
  scene = canvas.scene,
  layer = null,
  groupId = GROUP_IDS.PCS,
  index = null
} = {}) {
  requireGm();
  const normalizedLayer = normalizeLayer(layer ?? (
    normalizeGroupId(groupId) === GROUP_IDS.PCS ? CAST_LAYERS.PERSISTENT : CAST_LAYERS.SCENE
  ));
  if (normalizedLayer === CAST_LAYERS.SCENE) requireScene(scene);
  const actor = await fromUuid(actorUuid);
  if (actor?.documentName !== "Actor") {
    throw new Error(game.i18n.localize("RNPS.Notifications.ActorUnavailable"));
  }
  const state = getLayerState(normalizedLayer, scene);
  const existing = Object.values(GROUP_IDS).flatMap(id => state.groups[id].entries)
    .find(entry => entry.actorUuid === actor.uuid);
  if (existing) return moveCastEntry(existing.id, { scene, layer: normalizedLayer, groupId, index });
  const targetGroupId = normalizeGroupId(groupId);
  const library = getActorLibrary(actor);
  const entry = createPortraitEntry(actor.uuid, {
    groupId: targetGroupId,
    activeVariantId: library.lastActiveVariantId ?? library.defaultVariantId
  });
  const existingSorts = getCombinedCastState(scene).groups[targetGroupId].entries.map(item => item.sort);
  entry.sort = (Math.max(0, ...existingSorts) || 0) + 1000;
  const target = state.groups[targetGroupId].entries;
  target.splice(normalizeInsertIndex(index, target.length), 0, entry);
  await setLayerState(normalizedLayer, scene, state);
  if (Number.isInteger(index)) {
    await moveCastEntry(entry.id, { scene, layer: normalizedLayer, groupId: targetGroupId, index });
  }
  return entry;
}

export async function removeCastEntry(entryId, { scene = canvas.scene, layer = CAST_LAYERS.SCENE } = {}) {
  requireGm();
  const normalizedLayer = normalizeLayer(layer);
  if (normalizedLayer === CAST_LAYERS.SCENE) requireScene(scene);
  const state = getLayerState(normalizedLayer, scene);
  const location = findEntryLocation(state, entryId);
  if (!location) return false;
  state.groups[location.groupId].entries.splice(location.index, 1);
  await setLayerState(normalizedLayer, scene, state);
  return true;
}

export function getCastEntry(entryId, { scene = canvas.scene, layer = null } = {}) {
  const layers = getCastLayers(scene);
  const order = layer ? [normalizeLayer(layer)] : [CAST_LAYERS.SCENE, CAST_LAYERS.PERSISTENT];
  for (const layerId of order) {
    const entry = findEntryLocation(layers[layerId], entryId)?.entry;
    if (entry) return { ...entry, layer: layerId };
  }
  return null;
}

export async function updateCastEntry(entryId, changes, {
  scene = canvas.scene,
  layer = changes.layer ?? CAST_LAYERS.SCENE
} = {}) {
  requireGm();
  const sourceLayer = normalizeLayer(layer);
  if (sourceLayer === CAST_LAYERS.SCENE) requireScene(scene);
  const state = getLayerState(sourceLayer, scene);
  const location = findEntryLocation(state, entryId);
  if (!location) throw new Error(`Portrait entry '${entryId}' was not found.`);
  const targetLayer = normalizeLayer(changes.targetLayer ?? sourceLayer);
  const targetGroupId = normalizeGroupId(changes.groupId ?? location.groupId);
  const updated = {
    ...location.entry,
    groupId: targetGroupId,
    visible: changes.visible ?? location.entry.visible,
    mirrored: changes.mirrored ?? location.entry.mirrored,
    activeVariantId: changes.activeVariantId ?? location.entry.activeVariantId,
    userVariants: changes.userVariants === undefined
      ? location.entry.userVariants
      : { ...changes.userVariants },
    labelOverride: changes.labelOverride === undefined ? location.entry.labelOverride : changes.labelOverride,
    flags: changes.flags === undefined
      ? location.entry.flags
      : foundry.utils.mergeObject(location.entry.flags ?? {}, changes.flags, { inplace: false })
  };
  state.groups[location.groupId].entries.splice(location.index, 1);
  if (targetLayer === sourceLayer) {
    const target = state.groups[targetGroupId].entries;
    target.splice(targetGroupId === location.groupId ? location.index : target.length, 0, updated);
    await setLayerState(sourceLayer, scene, state);
  } else {
    const layers = getCastLayers(scene);
    normalizeCombinedOrders(layers);
    const normalizedSource = layers[sourceLayer];
    const normalizedLocation = findEntryLocation(normalizedSource, entryId);
    const [transferred] = normalizedSource.groups[normalizedLocation.groupId].entries
      .splice(normalizedLocation.index, 1);
    const targetState = layers[targetLayer];
    for (const id of Object.values(GROUP_IDS)) {
      targetState.groups[id].entries = targetState.groups[id].entries
        .filter(entry => entry.actorUuid !== transferred.actorUuid);
    }
    targetState.groups[targetGroupId].entries.push({ ...transferred, ...updated, sort: transferred.sort });
    await setLayerState(targetLayer, scene, targetState);
    await setLayerState(sourceLayer, scene, normalizedSource);
  }
  if (changes.activeVariantId && !isPreviewActive()) {
    const actor = await fromUuid(updated.actorUuid);
    if (actor?.documentName === "Actor") {
      const library = getActorLibrary(actor);
      if (library.variants.some(variant => variant.id === changes.activeVariantId)) {
        await setActorLibrary(actor, { ...library, lastActiveVariantId: changes.activeVariantId });
      }
    }
  }
  return { ...updated, groupId: targetGroupId, layer: targetLayer };
}

export async function moveCastEntry(entryId, {
  scene = canvas.scene,
  layer = CAST_LAYERS.SCENE,
  groupId,
  index = null
} = {}) {
  requireGm();
  const normalizedLayer = normalizeLayer(layer);
  if (normalizedLayer === CAST_LAYERS.SCENE) requireScene(scene);
  const layers = getCastLayers(scene);
  normalizeCombinedOrders(layers);
  const state = layers[normalizedLayer];
  const location = findEntryLocation(state, entryId);
  if (!location) throw new Error(`Portrait entry '${entryId}' was not found.`);
  const sourceGroupId = location.groupId;
  const originalOrder = buildEffectiveGroup(layers, sourceGroupId);
  const originalIndex = originalOrder.findIndex(item => item.id === entryId && item.layer === normalizedLayer);
  const [entry] = state.groups[sourceGroupId].entries.splice(location.index, 1);
  const targetGroupId = normalizeGroupId(groupId ?? location.groupId);
  state.groups[targetGroupId].entries.push(entry);
  const targetOrder = buildEffectiveGroup(layers, targetGroupId)
    .filter(item => !(item.id === entryId && item.layer === normalizedLayer));
  let insertIndex = normalizeInsertIndex(index, targetOrder.length);
  if (targetGroupId === sourceGroupId && Number.isInteger(index) && originalIndex < index) {
    insertIndex = Math.max(0, insertIndex - 1);
  }
  targetOrder.splice(insertIndex, 0, { ...entry, groupId: targetGroupId, layer: normalizedLayer });
  applyEffectiveOrder(layers, targetGroupId, targetOrder);
  if (targetGroupId !== sourceGroupId) {
    applyEffectiveOrder(layers, sourceGroupId, buildEffectiveGroup(layers, sourceGroupId));
  }
  await setLayerState(CAST_LAYERS.SCENE, scene, layers[CAST_LAYERS.SCENE]);
  await setLayerState(CAST_LAYERS.PERSISTENT, scene, layers[CAST_LAYERS.PERSISTENT]);
  return { ...entry, groupId: targetGroupId, layer: normalizedLayer };
}

export async function setCastPortraitSize(size, {
  scene = canvas.scene,
  layer = CAST_LAYERS.SCENE,
  groupId = GROUP_IDS.PCS
} = {}) {
  requireGm();
  const normalizedLayer = normalizeLayer(layer);
  if (normalizedLayer === CAST_LAYERS.SCENE) requireScene(scene);
  const state = getLayerState(normalizedLayer, scene);
  const key = normalizeGroupId(groupId) === GROUP_IDS.NPCS ? "npcPortraitSize" : "pcPortraitSize";
  state.layout[key] = Number.isFinite(size) ? Math.max(48, Math.min(480, size)) : null;
  return setLayerState(normalizedLayer, scene, state);
}

export async function setCastTokenHighlight(value, { scene = canvas.scene } = {}) {
  requireGm();
  requireScene(scene);
  const state = getLayerState(CAST_LAYERS.SCENE, scene);
  state.layout.tokenHighlight = typeof value === "boolean" ? value : null;
  return setLayerState(CAST_LAYERS.SCENE, scene, state);
}

export async function clearCast({ scene = canvas.scene, layer = CAST_LAYERS.SCENE, groupId = null } = {}) {
  requireGm();
  const normalizedLayer = normalizeLayer(layer);
  if (normalizedLayer === CAST_LAYERS.SCENE) requireScene(scene);
  const state = getLayerState(normalizedLayer, scene);
  if (groupId) state.groups[normalizeGroupId(groupId)].entries = [];
  else for (const id of Object.values(GROUP_IDS)) state.groups[id].entries = [];
  await setLayerState(normalizedLayer, scene, state);
}

function normalizeInsertIndex(index, length) {
  if (!Number.isInteger(index)) return length;
  return Math.max(0, Math.min(index, length));
}

function buildEffectiveGroup(layers, groupId) {
  const sceneActors = new Set(Object.values(GROUP_IDS).flatMap(id => (
    layers[CAST_LAYERS.SCENE].groups[id].entries.map(entry => entry.actorUuid)
  )));
  return [
    ...layers[CAST_LAYERS.PERSISTENT].groups[groupId].entries
      .filter(entry => !sceneActors.has(entry.actorUuid))
      .map(entry => ({ ...entry, layer: CAST_LAYERS.PERSISTENT })),
    ...layers[CAST_LAYERS.SCENE].groups[groupId].entries
      .map(entry => ({ ...entry, layer: CAST_LAYERS.SCENE }))
  ].sort((a, b) => a.sort - b.sort);
}

function applyEffectiveOrder(layers, groupId, entries) {
  entries.forEach((entry, index) => {
    const stored = layers[entry.layer].groups[groupId].entries.find(item => item.id === entry.id);
    if (stored) {
      stored.groupId = groupId;
      stored.sort = (index + 1) * 1000;
    }
  });
}

function normalizeCombinedOrders(layers) {
  for (const groupId of Object.values(GROUP_IDS)) {
    applyEffectiveOrder(layers, groupId, buildEffectiveGroup(layers, groupId));
  }
}
