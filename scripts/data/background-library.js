import { MODULE_ID, SETTING_KEYS } from "../constants.js";
import { getSceneState, setSceneState } from "./scene-state.js";
import { getPersistentState, setPersistentState } from "./persistent-state.js";

const DEFAULT_GROUP = "default";
const normalizeFit = (fit, fallback = "cover") => ["cover", "contain", "contain-blur"].includes(fit) ? fit : fallback;

export function getBackgroundLibrary() {
  const source = game.settings.get(MODULE_ID, SETTING_KEYS.BACKGROUND_LIBRARY);
  const groups = [{ id: DEFAULT_GROUP, name: game.i18n?.localize?.("RNPS.Background.DefaultGroup") ?? "Default" }];
  for (const group of Array.isArray(source?.groups) ? source.groups : []) {
    if (typeof group?.id !== "string" || group.id === DEFAULT_GROUP || groups.some(item => item.id === group.id)) continue;
    groups.push({ id: group.id, name: String(group.name || "Group") });
  }
  const backgrounds = (Array.isArray(source?.backgrounds) ? source.backgrounds : [])
    .filter(item => typeof item?.id === "string" && typeof item.src === "string" && item.src.trim())
    .map(item => ({
      id: item.id,
      name: String(item.name || item.src.split(/[\\/]/).pop()),
      src: item.src.trim(),
      groupId: groups.some(group => group.id === item.groupId) ? item.groupId : DEFAULT_GROUP,
      fit: normalizeFit(item.fit),
      positionX: clamp(item.positionX, 0, 100, 50),
      positionY: clamp(item.positionY, 0, 100, 50),
      dim: clamp(item.dim, 0, 100, 0),
      blur: clamp(item.blur, 0, 30, 0)
    }));
  return { groups, backgrounds };
}

export async function setBackgroundLibrary(library) {
  if (!game.user?.isGM) return false;
  await game.settings.set(MODULE_ID, SETTING_KEYS.BACKGROUND_LIBRARY, library);
  return true;
}

export function findBackground(id) {
  return getBackgroundLibrary().backgrounds.find(item => item.id === id) ?? null;
}

export function getBackgroundSceneAssignments(scenes = game.scenes?.contents ?? []) {
  const assignments = new Map();
  for (const scene of scenes) {
    const state = getSceneState(scene);
    const id = state.activeBackgroundId;
    if (!id) continue;
    if (!assignments.has(id)) assignments.set(id, []);
    assignments.get(id).push(scene.name);
  }
  return assignments;
}

export async function addBackgroundVariant({ src, name, ...settings }) {
  if (!game.user?.isGM || typeof src !== "string" || !src.trim()) return null;
  const library = getBackgroundLibrary();
  const item = {
    id: foundry.utils.randomID(),
    name: String(name || src.split(/[\\/]/).pop()),
    src: src.trim(),
    groupId: library.groups.some(group => group.id === settings.groupId) ? settings.groupId : DEFAULT_GROUP,
    fit: normalizeFit(settings.fit, normalizeFit(game.settings.get(MODULE_ID, SETTING_KEYS.BACKGROUND_DEFAULT_FIT), "contain-blur")),
    positionX: clamp(settings.positionX, 0, 100, 50),
    positionY: clamp(settings.positionY, 0, 100, 50),
    dim: clamp(settings.dim, 0, 100, 0),
    blur: clamp(settings.blur, 0, 30, 0)
  };
  library.backgrounds.push(item);
  await setBackgroundLibrary(library);
  return item;
}

export async function updateBackgroundVariant(id, changes) {
  const library = getBackgroundLibrary();
  const item = library.backgrounds.find(value => value.id === id);
  if (!item) return false;
  Object.assign(item, changes);
  await setBackgroundLibrary(library);
  return true;
}

export async function removeBackgroundVariant(id) {
  const library = getBackgroundLibrary();
  if (!library.backgrounds.some(item => item.id === id)) return false;
  library.backgrounds = library.backgrounds.filter(item => item.id !== id);
  await setBackgroundLibrary(library);
  for (const scene of game.scenes?.contents ?? []) {
    const state = getSceneState(scene);
    if (state.activeBackgroundId !== id) continue;
    state.activeBackgroundId = null;
    state.background = { src: "", fit: "cover", positionX: 50, positionY: 50, dim: 0, blur: 0, overUi: false };
    await setSceneState(scene, state);
  }
  const persistent = getPersistentState();
  if (persistent.backgroundId === id) {
    persistent.backgroundId = null;
    persistent.backgroundFollowActive = false;
    await setPersistentState(persistent);
  }
  return true;
}

export async function addBackgroundGroup(name) {
  const library = getBackgroundLibrary();
  const group = { id: foundry.utils.randomID(), name: name || game.i18n.localize("RNPS.Background.NewGroup") };
  library.groups.push(group);
  await setBackgroundLibrary(library);
  return group;
}

export async function renameBackgroundGroup(id, name) {
  if (id === DEFAULT_GROUP || !name?.trim()) return false;
  const library = getBackgroundLibrary();
  const group = library.groups.find(value => value.id === id);
  if (!group) return false;
  group.name = name.trim();
  return setBackgroundLibrary(library);
}

export async function removeBackgroundGroup(id) {
  if (id === DEFAULT_GROUP) return false;
  const library = getBackgroundLibrary();
  library.groups = library.groups.filter(group => group.id !== id);
  for (const item of library.backgrounds) if (item.groupId === id) item.groupId = DEFAULT_GROUP;
  return setBackgroundLibrary(library);
}

export async function moveBackgroundGroup(id, beforeId = null) {
  if (id === DEFAULT_GROUP || id === beforeId) return false;
  const library = getBackgroundLibrary();
  const index = library.groups.findIndex(group => group.id === id);
  if (index < 0) return false;
  const [group] = library.groups.splice(index, 1);
  const before = beforeId ? library.groups.findIndex(value => value.id === beforeId) : -1;
  const destination = before === 0 ? 1 : before < 0 ? library.groups.length : before;
  library.groups.splice(destination, 0, group);
  return setBackgroundLibrary(library);
}

export async function moveBackgroundVariant(id, groupId, beforeId = null) {
  const library = getBackgroundLibrary();
  const index = library.backgrounds.findIndex(item => item.id === id);
  if (index < 0 || !library.groups.some(group => group.id === groupId)) return false;
  const [item] = library.backgrounds.splice(index, 1);
  item.groupId = groupId;
  const before = beforeId ? library.backgrounds.findIndex(value => value.id === beforeId && value.groupId === groupId) : -1;
  library.backgrounds.splice(before < 0 ? library.backgrounds.length : before, 0, item);
  return setBackgroundLibrary(library);
}

export async function importLegacySceneBackgrounds() {
  if (!game.user?.isGM) return;
  const library = getBackgroundLibrary();
  let changed = false;
  const updates = [];
  for (const scene of game.scenes?.contents ?? []) {
    const state = getSceneState(scene);
    if (!state.backgrounds.length) continue;
    const ids = new Map();
    for (const item of state.backgrounds) {
      const id = `migrated-${scene.id}-${item.id}`;
      ids.set(item.id, id);
      if (library.backgrounds.some(value => value.id === id)) continue;
      library.backgrounds.push({ ...item, id, groupId: DEFAULT_GROUP });
      changed = true;
    }
    state.activeBackgroundId = ids.get(state.activeBackgroundId) ?? null;
    state.backgrounds = [];
    updates.push([scene, state]);
  }
  if (changed) await setBackgroundLibrary(library);
  for (const [scene, state] of updates) await setSceneState(scene, state);
}

export async function ensureGlobalBackground(background) {
  if (!background?.src) return null;
  const existing = getBackgroundLibrary().backgrounds.find(item => item.src === background.src);
  return existing ?? addBackgroundVariant(background);
}

function clamp(value, min, max, fallback) {
  return Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
}
