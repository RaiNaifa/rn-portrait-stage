import { MODULE_ID, SETTING_KEYS, GROUP_IDS } from "../constants.js";
import { getCombinedCastState } from "./cast-service.js";
import { assignFocus, getPresentation, moveFocusZone } from "./scene-presentation.js";
import { getSharedVisibility, toggleSharedVisibility } from "./visibility-service.js";
import { withoutPreview } from "./preview-service.js";

const ZONES = ["left", "center", "right"];
const busy = new Set();
const t = key => game.i18n.localize(`RNPS.Attention.${key}`);
const zoneName = zone => game.i18n.localize(`RNPS.Focus.${zone[0].toUpperCase()}${zone.slice(1)}`);
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[character]);

function requestContent(data) {
  const status = t(data.status === "accepted" ? "Accepted" : data.status === "declined" ? "Declined" : "Pending");
  const detail = data.status === "accepted" && data.zone ? ` · ${zoneName(data.zone)}` : "";
  return `<div class="rnps-attention-card"><strong><i class="fa-solid fa-hand"></i> ${escapeHtml(t("Title"))}</strong>`
    + `<div>${escapeHtml(data.playerName)}: ${escapeHtml(data.actorName)}</div>`
    + `<small>${escapeHtml(data.sceneName)} · ${escapeHtml(status + detail)}</small></div>`;
}

export async function sendAttentionRequest(view) {
  if (game.user.isGM || !game.settings.get(MODULE_ID, SETTING_KEYS.ALLOW_ATTENTION_REQUESTS)) return;
  const scene = canvas?.scene;
  if (!scene || game.user.character?.uuid !== view?.actorUuid) return;
  const recipients = [...new Set([...game.users.filter(user => user.isGM).map(user => user.id), game.user.id])];
  const data = {
    requesterId: game.user.id, actorUuid: view.actorUuid, actorName: view.actor.name,
    playerName: game.user.name, sceneId: scene.id, sceneName: scene.name,
    status: "pending"
  };
  try {
    await ChatMessage.create({
      user: game.user.id, whisper: recipients,
      content: requestContent(data),
      flags: { [MODULE_ID]: { attentionRequest: data } }
    });
  } catch (error) {
    console.error(`${MODULE_ID} | Attention request failed`, error);
    ui.notifications.error(t("SendFailed"));
  }
}

export function initializeAttentionRequests() {
  Hooks.on("renderChatMessageHTML", (message, html) => {
    const request = message.getFlag(MODULE_ID, "attentionRequest");
    if (!request) return;
    const original = html.querySelector(".rnps-attention-card");
    if (original) original.outerHTML = requestContent(request);
    if (request.status !== "pending" || !game.user.isGM) return;
    const card = html.querySelector(".rnps-attention-card");
    if (!card) return;
    const controls = document.createElement("div");
    controls.className = "rnps-attention-actions";
    for (const [action, icon, label] of [
      ["accept", "fa-check", "Accept"], ["decline", "fa-xmark", "Decline"]
    ]) {
      const button = document.createElement("button");
      button.type = "button";
      button.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i> ${escapeHtml(t(label))}`;
      button.addEventListener("click", () => void actOnRequest(message.id, action));
      controls.append(button);
    }
    card.append(controls);
  });
}

async function validateRequest(message) {
  const request = message?.getFlag(MODULE_ID, "attentionRequest");
  if (!request || request.status !== "pending"
    || (message.user?.id ?? message.user) !== request.requesterId) return null;
  const requester = game.users.get(request.requesterId);
  const scene = game.scenes.get(request.sceneId);
  const actor = requester?.character;
  if (!requester || requester.isGM || !scene || !actor || actor.uuid !== request.actorUuid) return null;
  const cast = await withoutPreview(() => getCombinedCastState(scene));
  const inCast = Object.values(GROUP_IDS).some(group =>
    cast.groups[group].entries.some(entry => entry.actorUuid === actor.uuid)
  );
  return inCast ? { request, scene, actor } : null;
}

async function zoneLabels(focus) {
  const labels = {};
  for (const zone of ZONES) {
    const uuid = focus[zone]?.entry?.actorUuid;
    labels[zone] = uuid ? (await fromUuid(uuid))?.name ?? t("UnknownActor") : t("Free");
  }
  return labels;
}

async function choosePlacement({ request, scene, actor }, focus, hidden) {
  const current = ZONES.find(zone => focus[zone]?.entry?.actorUuid === actor.uuid);
  const labels = await zoneLabels(focus);
  const zones = ZONES.map((zone, index) => `<label class="rnps-attention-zone">
    <input type="radio" name="zone" value="${zone}" ${index === 0 ? "checked" : ""}>
    <span class="rnps-attention-zone-face">
      <strong>${escapeHtml(zoneName(zone))}</strong>
      <small title="${escapeHtml(labels[zone])}">${escapeHtml(labels[zone])}</small>
    </span>
  </label>`).join("");
  const offScene = scene.id !== canvas?.scene?.id;
  const content = `<div class="rnps-attention-dialog">
    <p>${escapeHtml(request.playerName)}: <strong>${escapeHtml(actor.name)}</strong></p>
    <p>${escapeHtml(t("Scene"))}: <strong>${escapeHtml(scene.name)}</strong>${offScene ? ` — ${escapeHtml(t("OtherScene"))}` : ""}</p>
    ${current ? `<p>${escapeHtml(t("AlreadyInFocus"))}: ${escapeHtml(zoneName(current))}</p>` : ""}
    <fieldset class="rnps-attention-zones"><legend>${escapeHtml(t("Destination"))}</legend>${zones}</fieldset>
    ${hidden ? `<label class="rnps-attention-show"><input type="checkbox" name="showFocus"> ${escapeHtml(t("ShowFocus"))}</label><p>${escapeHtml(t("HiddenWarning"))}</p>` : ""}
  </div>`;
  const choice = await foundry.applications.api.DialogV2.wait({
    window: { title: t("Review") }, content, modal: true, rejectClose: false,
    buttons: [
      { action: "accept", label: t("Accept"), icon: "fa-solid fa-check", default: true,
        callback: (_event, button) => ({
          zone: button.form.elements.zone.value,
          showFocus: Boolean(button.form.elements.showFocus?.checked)
        }) },
      { action: "cancel", label: t("Cancel"), icon: "fa-solid fa-xmark" }
    ]
  });
  if (!choice || choice === "cancel") return null;
  if (hidden && !choice.showFocus) {
    ui.notifications.warn(t("MustShowFocus"));
    return null;
  }
  return choice;
}

async function actOnRequest(messageId, action) {
  if (!game.user.isGM || busy.has(messageId)) return;
  busy.add(messageId);
  try {
    const message = game.messages.get(messageId);
    const validated = await validateRequest(message);
    if (!validated) {
      ui.notifications.warn(t("Unavailable"));
      return;
    }
    const { request, scene, actor } = validated;
    if (action === "decline") {
      const declined = { ...request, status: "declined" };
      await message.update({ content: requestContent(declined), [`flags.${MODULE_ID}.attentionRequest`]: declined });
      return;
    }
    if (action !== "accept") return;
    const focus = (await withoutPreview(() => getPresentation(scene, { published: true }))).focus;
    const current = ZONES.find(zone => focus[zone]?.entry?.actorUuid === actor.uuid);
    const hidden = !getSharedVisibility().focus;
    const defaultZone = game.settings.get(MODULE_ID, SETTING_KEYS.ATTENTION_DEFAULT_ZONE);
    const occupied = focus[defaultZone]?.entry?.actorUuid && focus[defaultZone].entry.actorUuid !== actor.uuid;
    const offScene = scene.id !== canvas?.scene?.id;
    let choice;
    if (ZONES.includes(defaultZone) && !hidden && !current && !offScene
      && (!occupied || game.settings.get(MODULE_ID, SETTING_KEYS.ATTENTION_REPLACE_OCCUPIED))) {
      choice = { zone: defaultZone, showFocus: false };
    } else {
      choice = await choosePlacement(validated, focus, hidden);
    }
    if (!choice || !ZONES.includes(choice.zone)) return;
    const latest = game.messages.get(messageId);
    if (latest?.getFlag(MODULE_ID, "attentionRequest")?.status !== "pending") {
      ui.notifications.warn(t("AlreadyResolved"));
      return;
    }
    if (!await validateRequest(latest)) {
      ui.notifications.warn(t("Unavailable"));
      return;
    }
    const fresh = (await withoutPreview(() => getPresentation(scene, { published: true }))).focus;
    const from = ZONES.find(zone => fresh[zone]?.entry?.actorUuid === actor.uuid);
    const target = fresh[choice.zone]?.entry?.actorUuid;
    if (target && target !== actor.uuid && !from
      && !game.settings.get(MODULE_ID, SETTING_KEYS.ATTENTION_REPLACE_OCCUPIED)) {
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window: { title: t("ReplaceTitle") }, modal: true, rejectClose: false,
        content: `<p>${escapeHtml(game.i18n.format("RNPS.Attention.ReplaceConfirm", {
          actor: (await fromUuid(target))?.name ?? t("UnknownActor"), zone: zoneName(choice.zone)
        }))}</p>`
      });
      if (!confirmed) return;
    }
    if (game.messages.get(messageId)?.getFlag(MODULE_ID, "attentionRequest")?.status !== "pending") {
      ui.notifications.warn(t("AlreadyResolved"));
      return;
    }
    const finalFocus = (await withoutPreview(() => getPresentation(scene, { published: true }))).focus;
    if (ZONES.find(zone => finalFocus[zone]?.entry?.actorUuid === actor.uuid) !== from
      || finalFocus[choice.zone]?.entry?.actorUuid !== target) {
      ui.notifications.warn(t("SceneChanged"));
      return;
    }
    if (choice.showFocus) {
      if (!getSharedVisibility().focus) await toggleSharedVisibility("focus");
    }
    let placed = true;
    if (from && from !== choice.zone) placed = await moveFocusZone(from, choice.zone, { immediate: true, scene });
    else if (!from) placed = await assignFocus(choice.zone, actor.uuid, { immediate: true, scene });
    if (!placed) throw new Error("Focus placement failed");
    const accepted = { ...request, status: "accepted", zone: choice.zone };
    await latest.update({ content: requestContent(accepted), [`flags.${MODULE_ID}.attentionRequest`]: accepted });
  } catch (error) {
    console.error(`${MODULE_ID} | Attention request action failed`, error);
    ui.notifications.error(t("ActionFailed"));
  } finally {
    busy.delete(messageId);
  }
}
