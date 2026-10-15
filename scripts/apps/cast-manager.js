import { CAST_LAYERS, CAST_PORTRAIT_SIZE, GROUP_IDS, MODULE_ID, SETTING_KEYS } from "../constants.js";
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
  moveReserveEntry,
  prepareReserveActors,
  removeActorFromReserve,
  updateReserveEntry
} from "../data/reserve-service.js";
import { preparePortraitView, resolveFocusView } from "../portraits/portrait-data.js";
import { PortraitEditor } from "./portrait-editor.js";
import { BackgroundSettings } from "./background-settings.js";
import { logger } from "../logger.js";
import { applyPreview, ensurePreviewDraft, getPreviewConflicts, getPreviewSession, resetPreview, setPreviewAutoApply, withoutPreview } from "../data/preview-service.js";
import { activateSceneBackground, assignFocus, clearFocus, deactivateSceneBackground, getPresentation, moveFocusZone, setBackgroundFollowActive, setFocusPersistent, setFocusVisible, updateFocusEntry } from "../data/scene-presentation.js";
import { addBackgroundGroup, addBackgroundVariant, getBackgroundLibrary, moveBackgroundGroup, moveBackgroundVariant, removeBackgroundGroup, removeBackgroundVariant, renameBackgroundGroup } from "../data/background-library.js";
import { getClientVisibility, getSharedVisibility, toggleClientVisibility, toggleSharedVisibility, VISIBILITY_LAYERS } from "../data/visibility-service.js";
import { portraitStage } from "../portraits/portrait-stage.js";

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
      toggleReserveFavorite: CastManager.#toggleReserveFavorite,
      toggleReserveMirror: CastManager.#toggleReserveMirror,
      toggleReservePersistent: CastManager.#toggleReservePersistent,
      toggleReserveVisible: CastManager.#toggleReserveVisible,
      removeReserve: CastManager.#removeReserve,
      toggleSharedLayer: CastManager.#toggleSharedLayer,
      toggleClientLayer: CastManager.#toggleClientLayer,
      applyPreview: CastManager.#applyPreview,
      resetPreview: CastManager.#resetPreview,
      togglePreviewAutoApply: CastManager.#togglePreviewAutoApply,
      showComposition: CastManager.#showComposition,
      showPresets: CastManager.#showPresets,
      showBackground: CastManager.#showBackground,
      toggleBackgroundSidebar: CastManager.#toggleBackgroundSidebar,
      showAllLitmTags: CastManager.#showAllLitmTags,
      hideAllLitmTags: CastManager.#hideAllLitmTags,
      clearFocus: CastManager.#clearFocus,
      toggleFocusEditMode: CastManager.#toggleFocusEditMode,
      toggleFocusVisible: CastManager.#toggleFocusVisible,
      editFocus: CastManager.#editFocus,
      toggleFocusMirror: CastManager.#toggleFocusMirror,
      toggleFocusPersistent: CastManager.#toggleFocusPersistent,
      addBackground: CastManager.#addBackground,
      addBackgroundGroup: CastManager.#addBackgroundGroup,
      toggleBackgroundGroup: CastManager.#toggleBackgroundGroup,
      removeBackgroundGroup: CastManager.#removeBackgroundGroup,
      editBackground: CastManager.#editBackground,
      toggleActiveBackground: CastManager.#toggleActiveBackground,
      toggleBackgroundFollowActive: CastManager.#toggleBackgroundFollowActive,
      removeBackground: CastManager.#removeBackground
    }
  };

  static PARTS = {
    content: { template: `modules/${MODULE_ID}/templates/cast-manager.hbs` }
  };

  static #instance;
  #tab = "composition";
  #sidebarOpen = false;
  #sidebarWidthApplied = 0;
  #backgroundSearch = "";
  #collapsedBackgroundGroups = new Set();
  #scrollPositions = new Map();

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
    await ensurePreviewDraft(scene);
    const state = getCombinedCastState(scene);
    const groups = await Promise.all([
      this.#prepareGroup(GROUP_IDS.PCS, "RNPS.Focus.Left", state),
      this.#prepareGroup(GROUP_IDS.NPCS, "RNPS.Focus.Right", state)
    ]);
    const preview = getPreviewSession();
    const conflicts = getPreviewConflicts(scene);
    const presentation = getPresentation(scene);
    const backgroundLibrary = getBackgroundLibrary();
    const backgroundViews = backgroundLibrary.backgrounds.map(item => ({
      ...item,
      active: item.id === presentation.activeBackgroundId,
      isVideo: /\.(?:webm|mp4|m4v|ogv|ogg)(?:[?#]|$)/i.test(item.src)
    }));
    const sharedVisibility = getSharedVisibility();
    const clientVisibility = getClientVisibility();
    const focusZones = await Promise.all(["left", "center", "right"].map(async zone => {
      const item = presentation.focus[zone];
      const view = item ? resolveFocusView(await preparePortraitView(item.entry)) : null;
      return {
        id: zone,
        label: game.i18n.localize(`RNPS.Focus.${zone[0].toUpperCase()}${zone.slice(1)}`),
        assigned: Boolean(item),
        editable: Boolean(view && item?.visible !== false),
        visible: item?.visible !== false,
        persistent: item?.persistent === true,
        entryId: item?.entry?.id,
        entryMirrored: item?.entry?.mirrored === true,
        actorUuid: item?.entry?.actorUuid,
        name: view?.name ?? game.i18n.localize("RNPS.Notifications.ActorUnavailable"),
        image: view?.image ?? CONST.DEFAULT_TOKEN,
        isVideo: view?.isVideo ?? false,
        mirrored: view?.mirrored ?? false
      };
    }));
    return {
      ...context,
      hasScene: true,
      isGM: game.user.isGM,
      visibilityZones: ["all", ...VISIBILITY_LAYERS].map(layer => {
        const shared = layer === "all" ? VISIBILITY_LAYERS.every(key => sharedVisibility[key]) : sharedVisibility[layer];
        const self = layer === "all" ? VISIBILITY_LAYERS.every(key => clientVisibility[key]) : clientVisibility[layer];
        return {
          id: layer,
          label: game.i18n.localize(`RNPS.Visibility.${layer[0].toUpperCase()}${layer.slice(1)}`),
          shared,
          self,
          sharedTooltip: game.i18n.localize(shared ? "RNPS.Visibility.HideForAll" : "RNPS.Visibility.ShowForAll"),
          selfTooltip: game.i18n.localize(self ? "RNPS.Visibility.HideForSelf" : "RNPS.Visibility.ShowForSelf")
        };
      }),
      previewActive: preview.active,
      previewDirty: preview.dirty,
      previewAutoApply: game.settings.get(MODULE_ID, SETTING_KEYS.PREVIEW_AUTO_APPLY),
      autoApplyLocksActions: game.settings.get(MODULE_ID, SETTING_KEYS.PREVIEW_AUTO_APPLY),
      previewStale: conflicts.length > 0,
      reserveHeight: game.settings.get(MODULE_ID, SETTING_KEYS.RESERVE_HEIGHT),
      portraitSizeMin: CAST_PORTRAIT_SIZE.MIN,
      portraitSizeMax: CAST_PORTRAIT_SIZE.MAX,
      litmIntegrationEnabled: game.system.id === "litm-rn"
        && game.settings.get(MODULE_ID, SETTING_KEYS.LITM_INTEGRATION_ENABLED),
      compositionTab: this.#tab === "composition",
      presetsTab: this.#tab === "presets",
      backgroundTab: this.#tab === "background",
      editorTab: this.#tab === "composition",
      sidebarOpen: this.#tab === "composition" && this.#sidebarOpen,
      focusZones,
      focusEditMode: portraitStage.isFocusEditMode(),
      focusEditAvailable: focusZones.some(zone => zone.editable),
      backgroundGroups: backgroundLibrary.groups.map(group => ({
        ...group,
        isDefault: group.id === "default",
        collapsed: this.#collapsedBackgroundGroups.has(group.id),
        backgrounds: backgroundViews.filter(item => item.groupId === group.id)
      })),
      backgroundFollowActive: presentation.backgroundFollowActive,
      hasActiveBackground: Boolean(presentation.activeBackgroundId),
      backgroundSearch: this.#backgroundSearch,
      groups: groups.map(group => ({
        ...group,
        entries: group.entries.map(portrait => ({
          ...portrait,
          draftConflict: conflicts.some(path => path.includes(`.${portrait.id}.`)),
          draftConflictTooltip: game.i18n.localize("RNPS.Preview.EntryConflict")
        }))
      })),
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
        ? state.layout.pcPortraitSize ?? CAST_PORTRAIT_SIZE.DEFAULT
        : state.layout.npcPortraitSize ?? CAST_PORTRAIT_SIZE.DEFAULT
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.#bindScrollState();
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
    for (const zone of this.element.querySelectorAll("[data-focus-drop]")) {
      zone.addEventListener("dragover", event => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        zone.classList.add("rnps-focus-drop-hover");
      });
      zone.addEventListener("dragleave", event => {
        if (!zone.contains(event.relatedTarget)) zone.classList.remove("rnps-focus-drop-hover");
      });
      zone.addEventListener("drop", event => this.#onFocusDrop(event));
      zone.querySelector("[data-focus-actor]")?.addEventListener("dragstart", event => {
        event.dataTransfer.setData("text/plain", JSON.stringify({
          type: "RNPortraitStageFocus",
          actorUuid: event.currentTarget.dataset.focusActor,
          entryId: event.currentTarget.dataset.focusEntry,
          zone: zone.dataset.focusDrop
        }));
        event.dataTransfer.effectAllowed = "copyMove";
      });
    }
    const reserveHandle = this.element.querySelector("[data-reserve-resize]");
    reserveHandle?.addEventListener("pointerdown", event => this.#startReserveResize(event));
    reserveHandle?.addEventListener("dblclick", async () => {
      await game.settings.set(MODULE_ID, SETTING_KEYS.RESERVE_HEIGHT, 104);
      this.render();
    });
    for (const groupId of Object.values(GROUP_IDS)) {
      const slider = this.element.querySelector(`[name='${groupId}PortraitSize']`);
      const number = this.element.querySelector(`[data-size-output='${groupId}']`);
      const reset = this.element.querySelector(`[data-size-reset='${groupId}']`);
      let wheelTimer;
      const commit = async value => {
        clearTimeout(wheelTimer);
        const size = Number.isFinite(Number(value)) && value !== ""
          ? Math.max(CAST_PORTRAIT_SIZE.MIN, Math.min(CAST_PORTRAIT_SIZE.MAX, Math.round(Number(value))))
          : Number(slider.value);
        slider.value = String(size);
        number.value = String(size);
        await setCastPortraitSize(size, {
          layer: CAST_LAYERS.SCENE,
          groupId
        });
        this.render();
      };
      slider?.addEventListener("input", () => { number.value = slider.value; });
      slider?.addEventListener("change", () => void commit(slider.value));
      number?.addEventListener("input", () => {
        const value = Number(number.value);
        if (number.value !== "" && Number.isFinite(value)
          && value >= CAST_PORTRAIT_SIZE.MIN && value <= CAST_PORTRAIT_SIZE.MAX) slider.value = number.value;
      });
      number?.addEventListener("change", () => void commit(number.value));
      number?.addEventListener("wheel", event => {
        event.preventDefault();
        const size = Math.max(CAST_PORTRAIT_SIZE.MIN, Math.min(CAST_PORTRAIT_SIZE.MAX,
          Number(number.value || slider.value) + (event.deltaY < 0 ? 1 : -1)));
        number.value = String(size);
        slider.value = String(size);
        clearTimeout(wheelTimer);
        wheelTimer = setTimeout(() => void commit(number.value), 150);
      }, { passive: false });
      reset?.addEventListener("click", () => void commit(CAST_PORTRAIT_SIZE.DEFAULT));
    }
    for (const image of this.element.querySelectorAll("img")) {
      image.draggable = false;
      image.addEventListener("error", () => {
        if (image.src !== CONST.DEFAULT_TOKEN) image.src = CONST.DEFAULT_TOKEN;
      }, { once: true });
    }
    this.element.querySelector("[data-background-search]")?.addEventListener("input", event => {
      this.#backgroundSearch = event.currentTarget.value;
      this.#filterBackgrounds();
    });
    this.#filterBackgrounds();
    this.#bindBackgroundDrag();
    for (const label of this.element.querySelectorAll("[data-background-group-label]")) {
      label.addEventListener("dblclick", () => this.#beginBackgroundGroupRename(label.closest("[data-background-group]")));
      label.addEventListener("dragstart", event => {
        event.dataTransfer.setData("text/plain", JSON.stringify({ type: "RNPortraitStageBackgroundGroup", id: label.closest("[data-background-group]")?.dataset.backgroundGroup }));
        event.dataTransfer.effectAllowed = "move";
      });
      label.addEventListener("dragend", () => this.element.querySelectorAll("[data-background-group]").forEach(group => group.classList.remove("drag-target")));
    }
    for (const input of this.element.querySelectorAll("[data-background-group-name]")) {
      input.addEventListener("keydown", event => {
        if (event.key === "Enter") { event.preventDefault(); input.blur(); }
        if (event.key === "Escape") { event.preventDefault(); input.dataset.cancelRename = "true"; input.blur(); }
      });
      input.addEventListener("blur", async () => {
        const group = input.closest("[data-background-group]");
        const label = group?.querySelector("[data-background-group-label]");
        const name = input.value.trim();
        const cancelled = input.dataset.cancelRename === "true" || !name;
        delete input.dataset.cancelRename;
        input.hidden = true;
        if (label) label.hidden = false;
        if (!cancelled && name !== group.dataset.backgroundGroupName) {
          await renameBackgroundGroup(group.dataset.backgroundGroup, name);
          this.render();
        } else input.value = group.dataset.backgroundGroupName;
      });
    }
  }

  #beginBackgroundGroupRename(group) {
    const input = group?.querySelector("[data-background-group-name]");
    const label = group?.querySelector("[data-background-group-label]");
    if (!input || !label) return;
    label.hidden = true;
    input.hidden = false;
    input.focus();
    input.select();
  }

  #filterBackgrounds() {
    const query = this.#backgroundSearch.trim().toLocaleLowerCase();
    let matches = 0;
    for (const group of this.element.querySelectorAll("[data-background-group]")) {
      const groupMatches = Boolean(query) && group.dataset.backgroundGroupName?.toLocaleLowerCase().includes(query);
      let groupHasMatch = false;
      for (const card of group.querySelectorAll("[data-background-id]")) {
        card.hidden = Boolean(query) && !groupMatches && !card.dataset.backgroundName?.toLocaleLowerCase().includes(query);
        if (!card.hidden) groupHasMatch = true;
      }
      group.hidden = Boolean(query) && !groupMatches && !groupHasMatch;
      group.classList.toggle("collapsed", !query && this.#collapsedBackgroundGroups.has(group.dataset.backgroundGroup));
      if (!group.hidden && query) matches += 1;
    }
    const noResults = this.element.querySelector("[data-background-no-results]");
    if (noResults) noResults.hidden = !query || matches > 0;
  }

  #bindBackgroundDrag() {
    for (const card of this.element.querySelectorAll("[data-background-id]")) {
      card.addEventListener("dragstart", event => {
        event.dataTransfer.setData("text/plain", JSON.stringify({ type: "RNPortraitStageBackground", id: card.dataset.backgroundId }));
        event.dataTransfer.effectAllowed = "move";
      });
    }
    for (const group of this.element.querySelectorAll("[data-background-group]")) {
      group.addEventListener("dragover", event => { event.preventDefault(); event.dataTransfer.dropEffect = "copyMove"; group.classList.add("drag-target"); });
      group.addEventListener("dragleave", event => { if (!group.contains(event.relatedTarget)) group.classList.remove("drag-target"); });
      group.addEventListener("drop", async event => {
        event.preventDefault();
        event.stopPropagation();
        group.classList.remove("drag-target");
        let data;
        try { data = JSON.parse(event.dataTransfer.getData("text/plain")); } catch { return; }
        if (data?.type === "RNPortraitStageBackgroundGroup") {
          const rect = group.getBoundingClientRect();
          const after = event.clientY > rect.top + rect.height / 2;
          const beforeId = after ? group.nextElementSibling?.dataset.backgroundGroup : group.dataset.backgroundGroup;
          if (data.id !== group.dataset.backgroundGroup) await moveBackgroundGroup(data.id, beforeId);
        } else if (data?.type === "RNPortraitStageBackground") {
          const targetCard = event.target.closest("[data-background-id]");
          const rect = targetCard?.getBoundingClientRect();
          const columns = targetCard ? getComputedStyle(targetCard.parentElement).gridTemplateColumns.split(" ").length : 1;
          const after = rect && (columns > 1
            ? event.clientX > rect.left + rect.width / 2
            : event.clientY > rect.top + rect.height / 2);
          const beforeId = after ? targetCard.nextElementSibling?.dataset.backgroundId : targetCard?.dataset.backgroundId;
          if (data.id !== beforeId) await moveBackgroundVariant(data.id, group.dataset.backgroundGroup, beforeId);
        } else if (data?.type === "Scene") {
          let scene;
          try {
            scene = data.uuid ? await fromUuid(data.uuid) : game.scenes.get(data.id);
          } catch {
            scene = null;
          }
          const src = scene?.background?.src ?? scene?.img;
          if (scene?.documentName !== "Scene" || !src) {
            ui.notifications.warn(game.i18n.localize("RNPS.Background.SceneWithoutImage"));
            return;
          }
          await addBackgroundVariant({ src, name: scene.name, groupId: group.dataset.backgroundGroup });
        } else return;
        this.render();
      });
    }
  }

  #bindScrollState() {
    const targets = [
      ...[...this.element.querySelectorAll(".rnps-manager-list")].map(element => ({
        element,
        key: `group:${element.closest("[data-group-id]")?.dataset.groupId ?? "unknown"}`
      })),
      { element: this.element.querySelector(".rnps-reserve-list"), key: "reserve" },
      { element: this.element.querySelector(".rnps-presentation-settings"), key: "presentation" },
      { element: this.element.querySelector(".rnps-background-groups"), key: "background" },
    ].filter(item => item.element);
    for (const { element, key } of targets) {
      const saved = this.#scrollPositions.get(key);
      if (saved) {
        element.scrollLeft = saved.left;
        element.scrollTop = saved.top;
      }
      element.addEventListener("scroll", () => {
        this.#scrollPositions.set(key, { left: element.scrollLeft, top: element.scrollTop });
      }, { passive: true });
    }
    requestAnimationFrame(() => {
      for (const { element, key } of targets) {
        const saved = this.#scrollPositions.get(key);
        if (!saved) continue;
        element.scrollLeft = saved.left;
        element.scrollTop = saved.top;
      }
    });
  }

  #onDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  async #onFocusDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    const zone = event.currentTarget;
    zone.classList.remove("rnps-focus-drop-hover");
    const data = parseDropData(event);
    const actorUuid = data.type === "RNPortraitStageEntry" || data.type === "RNPortraitStageFocus"
      ? data.actorUuid : data.uuid;
    if (!actorUuid || !["Actor", "RNPortraitStageEntry", "RNPortraitStageReserve", "RNPortraitStageFocus"].includes(data.type)) return;
    try {
      const assigned = data.type === "RNPortraitStageFocus" && data.zone
        ? await moveFocusZone(data.zone, zone.dataset.focusDrop)
        : await assignFocus(zone.dataset.focusDrop, actorUuid);
      if (assigned) this.render();
    } catch (error) {
      logger.error("Unable to assign focus", error);
      ui.notifications.error(error.message);
    }
  }

  async #onDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget;
    try {
      const data = parseDropData(event);
      const focusItem = data.type === "RNPortraitStageFocus"
        ? getPresentation(canvas.scene).focus[data.zone]
        : null;
      if (data.type === "RNPortraitStageFocus"
        && (!focusItem || focusItem.entry.id !== data.entryId || focusItem.entry.actorUuid !== data.actorUuid)) {
        throw new Error(game.i18n.localize("RNPS.Notifications.ActorUnavailable"));
      }
      if (target.hasAttribute("data-reserve-drop")) {
        if (data.type === "RNPortraitStageReserve" && data.entryId) {
          const targetEntry = event.target.closest("[data-reserve-actor]");
          const entries = [...target.querySelectorAll("[data-reserve-actor]")];
          const index = targetEntry ? entries.indexOf(targetEntry) : null;
          await moveReserveEntry(data.entryId, index);
          this.render();
          return;
        }
        const actorUuid = data.type === "RNPortraitStageEntry" || focusItem ? data.actorUuid : data.uuid;
        if (!actorUuid) throw new Error(game.i18n.localize("RNPS.Notifications.ActorDropOnly"));
        const castEntry = focusItem
          ? { ...focusItem.entry, visible: focusItem.visible, layer: focusItem.persistent ? CAST_LAYERS.PERSISTENT : CAST_LAYERS.SCENE }
          : data.type === "RNPortraitStageEntry" ? findCombinedEntry(data.entryId, data.layer) : null;
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
      } else if (focusItem) {
        const placed = await addActorToCast(focusItem.entry.actorUuid, { groupId, index });
        const initialLayer = groupId === GROUP_IDS.PCS ? CAST_LAYERS.PERSISTENT : CAST_LAYERS.SCENE;
        await updateCastEntry(placed.id, {
          targetLayer: focusItem.persistent ? CAST_LAYERS.PERSISTENT : CAST_LAYERS.SCENE,
          activeVariantId: focusItem.entry.activeVariantId,
          labelOverride: focusItem.entry.labelOverride,
          mirrored: focusItem.entry.mirrored,
          visible: focusItem.visible
        }, { layer: initialLayer });
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
        if (reserveEntry.flags?.reserveFavorite !== true) {
          await removeActorFromReserve(reserveEntry.id);
        }
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
    event.dataTransfer.effectAllowed = "copyMove";
  }

  #onReserveDragStart(event) {
    event.dataTransfer.setData("text/plain", JSON.stringify({
      type: "RNPortraitStageReserve",
      entryId: event.currentTarget.dataset.entryId,
      uuid: event.currentTarget.dataset.actorUuid
    }));
    event.dataTransfer.effectAllowed = "copyMove";
  }

  #startReserveResize(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    const reserve = event.currentTarget.closest(".rnps-reserve");
    if (!reserve) return;
    const startY = event.clientY;
    const startHeight = reserve.getBoundingClientRect().height;
    const maximum = Math.max(104, Math.floor(this.element.querySelector(".rnps-manager-content").clientHeight * 0.55));
    const move = moveEvent => {
      const height = Math.max(82, Math.min(maximum, startHeight + startY - moveEvent.clientY));
      reserve.style.setProperty("--rnps-reserve-height", `${Math.round(height)}px`);
    };
    const finish = async upEvent => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      const height = Math.max(82, Math.min(maximum, startHeight + startY - upEvent.clientY));
      await game.settings.set(MODULE_ID, SETTING_KEYS.RESERVE_HEIGHT, Math.round(height));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, { once: true });
  }

  static #editEntry(event, target) {
    const entry = target.closest("[data-entry-id]");
    PortraitEditor.open(entry?.dataset.entryId, entry?.dataset.layer, { draft: true });
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
    PortraitEditor.open(entryId, CAST_LAYERS.RESERVE, { draft: true });
  }

  static async #toggleReserveFavorite(event, target) {
    const entryId = target.closest("[data-reserve-actor]")?.dataset.entryId;
    const entry = getReserveEntry(entryId);
    if (!entry) return;
    await updateReserveEntry(entry.id, {
      flags: { reserveFavorite: entry.flags?.reserveFavorite !== true }
    });
    this.render();
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

  static async #toggleSharedLayer(event, target) {
    await toggleSharedVisibility(target.closest("[data-visibility-layer]")?.dataset.visibilityLayer);
    await portraitStage.render();
    this.render();
  }

  static async #toggleClientLayer(event, target) {
    await toggleClientVisibility(target.closest("[data-visibility-layer]")?.dataset.visibilityLayer);
    await portraitStage.render();
    this.render();
  }

  static async #applyPreview() {
    await applyPreview(canvas.scene);
    this.render();
  }

  static async #resetPreview() {
    await resetPreview(canvas.scene);
    this.render();
  }

  static async #togglePreviewAutoApply(event, target) {
    await setPreviewAutoApply(target.checked);
    this.render();
  }

  static #showComposition() {
    this.#tab = "composition";
    this.#resizeForSidebar();
    this.render();
  }

  static #showPresets() {
    this.#tab = "presets";
    this.#resizeForSidebar();
    this.render();
  }

  static #showBackground() {
    this.#tab = "background";
    this.#resizeForSidebar();
    this.render();
  }

  static #toggleBackgroundSidebar() {
    if (this.#tab !== "composition") return;
    this.#sidebarOpen = !this.#sidebarOpen;
    this.#resizeForSidebar();
    this.render();
  }

  #resizeForSidebar() {
    const shouldExpand = this.#sidebarOpen && this.#tab === "composition";
    if (shouldExpand && !this.#sidebarWidthApplied) {
      const current = this.element?.getBoundingClientRect().width || this.position.width;
      this.setPosition({ width: current + 340 });
      this.#sidebarWidthApplied = 340;
    } else if (!shouldExpand && this.#sidebarWidthApplied) {
      const current = this.element?.getBoundingClientRect().width || this.position.width;
      this.setPosition({ width: Math.max(500, current - this.#sidebarWidthApplied) });
      this.#sidebarWidthApplied = 0;
    }
  }

  static async #clearFocus(event, target) {
    const zone = target.closest("[data-focus-drop]")?.dataset.focusDrop;
    if (!zone) return;
    await clearFocus(zone);
    this.render();
  }

  static async #toggleFocusEditMode() {
    const enabled = !portraitStage.isFocusEditMode();
    if (enabled && !Object.values(getPresentation(canvas.scene).focus)
      .some(item => item?.visible && item.entry)) return;
    portraitStage.setFocusEditMode(enabled);
    await this.render();
    if (enabled) await this.minimize();
  }

  static async #toggleFocusVisible(event, target) {
    const zone = target.closest("[data-focus-drop]")?.dataset.focusDrop;
    if (!zone) return;
    const current = getPresentation(canvas.scene).focus[zone];
    if (!current) return;
    await setFocusVisible(zone, current.visible === false);
    this.render();
  }

  static #editFocus(event, target) {
    const entryId = target.closest("[data-focus-entry]")?.dataset.focusEntry;
    if (entryId) PortraitEditor.open(entryId, CAST_LAYERS.FOCUS, { draft: true });
  }

  static async #toggleFocusMirror(event, target) {
    const entryId = target.closest("[data-focus-entry]")?.dataset.focusEntry;
    const item = Object.values(getPresentation(canvas.scene).focus).find(value => value?.entry?.id === entryId);
    if (!item) return;
    await updateFocusEntry(entryId, { mirrored: !item.entry.mirrored });
    this.render();
  }

  static async #toggleFocusPersistent(event, target) {
    const zone = target.closest("[data-focus-drop]")?.dataset.focusDrop;
    const item = getPresentation(canvas.scene).focus[zone];
    if (!item) return;
    await setFocusPersistent(zone, !item.persistent);
    this.render();
  }

  static #addBackground() {
    const Picker = foundry.applications.apps.FilePicker?.implementation ?? foundry.applications.apps.FilePicker ?? globalThis.FilePicker;
    new Picker({ type: "imagevideo", callback: async path => {
      await addBackgroundVariant({ src: path });
      this.render();
    } }).browse();
  }

  static async #addBackgroundGroup() {
    const group = await addBackgroundGroup();
    this.render();
    requestAnimationFrame(() => this.#beginBackgroundGroupRename(this.element.querySelector(`[data-background-group='${CSS.escape(group.id)}']`)));
  }

  static async #removeBackgroundGroup(event, target) {
    const id = target.closest("[data-background-group]")?.dataset.backgroundGroup;
    await removeBackgroundGroup(id);
    this.#collapsedBackgroundGroups.delete(id);
    this.render();
  }

  static #toggleBackgroundGroup(event, target) {
    const id = target.closest("[data-background-group]")?.dataset.backgroundGroup;
    if (!id) return;
    if (this.#collapsedBackgroundGroups.has(id)) this.#collapsedBackgroundGroups.delete(id);
    else this.#collapsedBackgroundGroups.add(id);
    this.render();
  }

  static #editBackground(event, target) {
    const id = target.closest("[data-background-id]")?.dataset.backgroundId;
    if (id) BackgroundSettings.open(id, () => this.rendered && this.render());
  }

  static async #toggleActiveBackground(event, target) {
    const id = target.closest("[data-background-id]")?.dataset.backgroundId;
    if (!id) return;
    if (getPresentation(canvas.scene).activeBackgroundId === id) await deactivateSceneBackground();
    else await activateSceneBackground(id);
    this.render();
  }

  static async #toggleBackgroundFollowActive() {
    const presentation = getPresentation(canvas.scene, { published: true });
    await setBackgroundFollowActive(!presentation.backgroundFollowActive);
    this.render();
  }

  static async #removeBackground(event, target) {
    const id = target.closest("[data-background-id]")?.dataset.backgroundId;
    if (!id) return;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("RNPS.Background.RemoveConfirmTitle") },
      content: `<p>${game.i18n.localize("RNPS.Background.RemoveConfirmText")}</p>`,
      modal: true
    });
    if (!confirmed) return;
    await removeBackgroundVariant(id);
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
    await withoutPreview(async () => {
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
    });
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
