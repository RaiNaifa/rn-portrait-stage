import { MODULE_ID } from "../constants.js";
import { getCastEntry } from "../data/cast-service.js";
import { requestCastEntryUpdate } from "../data/socket-service.js";
import { preparePortraitView, resolvePortraitImage } from "../portraits/portrait-data.js";
import { isVideoPath } from "../media.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class VariantPicker extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "rn-portrait-stage-variant-picker",
    classes: ["rn-portrait-stage-app", "rn-portrait-stage-variant-picker"],
    position: { width: 560, height: "auto" },
    window: { icon: "fa-solid fa-images", title: "RNPS.VariantPicker.Title", resizable: true },
    actions: { activate: VariantPicker.#activate }
  };

  static PARTS = {
    content: { template: `modules/${MODULE_ID}/templates/variant-picker.hbs` }
  };

  #entryId;
  #layer;

  constructor(entryId, layer, options = {}) {
    super(options);
    this.#entryId = entryId;
    this.#layer = layer;
  }

  static open(entryId, layer) {
    return new this(entryId, layer).render({ force: true });
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const entry = getCastEntry(this.#entryId, { layer: this.#layer });
    const view = entry ? await preparePortraitView(entry) : null;
    if (!view) return { ...context, missing: true };
    return {
      ...context,
      missing: false,
      variants: view.library.variants.map(variant => {
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
        previewImage,
        hasImage,
        isVideo: isVideoPath(previewImage),
        active: variant.id === (entry.activeVariantId ?? view.library.defaultVariantId)
      }})
    };
  }

  static async #activate(event, target) {
    if (target.disabled) return;
    const variantId = target.closest("[data-variant-id]")?.dataset.variantId;
    const entry = getCastEntry(this.#entryId, { layer: this.#layer });
    const view = entry ? await preparePortraitView(entry) : null;
    if (!variantId || !view) return;
    await requestCastEntryUpdate(this.#entryId, { activeVariantId: variantId }, {
      layer: this.#layer,
      actor: view.actor
    });
    for (const tile of this.element.querySelectorAll("[data-variant-id]")) {
      tile.classList.toggle("active", tile.dataset.variantId === variantId);
    }
  }
}
