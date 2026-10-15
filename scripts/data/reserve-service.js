import { CAST_LAYERS, GROUP_IDS, MODULE_ID, SETTING_KEYS } from "../constants.js";
import { createPortraitEntry, normalizePortraitEntry } from "./portrait-entry.js";
import { getStartingVariantId, rememberActorVariant } from "./actor-library.js";
import { preparePortraitView } from "../portraits/portrait-data.js";
import { getPreviewReserve, isPreviewActive, setPreviewReserve, withoutPreview } from "./preview-service.js";

function requireGm() {
  if (!game.user?.isGM) throw new Error(game.i18n.localize("RNPS.Notifications.GmOnly"));
}

export function getReserveEntries() {
  if (isPreviewActive()) {
    return (getPreviewReserve() ?? []).map(entry => ({ ...entry, layer: CAST_LAYERS.RESERVE }));
  }
  const value = game.settings.get(MODULE_ID, SETTING_KEYS.RESERVE_ACTORS);
  if (!Array.isArray(value)) return [];
  return value.map(item => {
    if (typeof item === "string") return createPortraitEntry(item);
    return normalizePortraitEntry(item);
  }).filter(Boolean).map(entry => ({ ...entry, layer: CAST_LAYERS.RESERVE }));
}

export function getReserveEntry(entryId) {
  return getReserveEntries().find(entry => entry.id === entryId) ?? null;
}

async function setReserveEntries(entries) {
  if (isPreviewActive()) return setPreviewReserve(entries);
  await game.settings.set(MODULE_ID, SETTING_KEYS.RESERVE_ACTORS, entries.map(entry => {
    const { layer, ...stored } = entry;
    return stored;
  }));
}

export async function addActorToReserve(actorUuid, { entry = null } = {}) {
  requireGm();
  const actor = await fromUuid(actorUuid);
  if (actor?.documentName !== "Actor") {
    throw new Error(game.i18n.localize("RNPS.Notifications.ActorUnavailable"));
  }
  const reserve = getReserveEntries();
  if (reserve.some(item => item.actorUuid === actor.uuid)) return;
  const source = entry ? normalizePortraitEntry(entry, entry.groupId) : createPortraitEntry(actor.uuid, {
    activeVariantId: getStartingVariantId(actor)
  });
  source.id = foundry.utils.randomID();
  source.flags = {
    ...source.flags,
    reservePersistent: entry?.layer === CAST_LAYERS.PERSISTENT
      || (!entry && source.groupId === GROUP_IDS.PCS)
  };
  await setReserveEntries([...reserve, source]);
  return source;
}

export async function updateReserveEntry(entryId, changes) {
  requireGm();
  const reserve = getReserveEntries();
  const index = reserve.findIndex(entry => entry.id === entryId);
  if (index < 0) return null;
  const previousVariantId = reserve[index].activeVariantId;
  reserve[index] = normalizePortraitEntry({
    ...reserve[index],
    ...changes,
    flags: { ...reserve[index].flags, ...(changes.flags ?? {}) }
  }, reserve[index].groupId);
  await setReserveEntries(reserve);
  if (typeof changes.activeVariantId === "string" && changes.activeVariantId !== previousVariantId) {
    if (!isPreviewActive()) await rememberActorVariant(reserve[index].actorUuid, changes.activeVariantId);
    const { getCombinedCastState, updateCastEntry } = await import("./cast-service.js");
    const { syncFocusVariantForActor } = await import("./scene-presentation.js");
    const actorUuid = reserve[index].actorUuid;
    const cast = getCombinedCastState();
    for (const groupId of Object.values(GROUP_IDS)) {
      for (const entry of cast.groups[groupId].entries.filter(item => item.actorUuid === actorUuid)) {
        await updateCastEntry(entry.id, { activeVariantId: changes.activeVariantId }, { layer: entry.layer });
      }
    }
    await syncFocusVariantForActor(actorUuid, changes.activeVariantId, { immediate: !isPreviewActive() });
  }
  return { ...reserve[index], layer: CAST_LAYERS.RESERVE };
}

export async function syncReserveVariantForActor(actorUuid, activeVariantId, { immediate = false } = {}) {
  if (!actorUuid || !activeVariantId) return false;
  const sync = async () => {
    const reserve = getReserveEntries();
    let changed = false;
    for (const entry of reserve) {
      if (entry.actorUuid !== actorUuid || entry.activeVariantId === activeVariantId) continue;
      entry.activeVariantId = activeVariantId;
      changed = true;
    }
    if (changed) await setReserveEntries(reserve);
    return changed;
  };
  return immediate ? withoutPreview(sync) : sync();
}

export async function moveReserveEntry(entryId, index = null) {
  requireGm();
  const reserve = getReserveEntries();
  const sourceIndex = reserve.findIndex(entry => entry.id === entryId);
  if (sourceIndex < 0) return null;
  const [entry] = reserve.splice(sourceIndex, 1);
  let targetIndex = Number.isInteger(index)
    ? Math.max(0, Math.min(index, reserve.length))
    : reserve.length;
  if (Number.isInteger(index) && sourceIndex < index) targetIndex = Math.max(0, targetIndex - 1);
  reserve.splice(targetIndex, 0, entry);
  await setReserveEntries(reserve);
  return { ...entry, layer: CAST_LAYERS.RESERVE };
}

export async function removeActorFromReserve(entryIdOrActorUuid) {
  requireGm();
  await setReserveEntries(getReserveEntries().filter(entry => (
    entry.id !== entryIdOrActorUuid && entry.actorUuid !== entryIdOrActorUuid
  )));
}

export async function prepareReserveActors() {
  const views = await Promise.all(getReserveEntries().map(entry => preparePortraitView(entry)));
  return views.filter(Boolean).map(view => ({
    ...view,
    persistent: view.entry.flags?.reservePersistent === true
  }));
}
