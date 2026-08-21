import { GROUP_IDS, MODULE_ID } from "../constants.js";
import { getCastEntry, updateCastEntry } from "../data/cast-service.js";
import { preparePortraitView } from "../portraits/portrait-data.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class PortraitEditor extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "rn-portrait-stage-portrait-editor",
    classes: ["rn-portrait-stage-app", "rn-portrait-stage-portrait-editor"],
    tag: "form",
    position: {
      width: 520,
      height: "auto"
    },
    window: {
      icon: "fa-solid fa-image-portrait",
      title: "RNPS.Editor.Title",
      resizable: false,
      contentClasses: ["standard-form"]
    },
    form: {
      closeOnSubmit: true,
      handler: PortraitEditor.#onSubmit
    }
  };

  static PARTS = {
    content: {
      template: `modules/${MODULE_ID}/templates/portrait-editor.hbs`
    }
  };

  #entryId;

  constructor(entryId, options = {}) {
    super(options);
    this.#entryId = entryId;
  }

  static open(entryId) {
    if (!entryId) return null;
    return new this(entryId).render({ force: true });
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const entry = getCastEntry(this.#entryId);
    const view = entry ? await preparePortraitView(entry) : null;
    if (!entry || !view) return { ...context, missing: true };

    return {
      ...context,
      missing: false,
      entry,
      actorName: view.name,
      previewImage: view.image,
      isPcs: entry.groupId === GROUP_IDS.PCS,
      isNpcs: entry.groupId === GROUP_IDS.NPCS,
      isActorImage: entry.image.source === "actor",
      isPrototypeTokenImage: entry.image.source === "prototypeToken",
      isCustomImage: entry.image.source === "custom"
    };
  }

  static async #onSubmit(event, form, formData) {
    const data = formData.object;
    await updateCastEntry(this.#entryId, {
      groupId: data.groupId,
      visible: Boolean(data.visible),
      image: {
        source: data.imageSource,
        customSrc: data.customSrc || null
      }
    });
  }
}
