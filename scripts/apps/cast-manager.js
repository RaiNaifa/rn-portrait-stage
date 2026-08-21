import { CAST_LAYERS, GROUP_IDS, MODULE_ID, SETTING_KEYS } from "../constants.js";
import {
  addActorToCast,
  getCombinedCastState,
  moveCastEntry,
  removeCastEntry,
  setCastPortraitSize,
  updateCastEntry
} from "../data/cast-service.js";
import {
  addActorToReserve,
  getReserveEntry,
  prepareReserveActors,
  removeActorFromReserve,
  updateReserveEntry
} from "../data/reserve-service.js";
import { preparePortraitView } from "../portraits/portrait-data.js";
import { PortraitEditor } from "./portrait-editor.js";
import { logger } from "../logger.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class CastManager extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "rn-portrait-stage-cast-manager",
    classes: ["rn-portrait-stage-app", "rn-portrait-stage-cast-manager"],
    tag: "section",
    position: { width: 820, height: 720 },
    window: {
      icon: "fa-solid fa-masks-theater",
      title: "RNPS.Manager.Title",
      resizable: true,
      contentClasses: ["standard-form"]
    },
    actions: {
      edit: CastManager.#editEntry,
      remove: CastManager.#removeEntry,
      togglePersistent: CastManager.#togglePersistent,
      toggleMirror: CastManager.#toggleMirror,
      toggleVisible: CastManager.#toggleVisible,
      editReserve: CastManager.#editReserve,
      toggleReserveMirror: CastManager.#toggleReserveMirror,
      toggleReservePersistent: CastManager.#toggleReservePersistent,
      toggleReserveVisible: CastManager.#toggleReserveVisible,
      removeReserve: CastManager.#removeReserve,
      toggleStage: CastManager.#toggleStage
    }
  };

  static PARTS = {
    content: { template: `modules/${MODULE_ID}/templates/cast-manager.hbs` }
  };

  static #instance;

  static open() {
    if (!this.#instance) this.#instance = new this();
    this.#instance.render({ force: true });
    return this.#instance;
  }

  static refresh() {
    if (this.#instance?.rendered) this.#instance.render();
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const scene = canvas.scene;
    if (!scene) return { ...context, hasScene: false, groups: [] };
    const state = getCombinedCastState(scene);
    const groups = await Promise.all([
      this.#prepareGroup(GROUP_IDS.PCS, "RNPS.Groups.Pcs", state),
      this.#prepareGroup(GROUP_IDS.NPCS, "RNPS.Groups.Npcs", state)
    ]);
    return {
      ...context,
      hasScene: true,
      isGM: game.user.isGM,
      stageEnabled: game.settings.get(MODULE_ID, SETTING_KEYS.STAGE_ENABLED),
      hint: game.i18n.localize("RNPS.Manager.Hint"),
      groups,
      reserve: await prepareReserveActors()
    };
  }

  async #prepareGroup(id, labelKey, state) {
    const entries = await Promise.all(state.groups[id].entries.map(async entry => {
      const view = await preparePortraitView(entry);
      if (view) return { ...view, persistent: entry.layer === CAST_LAYERS.PERSISTENT };
      if (!game.user.isGM) return null;
      return {
        entry,
        id: entry.id,
        actorUuid: entry.actorUuid,
        name: game.i18n.localize("RNPS.Notifications.ActorUnavailable"),
        image: CONST.DEFAULT_TOKEN,
        visible: entry.visible,
        persistent: entry.layer === CAST_LAYERS.PERSISTENT,
        missing: true
      };
    }));
    return {
      id,
      label: game.i18n.localize(labelKey),
      entries: entries.filter(Boolean),
      isPcs: id === GROUP_IDS.PCS,
      portraitSize: id === GROUP_IDS.PCS
        ? state.layout.pcPortraitSize ?? game.settings.get(MODULE_ID, SETTING_KEYS.PORTRAIT_SIZE)
        : state.layout.npcPortraitSize ?? game.settings.get(MODULE_ID, SETTING_KEYS.PORTRAIT_SIZE)
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    if (!game.user.isGM) return;
    for (const target of this.element.querySelectorAll("[data-group-id], [data-reserve-drop]")) {
      target.addEventListener("dragover", event => this.#onDragOver(event));
      target.addEventListener("drop", event => this.#onDrop(event));
    }
    for (const entry of this.element.querySelectorAll(".rnps-manager-group .rnps-manager-entry[data-entry-id]")) {
      entry.addEventListener("dragstart", event => this.#onDragStart(event));
    }
    for (const reserve of this.element.querySelectorAll("[data-reserve-actor]")) {
      reserve.addEventListener("dragstart", event => this.#onReserveDragStart(event));
    }
    for (const groupId of Object.values(GROUP_IDS)) {
      const input = this.element.querySelector(`[name='${groupId}PortraitSize']`);
      const output = this.element.querySelector(`[data-size-output='${groupId}']`);
      input?.addEventListener("input", event => {
        if (output) output.value = event.currentTarget.value;
      });
      input?.addEventListener("change", async event => {
        await setCastPortraitSize(Number(event.currentTarget.value), {
          layer: CAST_LAYERS.SCENE,
          groupId
        });
        this.render();
      });
    }
    for (const image of this.element.querySelectorAll("img")) {
      image.draggable = false;
      image.addEventListener("error", () => {
        if (image.src !== CONST.DEFAULT_TOKEN) image.src = CONST.DEFAULT_TOKEN;
      }, { once: true });
    }
  }

  #onDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  async #onDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget;
    try {
      const data = parseDropData(event);
      if (target.hasAttribute("data-reserve-drop")) {
        const actorUuid = data.type === "RNPortraitStageEntry" ? data.actorUuid : data.uuid;
        if (!actorUuid) throw new Error(game.i18n.localize("RNPS.Notifications.ActorDropOnly"));
        const castEntry = data.type === "RNPortraitStageEntry"
          ? findCombinedEntry(data.entryId, data.layer)
          : null;
        await addActorToReserve(actorUuid, { entry: castEntry });
        if (data.type === "RNPortraitStageEntry") {
          await removeCastEntry(data.entryId, { layer: data.layer });
        }
        this.render();
        return;
      }
      const groupId = target.dataset.groupId;
      const targetEntry = event.target.closest(".rnps-manager-entry[data-entry-id]");
      const index = targetEntry
        ? [...target.querySelectorAll(":scope > .rnps-manager-list > .rnps-manager-entry[data-entry-id]")].indexOf(targetEntry)
        : null;
      if (data.type === "RNPortraitStageEntry") {
        await moveCastEntry(data.entryId, { layer: data.layer, groupId, index });
      } else if (data.type === "RNPortraitStageReserve" && data.entryId) {
        const reserveEntry = getReserveEntry(data.entryId);
        if (!reserveEntry) throw new Error(game.i18n.localize("RNPS.Notifications.ActorUnavailable"));
        const placed = await addActorToCast(reserveEntry.actorUuid, { groupId, index });
        const initialLayer = groupId === GROUP_IDS.PCS ? CAST_LAYERS.PERSISTENT : CAST_LAYERS.SCENE;
        await updateCastEntry(placed.id, {
          targetLayer: reserveEntry.flags?.reservePersistent ? CAST_LAYERS.PERSISTENT : CAST_LAYERS.SCENE,
          activeVariantId: reserveEntry.activeVariantId,
          labelOverride: reserveEntry.labelOverride,
          mirrored: reserveEntry.mirrored,
          visible: reserveEntry.visible
        }, { layer: initialLayer });
        await removeActorFromReserve(reserveEntry.id);
      } else if (data.type === "Actor" && data.uuid) {
        await addActorToCast(data.uuid, { groupId, index });
      } else {
        throw new Error(game.i18n.localize("RNPS.Notifications.ActorDropOnly"));
      }
      this.render();
    } catch (error) {
      logger.error("Unable to process cast drop", error);
      ui.notifications.error(error.message);
    }
  }

  #onDragStart(event) {
    const entry = event.currentTarget;
    event.dataTransfer.setData("text/plain", JSON.stringify({
      type: "RNPortraitStageEntry",
      entryId: entry.dataset.entryId,
      layer: entry.dataset.layer,
      actorUuid: entry.dataset.actorUuid
    }));
    event.dataTransfer.effectAllowed = "move";
  }

  #onReserveDragStart(event) {
    event.dataTransfer.setData("text/plain", JSON.stringify({
      type: "RNPortraitStageReserve",
      entryId: event.currentTarget.dataset.entryId,
      uuid: event.currentTarget.dataset.actorUuid
    }));
    event.dataTransfer.effectAllowed = "copyMove";
  }

  static #editEntry(event, target) {
    const entry = target.closest("[data-entry-id]");
    PortraitEditor.open(entry?.dataset.entryId, entry?.dataset.layer);
  }

  static async #removeEntry(event, target) {
    const entry = target.closest("[data-entry-id]");
    if (!entry?.dataset.entryId) return;
    await removeCastEntry(entry.dataset.entryId, { layer: entry.dataset.layer });
    this.render();
  }

  static async #togglePersistent(event, target) {
    const entry = target.closest("[data-entry-id]");
    if (!entry?.dataset.entryId) return;
    await updateCastEntry(entry.dataset.entryId, {
      targetLayer: entry.dataset.layer === CAST_LAYERS.PERSISTENT
        ? CAST_LAYERS.SCENE
        : CAST_LAYERS.PERSISTENT
    }, { layer: entry.dataset.layer });
    this.render();
  }

  static async #toggleMirror(event, target) {
    const entry = target.closest("[data-entry-id]");
    if (!entry?.dataset.entryId) return;
    const current = getCombinedCastState(canvas.scene).groups[entry.closest("[data-group-id]").dataset.groupId]
      .entries.find(item => item.id === entry.dataset.entryId && item.layer === entry.dataset.layer);
    if (!current) return;
    await updateCastEntry(current.id, { mirrored: !current.mirrored }, { layer: current.layer });
    this.render();
  }

  static async #toggleVisible(event, target) {
    const entry = target.closest("[data-entry-id]");
    if (!entry?.dataset.entryId) return;
    const current = getCombinedCastState(canvas.scene).groups[entry.closest("[data-group-id]").dataset.groupId]
      .entries.find(item => item.id === entry.dataset.entryId && item.layer === entry.dataset.layer);
    if (!current) return;
    await updateCastEntry(current.id, { visible: !current.visible }, { layer: current.layer });
    this.render();
  }

  static async #removeReserve(event, target) {
    const entryId = target.closest("[data-reserve-actor]")?.dataset.entryId;
    if (!entryId) return;
    await removeActorFromReserve(entryId);
    this.render();
  }

  static #editReserve(event, target) {
    const entryId = target.closest("[data-reserve-actor]")?.dataset.entryId;
    PortraitEditor.open(entryId, CAST_LAYERS.RESERVE);
  }

  static async #toggleReserveMirror(event, target) {
    await CastManager.#updateReserveBoolean(target, "mirrored");
    this.render();
  }

  static async #toggleReserveVisible(event, target) {
    await CastManager.#updateReserveBoolean(target, "visible");
    this.render();
  }

  static async #toggleReservePersistent(event, target) {
    const entryId = target.closest("[data-reserve-actor]")?.dataset.entryId;
    const entry = getReserveEntry(entryId);
    if (!entry) return;
    await updateReserveEntry(entry.id, {
      flags: { reservePersistent: !entry.flags?.reservePersistent }
    });
    this.render();
  }

  static async #updateReserveBoolean(target, key) {
    const entryId = target.closest("[data-reserve-actor]")?.dataset.entryId;
    const entry = getReserveEntry(entryId);
    if (!entry) return;
    await updateReserveEntry(entry.id, { [key]: !entry[key] });
  }

  static async #toggleStage() {
    const current = game.settings.get(MODULE_ID, SETTING_KEYS.STAGE_ENABLED);
    await game.settings.set(MODULE_ID, SETTING_KEYS.STAGE_ENABLED, !current);
    this.render();
  }
}

function findCombinedEntry(entryId, layer) {
  return Object.values(GROUP_IDS).flatMap(groupId => (
    getCombinedCastState(canvas.scene).groups[groupId].entries
  )).find(entry => entry.id === entryId && entry.layer === layer) ?? null;
}

function parseDropData(event) {
  const raw = event.dataTransfer?.getData("text/plain");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
