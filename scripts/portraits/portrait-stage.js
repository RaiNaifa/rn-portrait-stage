import { GROUP_IDS, HOOKS, MODULE_ID, SETTING_KEYS } from "../constants.js";
import { moveCastEntry, removeCastEntry } from "../data/cast-service.js";
import { getSceneState } from "../data/scene-state.js";
import { resolveUiAnchor } from "../compatibility/ui-anchors.js";
import { PortraitEditor } from "../apps/portrait-editor.js";
import { preparePortraitView } from "./portrait-data.js";
import { logger } from "../logger.js";

export class PortraitStage {
  #groups = new Map();
  #renderVersion = 0;

  initialize() {
    for (const groupId of Object.values(GROUP_IDS)) {
      if (this.#groups.has(groupId)) continue;
      const group = document.createElement("section");
      group.className = `rn-portrait-stage rnps-stage-group rnps-stage-group--${groupId}`;
      group.dataset.groupId = groupId;
      group.setAttribute("aria-live", "polite");
      group.setAttribute("aria-label", game.i18n.localize(
        groupId === GROUP_IDS.PCS ? "RNPS.Groups.Pcs" : "RNPS.Groups.Npcs"
      ));
      this.#groups.set(groupId, group);
    }
    this.#attachGroups();
    this.render();
  }

  destroy() {
    document.querySelector("#ui-left-column-2")?.classList.remove("rnps-pc-layout");
    for (const group of this.#groups.values()) group.remove();
    this.#groups.clear();
  }

  async render() {
    this.#attachGroups();
    if (!this.#groups.size) return;
    const version = ++this.#renderVersion;
    const visible = game.settings.get(MODULE_ID, SETTING_KEYS.MODULE_VISIBLE);
    for (const group of this.#groups.values()) group.hidden = !visible;
    if (!visible) {
      this.#setPcLayoutActive(false);
      return;
    }

    const scene = canvas.scene;
    const state = getSceneState(scene);

    for (const groupId of Object.values(GROUP_IDS)) {
      const views = await Promise.all(
        state.groups[groupId].entries.map(entry => preparePortraitView(entry))
      );
      if (version !== this.#renderVersion) return;
      this.#renderGroup(groupId, views.filter(view => view?.visible));
    }

    this.#applySettings();
  }

  #attachGroups() {
    const left = resolveUiAnchor("leftSecondary");
    const right = resolveUiAnchor("rightPrimary");
    const pcs = this.#groups.get(GROUP_IDS.PCS);
    const npcs = this.#groups.get(GROUP_IDS.NPCS);

    if (left && pcs && pcs.parentElement !== left) left.append(pcs);
    if (right && npcs && npcs.parentElement !== right) right.append(npcs);
  }

  #renderGroup(groupId, views) {
    const group = this.#groups.get(groupId);
    group.replaceChildren();

    for (const view of views) {
      const card = document.createElement("article");
      card.className = "rnps-portrait";
      card.dataset.entryId = view.id;
      card.dataset.actorUuid = view.actorUuid;
      card.tabIndex = 0;
      card.title = view.name;

      const image = document.createElement("img");
      image.src = view.image;
      image.alt = "";
      image.draggable = false;
      image.addEventListener("error", () => {
        if (image.src !== CONST.DEFAULT_TOKEN) image.src = CONST.DEFAULT_TOKEN;
      }, { once: true });
      card.append(image);

      const name = document.createElement("span");
      name.className = "rnps-portrait-name";
      name.textContent = view.name;
      card.append(name);

      if (game.user.isGM) card.append(this.#createActions(view, groupId));

      card.addEventListener("dblclick", () => {
        if (view.canOpenSheet) view.actor.sheet?.render({ force: true });
      });
      card.addEventListener("keydown", event => {
        if (event.key === "Enter" && view.canOpenSheet) {
          view.actor.sheet?.render({ force: true });
        }
      });
      group.append(card);
    }

    if (groupId === GROUP_IDS.PCS) this.#setPcLayoutActive(views.length > 0);
  }

  #setPcLayoutActive(active) {
    const column = document.querySelector("#ui-left-column-2");
    if (!column) return;
    const changed = column.classList.contains("rnps-pc-layout") !== active;
    column.classList.toggle("rnps-pc-layout", active);
    if (changed) Hooks.callAll(HOOKS.LAYOUT_CHANGED, { active });
  }

  #createActions(view, groupId) {
    const actions = document.createElement("div");
    actions.className = "rnps-portrait-actions";

    actions.append(
      this.#actionButton("fa-solid fa-gear", "RNPS.Controls.Edit", () => PortraitEditor.open(view.id)),
      this.#actionButton(
        "fa-solid fa-arrow-right-arrow-left",
        groupId === GROUP_IDS.PCS ? "RNPS.Controls.MoveToNpcs" : "RNPS.Controls.MoveToPcs",
        async () => {
          await moveCastEntry(view.id, {
            groupId: groupId === GROUP_IDS.PCS ? GROUP_IDS.NPCS : GROUP_IDS.PCS
          });
        }
      ),
      this.#actionButton("fa-solid fa-xmark", "RNPS.Controls.Remove", async () => {
        await removeCastEntry(view.id);
      })
    );
    return actions;
  }

  #actionButton(icon, titleKey, callback) {
    const button = document.createElement("button");
    button.type = "button";
    button.title = game.i18n.localize(titleKey);
    const iconElement = document.createElement("i");
    iconElement.className = icon;
    iconElement.setAttribute("aria-hidden", "true");
    button.append(iconElement);
    button.addEventListener("click", async event => {
      event.stopPropagation();
      try {
        await callback();
      } catch (error) {
        logger.error("Portrait action failed", error);
        ui.notifications.error(error.message);
      }
    });
    return button;
  }

  #applySettings() {
    const size = game.settings.get(MODULE_ID, SETTING_KEYS.PORTRAIT_SIZE);
    const gap = game.settings.get(MODULE_ID, SETTING_KEYS.PORTRAIT_GAP);

    for (const [groupId, directionKey, offsetXKey, offsetYKey] of [
      [GROUP_IDS.PCS, SETTING_KEYS.PC_DIRECTION, SETTING_KEYS.PC_OFFSET_X, SETTING_KEYS.PC_OFFSET_Y],
      [GROUP_IDS.NPCS, SETTING_KEYS.NPC_DIRECTION, SETTING_KEYS.NPC_OFFSET_X, SETTING_KEYS.NPC_OFFSET_Y]
    ]) {
      const group = this.#groups.get(groupId);
      group.style.setProperty("--rnps-size", `${size}px`);
      group.style.setProperty("--rnps-gap", `${gap}px`);
      group.style.setProperty("--rnps-offset-x", `${game.settings.get(MODULE_ID, offsetXKey)}px`);
      group.style.setProperty("--rnps-offset-y", `${game.settings.get(MODULE_ID, offsetYKey)}px`);
      group.dataset.direction = game.settings.get(MODULE_ID, directionKey);
    }

    const leftColumn = document.querySelector("#ui-left-column-2");
    leftColumn?.style.setProperty("--rnps-size", `${size}px`);
    leftColumn?.style.setProperty("--rnps-gap", `${gap}px`);
  }
}

export const portraitStage = new PortraitStage();
