import { MODULE_ID, SETTING_KEYS } from "../constants.js";
import { getCastEntry, updateCastEntry } from "./cast-service.js";
import { canUserAccessVariant, getActorLibrary } from "./actor-library.js";
import { withoutPreview } from "./preview-service.js";

const CHANNEL = `module.${MODULE_ID}`;

export function initializeSocketService() {
  game.socket.on(CHANNEL, async message => {
    if (message?.type === "voice-state") {
      Hooks.callAll("rnPortraitStageVoiceSocket", message);
      return;
    }
    const activeGm = game.users.activeGM ?? game.users.find(user => user.active && user.isGM);
    if (game.user.id !== activeGm?.id) return;
    const requestingUser = game.users.get(message.userId);
    const entry = await withoutPreview(() => getCastEntry(message.entryId, { layer: message.layer }));
    const actor = entry ? await fromUuid(entry.actorUuid) : null;
    if (!requestingUser || !actor) return;
    if (message?.type === "toggle-voice-entry") {
      if (requestingUser.character?.uuid !== actor.uuid) return;
      await withoutPreview(() => updateCastEntry(message.entryId, {
        flags: { [MODULE_ID]: { voiceEnabled: message.enabled === true } }
      }, { layer: message.layer }));
      return;
    }
    if (message?.type !== "update-entry") return;
    if (!game.settings.get(MODULE_ID, SETTING_KEYS.ALLOW_PLAYER_PORTRAIT_CHANGES)) return;
    const variant = getActorLibrary(actor).variants.find(item => item.id === message.changes?.activeVariantId);
    if (!variant || !canUserAccessVariant(variant, actor, requestingUser)) return;
    await withoutPreview(() => updateCastEntry(message.entryId, message.changes, { layer: message.layer }));
  });
}

export function emitVoiceState(payload) {
  game.socket.emit(CHANNEL, { type: "voice-state", ...payload });
}

export function requestVoiceEntryToggle(entryId, enabled, { layer, actor } = {}) {
  if (game.user.isGM) return withoutPreview(() => updateCastEntry(entryId, {
    flags: { [MODULE_ID]: { voiceEnabled: enabled === true } }
  }, { layer }));
  if (game.user.character?.uuid !== actor?.uuid) {
    throw new Error(game.i18n.localize("RNPS.Notifications.ActorPermission"));
  }
  game.socket.emit(CHANNEL, {
    type: "toggle-voice-entry",
    userId: game.user.id,
    entryId,
    layer,
    enabled: enabled === true
  });
}

export async function requestCastEntryUpdate(entryId, changes, { layer, actor, draft = false } = {}) {
  if (game.user.isGM) {
    if (draft) return updateCastEntry(entryId, changes, { layer });
    const published = await withoutPreview(() => getCastEntry(entryId, { layer }));
    return published
      ? withoutPreview(() => updateCastEntry(entryId, changes, { layer }))
      : updateCastEntry(entryId, changes, { layer });
  }
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
