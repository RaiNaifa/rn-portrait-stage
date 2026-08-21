import { GROUP_IDS } from "../constants.js";
import { createPortraitEntry, normalizeGroupId } from "./portrait-entry.js";
import { getSceneState, setSceneState } from "./scene-state.js";

function requireGm() {
  if (!game.user?.isGM) throw new Error(game.i18n.localize("RNPS.Notifications.GmOnly"));
}

function requireScene(scene) {
  if (!scene) throw new Error(game.i18n.localize("RNPS.Notifications.SceneUnavailable"));
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

export async function addActorToCast(actorUuid, {
  scene = canvas.scene,
  groupId = GROUP_IDS.PCS,
  index = null
} = {}) {
  requireGm();
  requireScene(scene);

  const actor = await fromUuid(actorUuid);
  if (actor?.documentName !== "Actor") {
    throw new Error(game.i18n.localize("RNPS.Notifications.ActorUnavailable"));
  }

  const state = getSceneState(scene);
  const existing = Object.values(GROUP_IDS)
    .flatMap(id => state.groups[id].entries)
    .find(entry => entry.actorUuid === actor.uuid);

  if (existing) {
    return moveCastEntry(existing.id, { scene, groupId, index });
  }

  const targetGroupId = normalizeGroupId(groupId);
  const target = state.groups[targetGroupId].entries;
  const entry = createPortraitEntry(actor.uuid, { groupId: targetGroupId });
  target.splice(normalizeInsertIndex(index, target.length), 0, entry);
  await setSceneState(scene, resequence(state));
  return entry;
}

export async function removeCastEntry(entryId, { scene = canvas.scene } = {}) {
  requireGm();
  requireScene(scene);

  const state = getSceneState(scene);
  const location = findEntryLocation(state, entryId);
  if (!location) return false;
  state.groups[location.groupId].entries.splice(location.index, 1);
  await setSceneState(scene, resequence(state));
  return true;
}

export function getCastEntry(entryId, { scene = canvas.scene } = {}) {
  if (!scene) return null;
  return findEntryLocation(getSceneState(scene), entryId)?.entry ?? null;
}

export async function updateCastEntry(entryId, changes, { scene = canvas.scene } = {}) {
  requireGm();
  requireScene(scene);

  const state = getSceneState(scene);
  const location = findEntryLocation(state, entryId);
  if (!location) throw new Error(`Portrait entry '${entryId}' was not found.`);

  const targetGroupId = normalizeGroupId(changes.groupId ?? location.groupId);
  const updated = {
    ...location.entry,
    visible: changes.visible ?? location.entry.visible,
    image: {
      ...location.entry.image,
      ...(changes.image ?? {})
    }
  };

  state.groups[location.groupId].entries.splice(location.index, 1);
  const target = state.groups[targetGroupId].entries;
  const insertIndex = targetGroupId === location.groupId ? location.index : target.length;
  target.splice(insertIndex, 0, updated);
  await setSceneState(scene, resequence(state));
  return updated;
}

export async function moveCastEntry(entryId, {
  scene = canvas.scene,
  groupId,
  index = null
} = {}) {
  requireGm();
  requireScene(scene);

  const state = getSceneState(scene);
  const location = findEntryLocation(state, entryId);
  if (!location) throw new Error(`Portrait entry '${entryId}' was not found.`);

  const [entry] = state.groups[location.groupId].entries.splice(location.index, 1);
  const targetGroupId = normalizeGroupId(groupId ?? location.groupId);
  const target = state.groups[targetGroupId].entries;
  let insertIndex = normalizeInsertIndex(index, target.length);
  if (
    targetGroupId === location.groupId
    && Number.isInteger(index)
    && location.index < index
  ) {
    insertIndex = Math.max(0, insertIndex - 1);
  }
  target.splice(insertIndex, 0, entry);
  await setSceneState(scene, resequence(state));
  return entry;
}

export async function clearCast({ scene = canvas.scene, groupId = null } = {}) {
  requireGm();
  requireScene(scene);

  const state = getSceneState(scene);
  if (groupId) state.groups[normalizeGroupId(groupId)].entries = [];
  else for (const id of Object.values(GROUP_IDS)) state.groups[id].entries = [];
  await setSceneState(scene, state);
}

function normalizeInsertIndex(index, length) {
  if (!Number.isInteger(index)) return length;
  return Math.max(0, Math.min(index, length));
}
