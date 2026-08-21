import { MODULE_ID, SETTING_KEYS } from "../constants.js";
import { getCastEntry, updateCastEntry } from "./cast-service.js";
import { canUserAccessVariant, getActorLibrary } from "./actor-library.js";

const CHANNEL = `module.${MODULE_ID}`;

export function initializeSocketService() {
  game.socket.on(CHANNEL, async message => {
    const activeGm = game.users.activeGM ?? game.users.find(user => user.active && user.isGM);
    if (message?.type !== "update-entry" || game.user.id !== activeGm?.id) return;
    const requestingUser = game.users.get(message.userId);
    const entry = getCastEntry(message.entryId, { layer: message.layer });
    const actor = entry ? await fromUuid(entry.actorUuid) : null;
    if (!requestingUser || !actor) return;
    if (!game.settings.get(MODULE_ID, SETTING_KEYS.ALLOW_PLAYER_PORTRAIT_CHANGES)) return;
    const variant = getActorLibrary(actor).variants.find(item => item.id === message.changes?.activeVariantId);
    if (!variant || !canUserAccessVariant(variant, actor, requestingUser)) return;
    await updateCastEntry(message.entryId, message.changes, { layer: message.layer });
  });
}

export async function requestCastEntryUpdate(entryId, changes, { layer, actor } = {}) {
  if (game.user.isGM) return updateCastEntry(entryId, changes, { layer });
  if (!game.settings.get(MODULE_ID, SETTING_KEYS.ALLOW_PLAYER_PORTRAIT_CHANGES)) {
    throw new Error(game.i18n.localize("RNPS.Notifications.PlayerChangesDisabled"));
  }
  const variant = getActorLibrary(actor).variants.find(item => item.id === changes.activeVariantId);
  if (!variant || !canUserAccessVariant(variant, actor, game.user)) {
    throw new Error(game.i18n.localize("RNPS.Notifications.ActorPermission"));
  }
  game.socket.emit(CHANNEL, {
    type: "update-entry",
    userId: game.user.id,
    entryId,
    layer,
    changes
  });
}
