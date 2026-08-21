import { CAST_LAYERS, MODULE_ID, SETTING_KEYS } from "../constants.js";
import {
  canUserAccessVariant,
  getActorLibrary,
  normalizeAccess,
  normalizeVariantSettings,
  updateActorVariant
} from "../data/actor-library.js";
import { getCastEntry } from "../data/cast-service.js";
import { getReserveEntry } from "../data/reserve-service.js";
import { preparePortraitView, resolvePortraitImage } from "../portraits/portrait-data.js";
import { isVideoPath } from "../media.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class VariantSettings extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "rn-portrait-stage-variant-settings",
    classes: ["rn-portrait-stage-app", "rnps-variant-settings"],
    tag: "form",
    position: { width: 700, height: 760 },
    window: {
      icon: "fa-solid fa-sliders",
      title: "RNPS.VariantSettings.Title",
      resizable: true,
      contentClasses: ["standard-form"]
    },
    form: { closeOnSubmit: false, handler: VariantSettings.#submit }
  };

  static PARTS = {
    content: { template: `modules/${MODULE_ID}/templates/variant-settings.hbs` }
  };

  #entryId;
  #layer;
  #variantId;
  #timer;

  constructor(entryId, layer, variantId, options = {}) {
    super(options);
    this.#entryId = entryId;
    this.#layer = layer;
    this.#variantId = variantId;
  }

  static open(entryId, layer, variantId) {
    return new this(entryId, layer, variantId).render({ force: true });
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const entry = this.#layer === CAST_LAYERS.RESERVE
      ? getReserveEntry(this.#entryId)
      : getCastEntry(this.#entryId, { layer: this.#layer });
    const view = entry ? await preparePortraitView(entry) : null;
    const variant = view?.library.variants.find(item => item.id === this.#variantId);
    const canConfigure = game.user.isGM || (
      view?.actor.testUserPermission(game.user, "OWNER")
      && game.settings.get(MODULE_ID, SETTING_KEYS.ALLOW_OWNER_VARIANT_CONFIGURATION)
      && canUserAccessVariant(variant, view.actor)
    );
    if (!entry || !view || !variant || !canConfigure) return { ...context, missing: true };
    const settings = normalizeVariantSettings(variant.settings);
    const access = normalizeAccess(variant.access);
    const image = resolvePortraitImage(entry, view.actor, variant);
    const fonts = Object.keys(CONFIG.fontDefinitions ?? {}).sort().map(name => ({
      value: name,
      label: name,
      selected: settings.label.fontFamily === name
    }));
    const users = game.users.filter(user => !user.isGM).map(user => ({
      id: user.id,
      name: user.name,
      selected: access.userIds.includes(user.id)
    }));
    return {
      ...context,
      missing: false,
      actorName: view.actorName,
      variantName: variant.name,
      image,
      isVideo: isVideoPath(image),
      settings,
      variant,
      access,
      fonts,
      users,
      isGM: game.user.isGM,
      accessGm: access.mode === "gm",
      accessOwners: access.mode === "owners",
      accessSelected: access.mode === "selected",
      accessEveryone: access.mode === "everyone",
      labelActor: settings.label.mode === "actor",
      labelToken: settings.label.mode === "prototypeToken",
      labelCustom: settings.label.mode === "custom",
      labelHidden: settings.label.mode === "hidden",
      fitContain: settings.media.fit === "contain",
      fitCover: settings.media.fit === "cover",
      enterNone: settings.transition.enter === "none",
      enterFade: settings.transition.enter === "fade",
      enterSlide: settings.transition.enter === "slide",
      enterScale: settings.transition.enter === "scale",
      alignLeft: settings.label.align === "left",
      alignCenter: settings.label.align === "center",
      alignRight: settings.label.align === "right",
      gmMacrosText: (variant.gm?.macros ?? []).join("\n"),
      gmScriptsText: (variant.gm?.scripts ?? []).join("\n")
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.#syncConditionalFields();
    this.element.addEventListener("change", () => {
      this.#syncConditionalFields();
      this.#schedule(0);
    });
    this.element.addEventListener("input", () => this.#schedule(250));
  }

  #syncConditionalFields() {
    const inherit = this.element.querySelector("[name='labelInherit']")?.checked;
    const labelFields = this.element.querySelector("[data-label-overrides]");
    if (labelFields) labelFields.hidden = inherit;
    const custom = this.element.querySelector("[data-variant-custom-label]");
    if (custom) custom.hidden = inherit || this.element.querySelector("[name='labelMode']")?.value !== "custom";
    const selectedUsers = this.element.querySelector("[data-access-users]");
    if (selectedUsers) selectedUsers.hidden = this.element.querySelector("[name='accessMode']")?.value !== "selected";
  }

  #schedule(delay) {
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => VariantSettings.#persist(this, this.element).catch(error => {
      ui.notifications.error(error.message);
    }), delay);
  }

  static #submit(event, form) {
    return VariantSettings.#persist(this, form);
  }

  static async #persist(app, form) {
    const entry = app.#layer === CAST_LAYERS.RESERVE
      ? getReserveEntry(app.#entryId)
      : getCastEntry(app.#entryId, { layer: app.#layer });
    const view = entry ? await preparePortraitView(entry) : null;
    const variant = view ? getActorLibrary(view.actor).variants.find(item => item.id === app.#variantId) : null;
    if (!view || !variant) return;
    const values = new FormData(form);
    const number = (name, fallback) => {
      const value = Number(values.get(name));
      return Number.isFinite(value) ? value : fallback;
    };
    const settings = normalizeVariantSettings({
      label: {
        inherit: values.get("labelInherit") === "on",
        mode: String(values.get("labelMode") || "actor"),
        custom: String(values.get("labelCustom") || ""),
        fontFamily: String(values.get("labelFontFamily") || "") || null,
        fontSize: number("labelFontSize", null),
        color: String(values.get("labelColor") || "") || null,
        shadowColor: String(values.get("labelShadowColor") || "") || null,
        align: String(values.get("labelAlign") || "center")
      },
      media: {
        fit: String(values.get("mediaFit") || "contain"),
        scale: number("mediaScale", 1),
        offsetX: number("mediaOffsetX", 0),
        offsetY: number("mediaOffsetY", 0),
        mirrored: values.get("mediaMirrored") === "on",
        opacity: number("mediaOpacity", 1),
        playbackRate: number("mediaPlaybackRate", 1)
      },
      transition: {
        enabled: values.get("transitionEnabled") === "on",
        enter: String(values.get("transitionEnter") || "none"),
        exit: String(values.get("transitionExit") || "none"),
        duration: number("transitionDuration", 300),
        delay: number("transitionDelay", 0)
      },
      hover: {
        enabled: values.get("hoverEnabled") === "on",
        image: String(values.get("hoverImage") || "") || null,
        enlarged: values.get("hoverEnlarged") === "on",
        tokenHighlight: values.get("hoverTokenHighlight") === "on"
      },
      effects: variant.settings?.effects ?? []
    });
    const changes = { settings };
    if (game.user.isGM) {
      changes.access = normalizeAccess({
        mode: String(values.get("accessMode") || "owners"),
        userIds: values.getAll("accessUserIds").map(String)
      });
      changes.gm = {
        scripts: splitLines(values.get("gmScripts")),
        macros: splitLines(values.get("gmMacros"))
      };
    }
    await updateActorVariant(view.actor, variant.id, changes);
  }
}

function splitLines(value) {
  return String(value || "").split(/\r?\n/).map(line => line.trim()).filter(Boolean);
}
