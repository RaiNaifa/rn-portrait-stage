import { GROUP_IDS, CAST_LAYERS } from "../constants.js";
import { getCombinedCastState, updateCastEntry } from "./cast-service.js";
import { getSceneState, normalizeFocusOrder, normalizeSceneState, setSceneState } from "./scene-state.js";
import { getPreviewLayer, isPreviewActive, setPreviewLayer, syncImmediateBackgroundSelection, syncImmediateFocus, syncImmediatePresentation, withoutPreview } from "./preview-service.js";
import { getPreviewReserve } from "./preview-service.js";
import { getReserveEntries } from "./reserve-service.js";
import { createPortraitEntry } from "./portrait-entry.js";
import { getStartingVariantId, rememberActorVariant } from "./actor-library.js";
import { getPersistentState, setPersistentState } from "./persistent-state.js";
import { getBackgroundLibrary, findBackground, addBackgroundVariant, removeBackgroundVariant, updateBackgroundVariant } from "./background-library.js";

const ZONES = ["left", "center", "right"];

export function getPresentation(scene = canvas.scene, { published = false } = {}) {
  if (!scene) {
    const empty = normalizeSceneState();
    return { focus: empty.focus, focusOrder: empty.focusOrder, background: empty.background, backgrounds: getBackgroundLibrary().backgrounds, activeBackgroundId: null, persistentBackgroundId: null };
  }
  const preview = !published && scene.id === canvas.scene?.id && isPreviewActive();
  const state = (preview ? getPreviewLayer("scene", scene) : null) ?? getSceneState(scene);
  const persistent = (preview ? getPreviewLayer(CAST_LAYERS.PERSISTENT, scene) : null) ?? getPersistentState();
  const sceneActors = new Set(ZONES.map(zone => state.focus[zone]?.entry?.actorUuid).filter(Boolean));
  const focus = Object.fromEntries(ZONES.map(zone => [zone,
    state.focus[zone] ? { ...state.focus[zone], persistent: false }
      : persistent.focus[zone] && !sceneActors.has(persistent.focus[zone].entry.actorUuid)
        ? { ...persistent.focus[zone], persistent: true } : null
  ]));
  const backgrounds = getBackgroundLibrary().backgrounds;
  const sceneItem = backgrounds.find(item => item.id === state.activeBackgroundId)
    ?? state.backgrounds.find(item => item.id === state.activeBackgroundId);
  const persistentItem = backgrounds.find(item => item.id === persistent.backgroundId);
  const snapshotItem = !state.activeBackgroundId && state.background.src ? state.background : null;
  const active = preview && state.background.src && !state.backgroundSuppressed
    ? sceneItem ?? snapshotItem
    : persistent.backgroundFollowActive
    ? persistentItem
    : state.backgroundSuppressed ? null : sceneItem ?? snapshotItem ?? persistentItem;
  const background = active ?? normalizeSceneState().background;
  return {
    focus, focusOrder: state.focusOrder, background, backgrounds,
    activeBackgroundId: active?.id ?? null,
    sceneBackgroundId: state.activeBackgroundId,
    backgroundSuppressed: state.backgroundSuppressed,
    persistentBackgroundId: persistent.backgroundId,
    backgroundFollowActive: persistent.backgroundFollowActive
  };
}

export async function setFocusOrder(order, { scene = canvas.scene } = {}) {
  if (!Array.isArray(order) || !scene) return false;
  const normalized = normalizeFocusOrder(order);
  return changeScene(state => { state.focusOrder = normalized; }, {
    scene, immediate: true, section: "focusOrder"
  });
}

export function getFocusEntry(entryId, scene = canvas.scene) {
  return Object.values(getPresentation(scene).focus).find(item => item?.entry?.id === entryId)?.entry ?? null;
}

async function changeFocus(mutator, { immediate = false, scene = canvas.scene } = {}) {
  if (!game.user?.isGM || !scene) return false;
  const sceneState = immediate ? getSceneState(scene) : (getPreviewLayer(CAST_LAYERS.SCENE, scene) ?? getSceneState(scene));
  const persistentState = immediate ? getPersistentState() : (getPreviewLayer(CAST_LAYERS.PERSISTENT, scene) ?? getPersistentState());
  const sceneBefore = JSON.stringify(sceneState.focus);
  const persistentBefore = JSON.stringify(persistentState.focus);
  mutator(sceneState.focus, persistentState.focus);
  const sceneChanged = JSON.stringify(sceneState.focus) !== sceneBefore;
  const persistentChanged = JSON.stringify(persistentState.focus) !== persistentBefore;
  if (immediate) {
    await withoutPreview(async () => {
      if (sceneChanged) await setSceneState(scene, sceneState);
      if (persistentChanged) await setPersistentState(persistentState);
    });
    await syncImmediateFocus(scene, mutator);
  } else {
    if (sceneChanged) await setPreviewLayer(CAST_LAYERS.SCENE, sceneState, scene);
    if (persistentChanged) await setPreviewLayer(CAST_LAYERS.PERSISTENT, persistentState, scene);
  }
  return true;
}

async function changeScene(mutator, { immediate = false, scene = canvas.scene, section = "focus" } = {}) {
  if (!game.user?.isGM || !scene) return false;
  const apply = async () => {
    const state = immediate ? getSceneState(scene) : (getPreviewLayer("scene", scene) ?? getSceneState(scene));
    mutator(state);
    if (immediate) await setSceneState(scene, state);
    else await setPreviewLayer("scene", state, scene);
  };
  if (immediate) {
    await withoutPreview(apply);
    if (section === "background") await syncImmediateBackgroundSelection(scene);
    else await syncImmediatePresentation(scene, mutator, [section]);
  }
  else await apply();
  return true;
}

export async function assignFocus(zone, actorUuid, { immediate = false, scene = canvas.scene } = {}) {
  if (!ZONES.includes(zone)) return false;
  let entry = null;
  if (actorUuid) {
    const actor = await fromUuid(actorUuid);
    if (actor?.documentName !== "Actor") return false;
    entry = Object.values(getPresentation(scene).focus)
      .find(item => item?.entry?.actorUuid === actorUuid)?.entry;
    const cast = getCombinedCastState(scene);
    entry ??= Object.values(GROUP_IDS).flatMap(id => cast.groups[id].entries)
      .find(item => item.actorUuid === actorUuid);
    entry ??= (immediate ? null : getPreviewReserve(scene)?.find(item => item.actorUuid === actorUuid))
      ?? getReserveEntries().find(item => item.actorUuid === actorUuid);
    if (!entry) {
      entry = createPortraitEntry(actorUuid, {
        activeVariantId: getStartingVariantId(actor)
      });
    }
    entry = foundry.utils.deepClone(entry);
  }
  return changeFocus((sceneFocus, persistentFocus) => {
    const wasPersistent = actorUuid && ZONES.some(key => persistentFocus[key]?.entry?.actorUuid === actorUuid);
    if (actorUuid) for (const key of ZONES) {
      if (sceneFocus[key]?.entry?.actorUuid === actorUuid) sceneFocus[key] = null;
      if (persistentFocus[key]?.entry?.actorUuid === actorUuid) persistentFocus[key] = null;
    }
    if (wasPersistent) sceneFocus[zone] = null;
    (wasPersistent ? persistentFocus : sceneFocus)[zone] = entry ? { entry, visible: true } : null;
  }, { immediate, scene });
}

export async function removeFocusActor(actorUuid, options = {}) {
  return changeFocus((sceneFocus, persistentFocus) => {
    for (const zone of ZONES) {
      if (sceneFocus[zone]?.entry?.actorUuid === actorUuid) sceneFocus[zone] = null;
      if (persistentFocus[zone]?.entry?.actorUuid === actorUuid) persistentFocus[zone] = null;
    }
  }, options);
}

export async function moveFocusZone(fromZone, toZone, options = {}) {
  if (!ZONES.includes(fromZone) || !ZONES.includes(toZone) || fromZone === toZone) return false;
  const current = getPresentation(options.scene ?? canvas.scene).focus[fromZone];
  if (!current) return false;
  return changeFocus((sceneFocus, persistentFocus) => {
    for (const focus of [sceneFocus, persistentFocus]) {
      [focus[fromZone], focus[toZone]] = [focus[toZone], focus[fromZone]];
    }
  }, options);
}

export async function setFocusVisible(zone, visible, options = {}) {
  if (!ZONES.includes(zone)) return false;
  return changeFocus((sceneFocus, persistentFocus) => {
    const item = sceneFocus[zone] ?? persistentFocus[zone];
    if (item) item.visible = visible;
  }, options);
}

export async function clearFocus(zone, options = {}) {
  if (!ZONES.includes(zone)) return false;
  return changeFocus((sceneFocus, persistentFocus) => {
    if (sceneFocus[zone]) sceneFocus[zone] = null;
    else persistentFocus[zone] = null;
  }, options);
}

export async function setFocusPersistent(zone, persistent, options = {}) {
  if (!ZONES.includes(zone)) return false;
  return changeFocus((sceneFocus, persistentFocus) => {
    const from = persistent ? sceneFocus : persistentFocus;
    const to = persistent ? persistentFocus : sceneFocus;
    if (!from[zone]) return;
    to[zone] = from[zone];
    from[zone] = null;
  }, options);
}

export async function updateFocusEntry(entryId, changes, options = {}) {
  if (!entryId || !changes || typeof changes !== "object") return false;
  let variantChange = null;
  const changed = await changeFocus((sceneFocus, persistentFocus) => {
    const item = [...Object.values(sceneFocus), ...Object.values(persistentFocus)]
      .find(value => value?.entry?.id === entryId);
    if (!item) return;
    if (typeof changes.activeVariantId === "string"
      && changes.activeVariantId !== item.entry.activeVariantId) {
      variantChange = { actorUuid: item.entry.actorUuid, activeVariantId: changes.activeVariantId };
    }
    item.entry = { ...item.entry, ...changes };
  }, options);
  if (!changed || !variantChange) return changed;
  if (options.immediate) await rememberActorVariant(variantChange.actorUuid, variantChange.activeVariantId);
  const scene = options.scene ?? canvas.scene;
  const cast = options.immediate
    ? await withoutPreview(() => getCombinedCastState(scene))
    : getCombinedCastState(scene);
  const entries = Object.values(GROUP_IDS).flatMap(groupId => cast.groups[groupId].entries)
    .filter(entry => entry.actorUuid === variantChange.actorUuid);
  for (const entry of entries) {
    const update = () => updateCastEntry(entry.id, { activeVariantId: variantChange.activeVariantId }, {
      scene, layer: entry.layer
    });
    if (options.immediate) await withoutPreview(update);
    else await update();
  }
  const { syncReserveVariantForActor } = await import("./reserve-service.js");
  await syncReserveVariantForActor(variantChange.actorUuid, variantChange.activeVariantId, {
    immediate: options.immediate === true
  });
  return changed;
}

export async function syncFocusVariantForActor(actorUuid, activeVariantId, options = {}) {
  if (!actorUuid || !activeVariantId) return false;
  return changeFocus((sceneFocus, persistentFocus) => {
    for (const focus of [sceneFocus, persistentFocus]) {
      for (const zone of ZONES) {
        if (focus[zone]?.entry?.actorUuid === actorUuid) {
          focus[zone].entry.activeVariantId = activeVariantId;
        }
      }
    }
  }, options);
}

export async function setSceneBackground(changes, options = {}) {
  const current = getPresentation(options.scene ?? canvas.scene);
  if (!current.activeBackgroundId) return false;
  return updateBackgroundVariant(current.activeBackgroundId, changes);
}

export async function addSceneBackground(src, options = {}) {
  return addBackgroundVariant({ src });
}

export async function activateSceneBackground(id, options = {}) {
  const item = findBackground(id);
  if (!item) return false;
  const scene = options.scene ?? canvas.scene;
  const persistent = getPersistentState();
  if (persistent.backgroundFollowActive) {
    const state = getSceneState(scene);
    state.activeBackgroundId = null;
    state.backgroundSuppressed = false;
    state.background = normalizeSceneState().background;
    persistent.backgroundId = id;
    await withoutPreview(async () => {
      await setSceneState(scene, state);
      await setPersistentState(persistent);
    });
    await syncImmediateBackgroundSelection(scene);
    return true;
  }
  return changeScene(state => {
    if (state.activeBackgroundId !== id && !(state.backgroundSuppressed && !state.activeBackgroundId && getPersistentState().backgroundId === id)) {
      state.activeBackgroundId = id;
    }
    state.backgroundSuppressed = false;
    state.background = { ...item };
  }, { ...options, immediate: true, section: "background" });
}

export async function deactivateSceneBackground(options = {}) {
  const scene = options.scene ?? canvas.scene;
  const state = getSceneState(scene);
  const persistent = getPersistentState();
  if (persistent.backgroundFollowActive) {
    persistent.backgroundId = null;
    await withoutPreview(() => setPersistentState(persistent));
    await syncImmediateBackgroundSelection(scene);
    return true;
  }
  if (state.activeBackgroundId || getPersistentState().backgroundId) return changeScene(value => {
    value.backgroundSuppressed = true;
    value.background = normalizeSceneState().background;
  }, { ...options, immediate: true, section: "background" });
  return false;
}

export async function removeSceneBackground(id, options = {}) {
  return removeBackgroundVariant(id);
}

export async function updateSceneBackground(id, changes, options = {}) {
  return updateBackgroundVariant(id, changes);
}

export async function setBackgroundFollowActive(enabled, { scene = canvas.scene } = {}) {
  if (!game.user?.isGM || !scene) return false;
  const activeId = getPresentation(scene, { published: true }).activeBackgroundId;
  if (enabled && !findBackground(activeId)) return false;
  const sceneState = getSceneState(scene);
  const persistent = getPersistentState();
  persistent.backgroundFollowActive = enabled;
  if (enabled) {
    persistent.backgroundId = activeId;
    sceneState.activeBackgroundId = null;
    sceneState.background = normalizeSceneState().background;
    sceneState.backgroundSuppressed = false;
  } else {
    persistent.backgroundId = null;
    if (activeId) {
      sceneState.activeBackgroundId = activeId;
      sceneState.background = { ...findBackground(activeId) };
      sceneState.backgroundSuppressed = false;
    }
  }
  await withoutPreview(async () => {
    await setSceneState(scene, sceneState);
    await setPersistentState(persistent);
  });
  await syncImmediateBackgroundSelection(scene);
  return true;
}
