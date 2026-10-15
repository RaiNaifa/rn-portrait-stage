import { MODULE_ID } from "../constants.js";
import { findBackground, updateBackgroundVariant } from "../data/background-library.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class BackgroundSettings extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: ["rn-portrait-stage-app", "rnps-background-settings"],
    tag: "section",
    position: { width: 560, height: 650 },
    window: {
      icon: "fa-solid fa-image",
      title: "RNPS.Background.Settings",
      resizable: true,
      contentClasses: ["standard-form"]
    },
    actions: {
      cover: BackgroundSettings.#cover,
      contain: BackgroundSettings.#contain
    }
  };

  static PARTS = {
    content: { template: `modules/${MODULE_ID}/templates/background-settings.hbs` }
  };

  static #instances = new Map();
  #backgroundId;
  #onChange;

  constructor(backgroundId, onChange) {
    super({ id: `rnps-background-settings-${backgroundId}` });
    this.#backgroundId = backgroundId;
    this.#onChange = onChange;
  }

  static open(backgroundId, onChange) {
    const existing = this.#instances.get(backgroundId);
    if (existing?.rendered) {
      existing.bringToFront?.();
      return existing;
    }
    const app = new this(backgroundId, onChange);
    this.#instances.set(backgroundId, app);
    app.render({ force: true });
    return app;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item = findBackground(this.#backgroundId);
    return {
      ...context,
      missing: !item,
      background: item,
      isVideo: /\.(?:webm|mp4|m4v|ogv|ogg)(?:[?#]|$)/i.test(item?.src ?? ""),
      fitCover: item?.fit === "cover"
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    for (const input of this.element.querySelectorAll("[data-background-field]")) {
      input.addEventListener("change", async event => {
        const field = event.currentTarget.dataset.backgroundField;
        const value = event.currentTarget.type === "number" ? Number(event.currentTarget.value) : event.currentTarget.value.trim();
        if (field === "src" && !value) return this.render();
        await this.#update({ [field]: value });
      });
    }
    this.element.querySelector("[data-background-browse]")?.addEventListener("click", () => {
      const Picker = foundry.applications.apps.FilePicker?.implementation ?? foundry.applications.apps.FilePicker ?? globalThis.FilePicker;
      new Picker({ type: "imagevideo", callback: path => this.#update({ src: path }) }).browse();
    });
  }

  async #update(changes) {
    await updateBackgroundVariant(this.#backgroundId, changes);
    this.#onChange?.();
    this.render();
  }

  static async #cover() { await this.#update({ fit: "cover" }); }
  static async #contain() { await this.#update({ fit: "contain" }); }
}
