import { CAST_LAYERS, GROUP_IDS, MODULE_ID } from "../constants.js";
import { createPortraitVariant, setActorLibrary } from "../data/actor-library.js";
import { getCastEntry } from "../data/cast-service.js";
import { getReserveEntry, updateReserveEntry } from "../data/reserve-service.js";
import { requestCastEntryUpdate } from "../data/socket-service.js";
import { preparePortraitView, resolvePortraitImage } from "../portraits/portrait-data.js";
import { createPortraitMedia, isVideoPath } from "../media.js";

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
      removeVariant: PortraitEditor.#removeVariant
    },
    form: { closeOnSubmit: false, handler: PortraitEditor.#onSubmit }
  };

  static PARTS = {
    content: { template: `modules/${MODULE_ID}/templates/portrait-editor.hbs` }
  };

  #entryId;
  #layer;
  #autosaveTimer = null;

  constructor(entryId, layer = CAST_LAYERS.SCENE, options = {}) {
    super(options);
    this.#entryId = entryId;
    this.#layer = Object.values(CAST_LAYERS).includes(layer) ? layer : CAST_LAYERS.SCENE;
  }

  static open(entryId, layer) {
    if (!entryId) return null;
    return new this(entryId, layer).render({ force: true });
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const entry = this.#layer === CAST_LAYERS.RESERVE
      ? getReserveEntry(this.#entryId)
      : getCastEntry(this.#entryId, { layer: this.#layer });
    const view = entry ? await preparePortraitView(entry) : null;
    if (!entry || !view) return { ...context, missing: true };
    const library = view.library;
    const variants = library.variants.map(variant => {
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
      selected: variant.id === (entry.activeVariantId ?? library.defaultVariantId),
      isDefault: variant.id === library.defaultVariantId
    }});
    return {
      ...context,
      missing: false,
      entry,
      actorName: view.actorName,
      previewImage: view.image,
      previewIsVideo: view.isVideo,
      variants,
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
      new MutationObserver(() => {
        this.#refreshVariantPreview(picker.closest("[data-variant-tile]"));
        this.#scheduleAutosave(0);
      }).observe(picker, { attributes: true, attributeFilter: ["value"] });
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
      (image ?? tile.querySelector(".rnps-variant-placeholder"))?.replaceWith(replacement);
      image = replacement;
    } else image.src = path;
    if (tile.classList.contains("active")) {
      const preview = this.element.querySelector(".rnps-editor-preview img, .rnps-editor-preview video");
      if (preview) {
        const replacement = createPortraitMedia(path);
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
    const list = this.element.querySelector(".rnps-variant-grid");
    if (!template || !list) return;
    const fragment = template.content.cloneNode(true);
    const tile = fragment.querySelector("[data-variant-tile]");
    const id = foundry.utils.randomID();
    tile.dataset.variantId = id;
    tile.querySelector("[name='variantId']").value = id;
    list.append(fragment);
    this.#scheduleAutosave(0);
  }

  static #activateVariant(event, target) {
    const tile = target.closest("[data-variant-tile]");
    const activeInput = this.element.querySelector("[name='activeVariantId']");
    if (!tile || !activeInput || target.disabled) return;
    activeInput.value = tile.dataset.variantId;
    for (const item of this.element.querySelectorAll("[data-variant-tile]")) {
      item.classList.toggle("active", item === tile);
    }
    const source = readTileValue(tile, "variantSource");
    const path = readTileValue(tile, "variantPath");
    const preview = this.element.querySelector(".rnps-editor-preview img");
    if (preview) preview.src = resolveDraftImage(source, path, preview.src, tile);
    this.#scheduleAutosave(0);
  }

  static #removeVariant(event, target) {
    const tile = target.closest("[data-variant-tile]");
    const activeInput = this.element.querySelector("[name='activeVariantId']");
    if (tile?.dataset.variantId === activeInput?.value) activeInput.value = "actor";
    tile?.remove();
    this.#scheduleAutosave(0);
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
    const variants = [...form.querySelectorAll("[data-variant-tile]")].map(tile => {
      const id = readTileValue(tile, "variantId");
      const previous = oldById.get(id);
      return {
        ...createPortraitVariant({
          id,
          name: readTileValue(tile, "variantName") || "Variant",
          source: readTileValue(tile, "variantSource") || "custom",
          customSrc: readTileValue(tile, "variantPath") || null
        }),
        hover: previous?.hover ?? {},
        effects: previous?.effects ?? [],
        flags: previous?.flags ?? {}
      };
    });
    if (!variants.length) variants.push(createPortraitVariant({ id: "actor", name: "Actor portrait", source: "actor" }));

    const requestedActive = String(values.get("activeVariantId") || "");
    const activeVariantId = variants.some(variant => variant.id === requestedActive)
      ? requestedActive
      : variants[0].id;
    await setActorLibrary(view.actor, {
      schemaVersion: 1,
      label: {
        mode: String(values.get("labelMode") || "actor"),
        custom: String(values.get("customLabel") || "")
      },
      variants,
      defaultVariantId: variants.some(variant => variant.id === existing.defaultVariantId)
        ? existing.defaultVariantId
        : "actor"
    });
    const entryChanges = {
      activeVariantId
    };
    if (app.#layer === CAST_LAYERS.RESERVE) {
      await updateReserveEntry(app.#entryId, entryChanges);
    } else {
      await requestCastEntryUpdate(app.#entryId, entryChanges, {
        layer: app.#layer,
        actor: view.actor
      });
    }
  }
}

function readTileValue(tile, name) {
  const field = tile.querySelector(`[name='${name}']`);
  if (!field) return "";
  if (typeof field.value === "string" && field.value.trim()) return field.value.trim();
  const attribute = field.getAttribute?.("value");
  if (typeof attribute === "string" && attribute.trim()) return attribute.trim();
  const nested = field.shadowRoot?.querySelector("input") ?? field.querySelector?.("input");
  return typeof nested?.value === "string" ? nested.value.trim() : "";
}

function resolveDraftImage(source, path, fallback, tile) {
  if (source === "custom") return path || fallback;
  return tile.querySelector("img")?.src || fallback;
}

function createEmptyVariantPlaceholder() {
  const placeholder = document.createElement("div");
  placeholder.className = "rnps-variant-placeholder";
  const label = game.i18n.localize("RNPS.Editor.ImageNotSelected");
  placeholder.dataset.tooltip = label;
  placeholder.innerHTML = `<i class="fa-solid fa-image" aria-hidden="true"></i><span>${label}</span>`;
  return placeholder;
}
