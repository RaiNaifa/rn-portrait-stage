import { GROUP_IDS, MODULE_ID } from "../constants.js";
import {
  addActorToCast,
  moveCastEntry,
  removeCastEntry
} from "../data/cast-service.js";
import { getSceneState } from "../data/scene-state.js";
import { preparePortraitView } from "../portraits/portrait-data.js";
import { PortraitEditor } from "./portrait-editor.js";
import { logger } from "../logger.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class CastManager extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "rn-portrait-stage-cast-manager",
    classes: ["rn-portrait-stage-app", "rn-portrait-stage-cast-manager"],
    tag: "section",
    position: {
      width: 760,
      height: 640
    },
    window: {
      icon: "fa-solid fa-masks-theater",
      title: "RNPS.Manager.Title",
      resizable: true,
      contentClasses: ["standard-form"]
    },
    actions: {
      edit: CastManager.#editEntry,
      remove: CastManager.#removeEntry,
      openActor: CastManager.#openActor
    }
  };

  static PARTS = {
    content: {
      template: `modules/${MODULE_ID}/templates/cast-manager.hbs`
    }
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

    const state = getSceneState(scene);
    const groups = await Promise.all([
      this.#prepareGroup(GROUP_IDS.PCS, "RNPS.Groups.Pcs", state),
      this.#prepareGroup(GROUP_IDS.NPCS, "RNPS.Groups.Npcs", state)
    ]);

    return {
      ...context,
      hasScene: true,
      isGM: game.user.isGM,
      hint: game.i18n.localize("RNPS.Manager.Hint"),
      groups
    };
  }

  async #prepareGroup(id, labelKey, state) {
    const entries = await Promise.all(state.groups[id].entries.map(async entry => {
      const view = await preparePortraitView(entry);
      if (view) return view;
      if (!game.user.isGM) return null;
      return {
        entry,
        id: entry.id,
        actorUuid: entry.actorUuid,
        name: game.i18n.localize("RNPS.Notifications.ActorUnavailable"),
        image: CONST.DEFAULT_TOKEN,
        visible: entry.visible,
        missing: true
      };
    }));
    return {
      id,
      label: game.i18n.localize(labelKey),
      entries: entries.filter(Boolean)
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    if (!game.user.isGM) return;

    for (const group of this.element.querySelectorAll("[data-group-id]")) {
      group.addEventListener("dragover", event => this.#onDragOver(event));
      group.addEventListener("drop", event => this.#onDrop(event));
    }

    for (const entry of this.element.querySelectorAll("[data-entry-id]")) {
      entry.addEventListener("dragstart", event => this.#onDragStart(event));
    }

    for (const image of this.element.querySelectorAll(".rnps-manager-entry img")) {
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

    const group = event.currentTarget;
    const groupId = group.dataset.groupId;
    const targetEntry = event.target.closest("[data-entry-id]");
    const index = targetEntry
      ? [...group.querySelectorAll("[data-entry-id]")].indexOf(targetEntry)
      : null;

    try {
      const data = parseDropData(event);
      if (data.type === "RNPortraitStageEntry") {
        await moveCastEntry(data.entryId, { groupId, index });
      } else if (data.type === "Actor" && data.uuid) {
        await addActorToCast(data.uuid, { groupId, index });
      } else {
        ui.notifications.warn("RNPS.Notifications.ActorDropOnly", { localize: true });
        return;
      }
      this.render();
    } catch (error) {
      logger.error("Unable to process cast drop", error);
      ui.notifications.error(error.message);
    }
  }

  #onDragStart(event) {
    const entryId = event.currentTarget.dataset.entryId;
    event.dataTransfer.setData("text/plain", JSON.stringify({
      type: "RNPortraitStageEntry",
      entryId
    }));
    event.dataTransfer.effectAllowed = "move";
  }

  static #editEntry(event, target) {
    PortraitEditor.open(target.closest("[data-entry-id]")?.dataset.entryId);
  }

  static async #removeEntry(event, target) {
    const entryId = target.closest("[data-entry-id]")?.dataset.entryId;
    if (!entryId) return;
    await removeCastEntry(entryId);
    this.render();
  }

  static async #openActor(event, target) {
    const actorUuid = target.closest("[data-actor-uuid]")?.dataset.actorUuid;
    const actor = actorUuid ? await fromUuid(actorUuid) : null;
    if (actor?.testUserPermission(game.user, "LIMITED")) {
      actor.sheet?.render({ force: true });
    }
  }
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
