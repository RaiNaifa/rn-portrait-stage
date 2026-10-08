import { CAST_LAYERS, GROUP_IDS, MODULE_ID, SETTING_KEYS } from "../constants.js";
import { canUserAccessGroup, canUserAccessVariant, createPortraitVariant, setActorLibrary } from "../data/actor-library.js";
import { getCastEntry } from "../data/cast-service.js";
import { getReserveEntry, updateReserveEntry } from "../data/reserve-service.js";
import { requestCastEntryUpdate } from "../data/socket-service.js";
import { preparePortraitView, resolvePortraitImage } from "../portraits/portrait-data.js";
import { createPortraitMedia, isVideoPath } from "../media.js";
import { VariantSettings } from "./variant-settings.js";
import { VariantAudience } from "./variant-audience.js";
import { VariantGroups } from "./variant-groups.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class PortraitEditor extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "rn-portrait-stage-portrait-editor",
    classes: ["rn-portrait-stage-app", "rn-portrait-stage-portrait-editor"],
    tag: "form",
    position: { width: 620, height: 720 },
    window: {
      icon: "fa-solid fa-image-portrait",
      title: "RNPS.Editor.Title",
      resizable: true,
      contentClasses: ["standard-form"]
    },
    actions: {
      addVariant: PortraitEditor.#addVariant,
      activateVariant: PortraitEditor.#activateVariant,
      removeVariant: PortraitEditor.#removeVariant,
      configureVariant: PortraitEditor.#configureVariant,
      assignVariant: PortraitEditor.#assignVariant,
      configureGroups: PortraitEditor.#configureGroups
    },
    form: { closeOnSubmit: false, handler: PortraitEditor.#onSubmit }
  };

  static PARTS = {
    content: { template: `modules/${MODULE_ID}/templates/portrait-editor.hbs` }
  };

  #entryId;
  #layer;
  #draft;
  #autosaveTimer = null;

  constructor(entryId, layer = CAST_LAYERS.SCENE, options = {}) {
    super(options);
    this.#entryId = entryId;
    this.#layer = Object.values(CAST_LAYERS).includes(layer) ? layer : CAST_LAYERS.SCENE;
    this.#draft = options.draft === true;
  }

  static open(entryId, layer, options = {}) {
    if (!entryId) return null;
    return new this(entryId, layer, options).render({ force: true });
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const entry = this.#layer === CAST_LAYERS.RESERVE
      ? getReserveEntry(this.#entryId)
      : getCastEntry(this.#entryId, { layer: this.#layer });
    const view = entry ? await preparePortraitView(entry) : null;
    if (!entry || !view) return { ...context, missing: true };
    const library = view.library;
    const canConfigure = game.user.isGM || (
      view.actor.testUserPermission(game.user, "OWNER")
      && game.settings.get(MODULE_ID, SETTING_KEYS.ALLOW_OWNER_VARIANT_CONFIGURATION)
    );
    const variants = library.variants.filter(variant => canUserAccessVariant(variant, view.actor)).map(variant => {
      const isBuiltin = ["actor", "prototypeToken"].includes(variant.id);
      const hasImage = isBuiltin || Boolean(variant.image?.customSrc);
      const previewImage = hasImage ? resolvePortraitImage(entry, view.actor, variant) : null;
      return {
      ...variant,
      displayName: variant.id === "actor"
        ? game.i18n.localize("RNPS.Editor.ActorImage")
        : variant.id === "prototypeToken"
          ? game.i18n.localize("RNPS.Editor.PrototypeTokenImage")
          : variant.name,
      isBuiltin,
      hasImage,
      previewImage,
      isVideo: isVideoPath(previewImage),
      mirrored: Boolean(entry.mirrored) !== Boolean(variant.settings?.media?.mirrored),
      selected: variant.id === (entry.userVariants?.[game.user.id] ?? entry.activeVariantId ?? library.defaultVariantId),
      isDefault: variant.id === library.defaultVariantId,
      assignedUsers: Object.values(entry.userVariants ?? {}).filter(id => id === variant.id).length
    }});
    const variantGroups = library.groups
      .filter(group => game.user.isGM || canUserAccessGroup(group, view.actor))
      .map(group => ({
      ...group,
      displayName: group.flags?.builtin ? game.i18n.localize("RNPS.VariantGroups.DefaultGroup") : group.name,
      isDefault: group.id === library.defaultGroupId,
      variants: variants.filter(variant => variant.groupId === group.id)
    })).filter(group => group.variants.length || canConfigure);
    return {
      ...context,
      missing: false,
      entry,
      actorName: view.actorName,
      previewImage: view.image,
      previewIsVideo: view.isVideo,
      previewMirrored: view.mirrored,
      variants,
      variantGroups,
      canConfigure,
      isGM: game.user.isGM,
      activeVariantId: entry.activeVariantId ?? library.defaultVariantId,
      isPcs: entry.groupId === GROUP_IDS.PCS,
      isNpcs: entry.groupId === GROUP_IDS.NPCS,
      labelUsesActor: library.label.mode === "actor",
      labelUsesPrototypeToken: library.label.mode === "prototypeToken",
      labelIsCustom: library.label.mode === "custom",
      labelIsHidden: library.label.mode === "hidden",
      customLabel: library.label.custom
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const title = this.element.querySelector(".window-title")
      ?? this.element.closest(".application")?.querySelector(".window-title");
    if (title && context.actorName && !title.querySelector(".rnps-window-actor-name")) {
      const actorName = document.createElement("span");
      actorName.className = "rnps-window-actor-name";
      actorName.textContent = ` — ${context.actorName}`;
      title.append(actorName);
    }
    this.#updateConditionalFields();
    this.element.addEventListener("change", event => {
      this.#updateConditionalFields();
      this.#refreshVariantPreview(event.target.closest?.("[data-variant-tile]"));
      this.#scheduleAutosave(0);
    });
    this.element.addEventListener("input", event => {
      if (event.target.matches("input[type='text']")) this.#scheduleAutosave(250);
    });
    for (const picker of this.element.querySelectorAll("file-picker[name='variantPath']")) {
      const rememberValue = event => {
        const value = filePickerValue(picker, event);
        if (value || event?.target === picker) picker.dataset.rnpsValue = value;
        this.#refreshVariantPreview(picker.closest("[data-variant-tile]"));
        this.#scheduleAutosave(0);
      };
      picker.addEventListener("change", rememberValue);
      picker.addEventListener("input", rememberValue);
      new MutationObserver(() => {
        const value = filePickerValue(picker);
        if (value) picker.dataset.rnpsValue = value;
        this.#refreshVariantPreview(picker.closest("[data-variant-tile]"));
        this.#scheduleAutosave(0);
      }).observe(picker, { attributes: true, attributeFilter: ["value"] });
    }
    if (context.canConfigure) this.#activateVariantSorting();
  }

  #activateVariantSorting() {
    for (const tile of this.element.querySelectorAll("[data-variant-tile]")) {
      if (tile.dataset.sortingBound === "true") continue;
      tile.dataset.sortingBound = "true";
      tile.draggable = true;
      tile.querySelectorAll("img, video").forEach(media => { media.draggable = true; });
      tile.addEventListener("dragstart", event => {
        event.dataTransfer.setData("text/plain", JSON.stringify({
          type: "RNPortraitStageVariant",
          variantId: tile.dataset.variantId
        }));
        event.dataTransfer.effectAllowed = "move";
        tile.classList.add("dragging");
      });
      tile.addEventListener("dragend", () => tile.classList.remove("dragging"));
    }
    for (const grid of this.element.querySelectorAll("[data-variant-group]")) {
      if (grid.dataset.sortingBound === "true") continue;
      grid.dataset.sortingBound = "true";
      grid.addEventListener("dragover", event => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      });
      grid.addEventListener("drop", async event => {
        event.preventDefault();
        let data;
        try { data = JSON.parse(event.dataTransfer.getData("text/plain")); } catch { return; }
        if (data?.type !== "RNPortraitStageVariant") return;
        const tile = this.element.querySelector(`[data-variant-tile][data-variant-id='${CSS.escape(data.variantId)}']`);
        if (!tile) return;
        const target = event.target.closest("[data-variant-tile]");
        if (target && target !== tile && target.parentElement === grid) grid.insertBefore(tile, target);
        else grid.append(tile);
        tile.classList.remove("dragging");
        clearTimeout(this.#autosaveTimer);
        await PortraitEditor.#persist(this, this.element);
      });
    }
  }

  #refreshVariantPreview(tile) {
    if (!tile || readTileValue(tile, "variantSource") !== "custom") return;
    const path = readTileValue(tile, "variantPath");
    let image = tile.querySelector(":scope > img, :scope > video");
    const activate = tile.querySelector("[data-action='activateVariant']");
    if (!path) {
      image?.replaceWith(createEmptyVariantPlaceholder());
      if (activate) activate.disabled = true;
      return;
    }
    if (activate) activate.disabled = false;
    const needsVideo = isVideoPath(path);
    if (!image || (image instanceof HTMLVideoElement) !== needsVideo) {
      const replacement = createPortraitMedia(path);
      replacement.classList.toggle("mirrored", tile.dataset.mirrored === "true");
      (image ?? tile.querySelector(".rnps-variant-placeholder"))?.replaceWith(replacement);
      image = replacement;
    } else image.src = path;
    if (tile.classList.contains("active")) {
      const preview = this.element.querySelector(".rnps-editor-preview img, .rnps-editor-preview video");
      if (preview) {
        const replacement = createPortraitMedia(path);
        replacement.classList.toggle("mirrored", tile.dataset.mirrored === "true");
        preview.replaceWith(replacement);
      }
    }
  }

  #updateConditionalFields() {
    const custom = this.element.querySelector("[data-custom-label-field]");
    const mode = this.element.querySelector("[name='labelMode']")?.value;
    if (custom) custom.hidden = mode !== "custom";
  }

  #scheduleAutosave(delay = 150) {
    clearTimeout(this.#autosaveTimer);
    this.#autosaveTimer = setTimeout(() => {
      PortraitEditor.#persist(this, this.element).catch(error => {
        ui.notifications.error(error.message);
      });
    }, delay);
  }

  static #addVariant() {
    const template = this.element.querySelector("#rnps-new-variant-template");
    const list = this.element.querySelector("[data-variant-group][data-default-group='true']")
      ?? this.element.querySelector("[data-variant-group]");
    if (!template || !list) return;
    const fragment = template.content.cloneNode(true);
    const tile = fragment.querySelector("[data-variant-tile]");
    const id = foundry.utils.randomID();
    tile.dataset.variantId = id;
    tile.querySelector("[name='variantId']").value = id;
    list.append(fragment);
    this.#activateVariantSorting();
    this.#scheduleAutosave(0);
  }

  static async #activateVariant(event, target) {
    const tile = target.closest("[data-variant-tile]");
    const activeInput = this.element.querySelector("[name='activeVariantId']");
    if (!tile || !activeInput || target.disabled) return;
    activeInput.value = tile.dataset.variantId;
    for (const item of this.element.querySelectorAll("[data-variant-tile]")) {
      item.classList.toggle("active", item === tile);
    }
    const source = readTileValue(tile, "variantSource");
    const path = readTileValue(tile, "variantPath");
    const preview = this.element.querySelector(".rnps-editor-preview img, .rnps-editor-preview video");
    const tileMedia = tile.querySelector(":scope > img, :scope > video");
    const draftImage = source === "custom" ? path : tileMedia?.getAttribute("src");
    if (preview && draftImage) {
      const replacement = createPortraitMedia(draftImage);
      replacement.classList.toggle("mirrored", tile.dataset.mirrored === "true");
      preview.replaceWith(replacement);
    }
    if (this.#layer === CAST_LAYERS.RESERVE) {
      await updateReserveEntry(this.#entryId, { activeVariantId: tile.dataset.variantId });
    }
    this.#scheduleAutosave(0);
  }

  static #removeVariant(event, target) {
    const tile = target.closest("[data-variant-tile]");
    const activeInput = this.element.querySelector("[name='activeVariantId']");
    if (tile?.dataset.variantId === activeInput?.value) activeInput.value = "actor";
    tile?.remove();
    this.#scheduleAutosave(0);
  }

  static #configureVariant(event, target) {
    const variantId = target.closest("[data-variant-tile]")?.dataset.variantId;
    if (variantId) VariantSettings.open(this.#entryId, this.#layer, variantId);
  }

  static #assignVariant(event, target) {
    const variantId = target.closest("[data-variant-tile]")?.dataset.variantId;
    if (variantId && game.user.isGM) VariantAudience.open(this.#entryId, this.#layer, variantId);
  }

  static async #configureGroups() {
    clearTimeout(this.#autosaveTimer);
    await PortraitEditor.#persist(this, this.element);
    const entry = this.#layer === CAST_LAYERS.RESERVE
      ? getReserveEntry(this.#entryId)
      : getCastEntry(this.#entryId, { layer: this.#layer });
    const view = entry ? await preparePortraitView(entry) : null;
    if (view) VariantGroups.open(view.actor, { onChange: () => this.render() });
  }

  static async #onSubmit(event, form) {
    return PortraitEditor.#persist(this, form);
  }

  static async #persist(app, form) {
    const values = new FormData(form);
    const entry = app.#layer === CAST_LAYERS.RESERVE
      ? getReserveEntry(app.#entryId)
      : getCastEntry(app.#entryId, { layer: app.#layer });
    const view = entry ? await preparePortraitView(entry) : null;
    if (!entry || !view) return;
    const existing = view.library;
    const oldById = new Map(existing.variants.map(variant => [variant.id, variant]));
    const editedVariants = [...form.querySelectorAll("[data-variant-tile]")].map(tile => {
      const id = readTileValue(tile, "variantId");
      const previous = oldById.get(id);
      return {
        ...createPortraitVariant({
          id,
          name: readTileValue(tile, "variantName") || "Variant",
          source: readTileValue(tile, "variantSource") || "custom",
          customSrc: readTileValue(tile, "variantPath") || null
        }),
        access: previous?.access,
        settings: previous?.settings,
        gm: previous?.gm,
        flags: previous?.flags ?? {},
        groupId: tile.closest("[data-variant-group]")?.dataset.variantGroup
          ?? previous?.groupId
          ?? existing.defaultGroupId
      };
    });
    const hiddenVariants = game.user.isGM
      ? []
      : existing.variants.filter(variant => !canUserAccessVariant(variant, view.actor));
    const variants = [...editedVariants, ...hiddenVariants];
    if (!variants.length) variants.push(createPortraitVariant({ id: "actor", name: "Actor portrait", source: "actor" }));

    const requestedActive = String(values.get("activeVariantId") || "");
    const activeVariantId = variants.some(variant => variant.id === requestedActive)
      ? requestedActive
      : variants[0].id;
    await setActorLibrary(view.actor, {
      schemaVersion: existing.schemaVersion,
      label: {
        mode: String(values.get("labelMode") || "actor"),
        custom: String(values.get("customLabel") || "")
      },
      groups: existing.groups,
      defaultGroupId: existing.defaultGroupId,
      variants,
      defaultVariantId: variants.some(variant => variant.id === existing.defaultVariantId)
        ? existing.defaultVariantId
        : "actor",
      lastActiveVariantId: variants.some(variant => variant.id === existing.lastActiveVariantId)
        ? existing.lastActiveVariantId
        : activeVariantId
    });
    const entryChanges = {
      activeVariantId,
      userVariants: Object.fromEntries(Object.entries(entry.userVariants ?? {}).filter(([, variantId]) => (
        variants.some(variant => variant.id === variantId)
      )))
    };
    if (app.#layer === CAST_LAYERS.RESERVE) {
      await updateReserveEntry(app.#entryId, entryChanges);
    } else {
      await requestCastEntryUpdate(app.#entryId, entryChanges, {
        layer: app.#layer,
        actor: view.actor,
        draft: app.#draft
      });
    }
  }
}

function readTileValue(tile, name) {
  const field = tile.querySelector(`[name='${name}']`);
  if (!field) return "";
  if (field.localName === "file-picker") return filePickerValue(field);
  if (typeof field.value === "string" && field.value.trim()) return field.value.trim();
  const attribute = field.getAttribute?.("value");
  if (typeof attribute === "string" && attribute.trim()) return attribute.trim();
  const nested = field.shadowRoot?.querySelector("input") ?? field.querySelector?.("input");
  return typeof nested?.value === "string" ? nested.value.trim() : "";
}

function filePickerValue(picker, event) {
  const candidates = [
    event?.detail?.path,
    event?.detail?.value,
    event?.target !== picker ? event?.target?.value : null,
    picker.input?.value,
    picker._input?.value,
    picker.shadowRoot?.querySelector("input")?.value,
    picker.querySelector?.("input")?.value,
    picker.value,
    picker.dataset?.rnpsValue,
    picker.getAttribute?.("value")
  ];
  return String(candidates.find(value => typeof value === "string" && value.trim()) ?? "").trim();
}

function createEmptyVariantPlaceholder() {
  const placeholder = document.createElement("div");
  placeholder.className = "rnps-variant-placeholder";
  const label = game.i18n.localize("RNPS.Editor.ImageNotSelected");
  placeholder.dataset.tooltip = label;
  placeholder.innerHTML = `<i class="fa-solid fa-image" aria-hidden="true"></i><span>${label}</span>`;
  return placeholder;
}
