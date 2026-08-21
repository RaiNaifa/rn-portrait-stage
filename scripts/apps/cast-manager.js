import { CAST_LAYERS, GROUP_IDS, MODULE_ID, SETTING_KEYS } from "../constants.js";
import {
  addActorToCast,
  getCombinedCastState,
  moveCastEntry,
  removeCastEntry,
  setCastPortraitSize,
  setCastTokenHighlight,
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
import { applyPreview, getPreviewSession, previewIsStale, resetPreview, togglePreview } from "../data/preview-service.js";
import { applyCastPreset, deleteCastPreset, getCastPresets, previewCastPreset, saveCastPreset, updateCastPreset } from "../data/preset-service.js";

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
      toggleStage: CastManager.#toggleStage,
      togglePreview: CastManager.#togglePreview,
      applyPreview: CastManager.#applyPreview,
      resetPreview: CastManager.#resetPreview,
      showComposition: CastManager.#showComposition,
      showPresets: CastManager.#showPresets,
      savePreset: CastManager.#savePreset,
      previewPreset: CastManager.#previewPreset,
      applyPreset: CastManager.#applyPreset,
      deletePreset: CastManager.#deletePreset,
      showAllLitmTags: CastManager.#showAllLitmTags,
      hideAllLitmTags: CastManager.#hideAllLitmTags
    }
  };

  static PARTS = {
    content: { template: `modules/${MODULE_ID}/templates/cast-manager.hbs` }
  };

  static #instance;
  #tab = "composition";

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
    const preview = getPreviewSession();
    return {
      ...context,
      hasScene: true,
      isGM: game.user.isGM,
      stageEnabled: game.settings.get(MODULE_ID, SETTING_KEYS.STAGE_ENABLED),
      previewActive: preview.active,
      previewDirty: preview.dirty,
      previewStale: preview.active && previewIsStale(scene),
      previewPresetId: preview.presetId,
      previewPresetName: preview.presetName,
      litmIntegrationEnabled: game.system.id === "litm-rn"
        && game.settings.get(MODULE_ID, SETTING_KEYS.LITM_INTEGRATION_ENABLED),
      compositionTab: this.#tab === "composition",
      presetsTab: this.#tab === "presets",
      presets: await this.#preparePresets(),
      tokenHighlightDefault: state.layout.tokenHighlight === null,
      tokenHighlightEnabled: state.layout.tokenHighlight === true,
      tokenHighlightDisabled: state.layout.tokenHighlight === false,
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
        ? state.layout.pcPortraitSize ?? 160
        : state.layout.npcPortraitSize ?? 160
    };
  }

  async #preparePresets() {
    return Promise.all(getCastPresets().map(async preset => {
      const sceneActors = new Set(Object.values(GROUP_IDS).flatMap(groupId => (
        preset.scene.groups[groupId].entries.map(entry => entry.actorUuid)
      )));
      const groups = {};
      for (const groupId of Object.values(GROUP_IDS)) {
        const entries = [
          ...preset.persistent.groups[groupId].entries
            .filter(entry => !sceneActors.has(entry.actorUuid))
            .map(entry => ({ ...entry, layer: CAST_LAYERS.PERSISTENT })),
          ...preset.scene.groups[groupId].entries
            .map(entry => ({ ...entry, layer: CAST_LAYERS.SCENE }))
        ].sort((a, b) => a.sort - b.sort);
        const views = await Promise.all(entries.map(entry => preparePortraitView(entry)));
        groups[groupId] = views.filter(Boolean).map(view => ({
          image: view.image,
          isVideo: view.isVideo,
          name: view.name,
          mirrored: Boolean(view.entry.mirrored) !== Boolean(view.variant.settings?.media?.mirrored)
        }));
      }
      return { ...preset, pcs: groups[GROUP_IDS.PCS], npcs: groups[GROUP_IDS.NPCS] };
    }));
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
    this.element.querySelector("[name='tokenHighlightMode']")?.addEventListener("change", async event => {
      const value = event.currentTarget.value;
      await setCastTokenHighlight(value === "inherit" ? null : value === "enabled");
      this.render();
    });
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

  static async #togglePreview() {
    await togglePreview(canvas.scene);
    this.render();
  }

  static async #applyPreview() {
    await applyPreview(canvas.scene, {
      castMode: this.element.querySelector("[name='previewCastMode']")?.value ?? "replaceAll",
      reserveMode: this.element.querySelector("[name='previewReserveMode']")?.value ?? "replace"
    });
    ui.notifications.info(game.i18n.localize("RNPS.Preview.Applied"));
    this.render();
  }

  static async #resetPreview() {
    await resetPreview(canvas.scene);
    this.render();
  }

  static #showComposition() {
    this.#tab = "composition";
    this.render();
  }

  static #showPresets() {
    this.#tab = "presets";
    this.render();
  }

  static async #savePreset() {
    const preview = getPreviewSession();
    if (preview.active && preview.presetId) {
      await updateCastPreset(preview.presetId, canvas.scene);
      ui.notifications.info(game.i18n.format("RNPS.Presets.Updated", { name: preview.presetName }));
      this.render();
      return;
    }
    const input = this.element.querySelector("[name='presetName']");
    if (!input) {
      this.#tab = "presets";
      this.render();
      return;
    }
    const name = input?.value.trim();
    if (!name) return input?.focus();
    await saveCastPreset(name, canvas.scene);
    this.#tab = "presets";
    this.render();
  }

  static async #previewPreset(event, target) {
    await previewCastPreset(target.closest("[data-preset-id]")?.dataset.presetId, canvas.scene);
    this.#tab = "composition";
    this.render();
  }

  static async #applyPreset(event, target) {
    const card = target.closest("[data-preset-id]");
    if (!card) return;
    await applyCastPreset(card.dataset.presetId, {
      castMode: card.querySelector("[name='castMode']")?.value,
      reserveMode: card.querySelector("[name='reserveMode']")?.value
    });
    ui.notifications.info(game.i18n.localize("RNPS.Presets.Applied"));
    this.render();
  }

  static async #deletePreset(event, target) {
    const id = target.closest("[data-preset-id]")?.dataset.presetId;
    if (!id) return;
    await deleteCastPreset(id);
    this.render();
  }

  static async #showAllLitmTags() {
    await this.#setAllLitmTags(true);
    this.render();
  }

  static async #hideAllLitmTags() {
    await this.#setAllLitmTags(false);
    this.render();
  }

  async #setAllLitmTags(visible) {
    const state = getCombinedCastState(canvas.scene);
    for (const entry of Object.values(GROUP_IDS).flatMap(groupId => state.groups[groupId].entries)) {
      await updateCastEntry(entry.id, {
        flags: {
          "litm-rn": {
            ...(entry.flags?.["litm-rn"] ?? {}),
            tagsVisible: visible
          }
        }
      }, { layer: entry.layer });
    }
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
