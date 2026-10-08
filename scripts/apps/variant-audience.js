import { CAST_LAYERS, MODULE_ID } from "../constants.js";
import { getCastEntry } from "../data/cast-service.js";
import { getReserveEntry, updateReserveEntry } from "../data/reserve-service.js";
import { requestCastEntryUpdate } from "../data/socket-service.js";
import { preparePortraitView } from "../portraits/portrait-data.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class VariantAudience extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "rn-portrait-stage-variant-audience",
    classes: ["rn-portrait-stage-app", "rnps-variant-audience"],
    tag: "form",
    position: { width: 430, height: "auto" },
    window: { icon: "fa-solid fa-users", title: "RNPS.VariantAudience.Title", resizable: true },
    actions: {
      apply: VariantAudience.#apply,
      clear: VariantAudience.#clear
    }
  };

  static PARTS = {
    content: { template: `modules/${MODULE_ID}/templates/variant-audience.hbs` }
  };

  #entryId;
  #layer;
  #variantId;

  constructor(entryId, layer, variantId, options = {}) {
    super(options);
    this.#entryId = entryId;
    this.#layer = layer;
    this.#variantId = variantId;
  }

  static open(entryId, layer, variantId) {
    if (!game.user.isGM) return null;
    return new this(entryId, layer, variantId).render({ force: true });
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const entry = this.#layer === CAST_LAYERS.RESERVE
      ? getReserveEntry(this.#entryId)
      : getCastEntry(this.#entryId, { layer: this.#layer });
    const view = entry ? await preparePortraitView(entry) : null;
    const variant = view?.library.variants.find(item => item.id === this.#variantId);
    if (!entry || !view || !variant) return { ...context, missing: true };
    return {
      ...context,
      missing: false,
      variantName: variant.name,
      users: game.users.filter(user => !user.isGM).map(user => ({
        id: user.id,
        name: user.name,
        selected: entry.userVariants?.[user.id] === variant.id,
        assignedVariant: entry.userVariants?.[user.id]
      }))
    };
  }

  static async #apply() {
    await this.#save(false);
  }

  static async #clear() {
    await this.#save(true);
  }

  async #save(clearAll) {
    const entry = this.#layer === CAST_LAYERS.RESERVE
      ? getReserveEntry(this.#entryId)
      : getCastEntry(this.#entryId, { layer: this.#layer });
    if (!entry) return;
    const userVariants = clearAll ? {} : { ...(entry.userVariants ?? {}) };
    if (!clearAll) {
      const selected = new Set(new FormData(this.element).getAll("userIds").map(String));
      for (const user of game.users.filter(item => !item.isGM)) {
        if (selected.has(user.id)) userVariants[user.id] = this.#variantId;
        else if (userVariants[user.id] === this.#variantId) delete userVariants[user.id];
      }
    }
    if (this.#layer === CAST_LAYERS.RESERVE) {
      await updateReserveEntry(this.#entryId, { userVariants });
    } else {
      const view = await preparePortraitView(entry);
      await requestCastEntryUpdate(this.#entryId, { userVariants }, {
        layer: this.#layer,
        actor: view.actor
      });
    }
    this.render();
  }
}
