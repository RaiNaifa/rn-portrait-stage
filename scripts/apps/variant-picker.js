import { MODULE_ID } from "../constants.js";
import { canUserAccessVariant } from "../data/actor-library.js";
import { getCastEntry } from "../data/cast-service.js";
import { requestCastEntryUpdate } from "../data/socket-service.js";
import { preparePortraitView, resolvePortraitImage } from "../portraits/portrait-data.js";
import { isVideoPath } from "../media.js";
import { VariantAudience } from "./variant-audience.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class VariantPicker extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "rn-portrait-stage-variant-picker",
    classes: ["rn-portrait-stage-app", "rn-portrait-stage-variant-picker"],
    position: { width: 560, height: "auto" },
    window: { icon: "fa-solid fa-images", title: "RNPS.VariantPicker.Title", resizable: true },
    actions: { activate: VariantPicker.#activate, assign: VariantPicker.#assign }
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
    const available = view.library.variants.filter(variant => canUserAccessVariant(variant, view.actor));
    const groups = view.library.groups.map(group => ({
      ...group,
      name: group.flags?.builtin ? game.i18n.localize("RNPS.VariantGroups.DefaultGroup") : group.name,
      variants: available.filter(variant => variant.groupId === group.id).map(variant => {
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
          mirrored: Boolean(entry.mirrored) !== Boolean(variant.settings?.media?.mirrored),
          active: variant.id === (entry.userVariants?.[game.user.id] ?? entry.activeVariantId ?? view.library.defaultVariantId),
          assignedUsers: Object.values(entry.userVariants ?? {}).filter(id => id === variant.id).length
        };
      }),
      open: group.id === view.library.defaultGroupId
        || available.some(variant => variant.groupId === group.id && variant.id === (entry.userVariants?.[game.user.id] ?? entry.activeVariantId))
    })).filter(group => group.variants.length);
    if (groups.length && !groups.some(group => group.open)) groups[0].open = true;
    return {
      ...context,
      missing: false,
      isGM: game.user.isGM,
      groups
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
    const displayedVariantId = entry.userVariants?.[game.user.id] ?? variantId;
    for (const tile of this.element.querySelectorAll("[data-variant-id]")) {
      tile.classList.toggle("active", tile.dataset.variantId === displayedVariantId);
    }
  }

  static #assign(event, target) {
    const variantId = target.closest("[data-variant-id]")?.dataset.variantId;
    if (variantId && game.user.isGM) VariantAudience.open(this.#entryId, this.#layer, variantId);
  }
}
