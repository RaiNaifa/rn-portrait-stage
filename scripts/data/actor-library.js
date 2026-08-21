import { ACTOR_LIBRARY_SCHEMA_VERSION, FLAGS, MODULE_ID } from "../constants.js";

const IMAGE_SOURCES = new Set(["actor", "prototypeToken", "custom"]);

export function createDefaultActorLibrary(actor = null) {
  return {
    schemaVersion: ACTOR_LIBRARY_SCHEMA_VERSION,
    label: { mode: "actor", custom: "" },
    variants: [
      createPortraitVariant({ id: "actor", name: "Actor portrait", source: "actor" }),
      createPortraitVariant({ id: "prototypeToken", name: "Actor token", source: "prototypeToken" })
    ],
    defaultVariantId: "actor"
  };
}

export function createPortraitVariant({
  id = foundry.utils.randomID(),
  name = "Variant",
  source = "custom",
  customSrc = null
} = {}) {
  return {
    id: String(id || foundry.utils.randomID()),
    name: String(name || "Variant"),
    image: {
      source: IMAGE_SOURCES.has(source) ? source : "custom",
      customSrc: typeof customSrc === "string" && customSrc ? customSrc : null
    },
    hover: {},
    effects: [],
    flags: {}
  };
}

export function normalizeActorLibrary(source, actor = null) {
  const fallback = createDefaultActorLibrary(actor);
  if (!source || typeof source !== "object") return fallback;
  const variants = Array.isArray(source.variants)
    ? source.variants.map(normalizeVariant).filter(Boolean)
    : [];
  const customVariants = variants.filter(variant => !["actor", "prototypeToken"].includes(variant.id));
  variants.splice(0, variants.length, ...fallback.variants, ...customVariants);
  const defaultVariantId = variants.some(variant => variant.id === source.defaultVariantId)
    ? source.defaultVariantId
    : variants[0].id;
  return {
    schemaVersion: ACTOR_LIBRARY_SCHEMA_VERSION,
    label: {
      mode: ["actor", "prototypeToken", "custom", "hidden"].includes(source.label?.mode)
        ? source.label.mode
        : "actor",
      custom: typeof source.label?.custom === "string" ? source.label.custom : ""
    },
    variants,
    defaultVariantId
  };
}

export function getActorLibrary(actor) {
  return normalizeActorLibrary(actor?.getFlag(MODULE_ID, FLAGS.ACTOR_LIBRARY), actor);
}

export async function setActorLibrary(actor, library) {
  if (!actor?.isOwner && !game.user?.isGM) {
    throw new Error(game.i18n.localize("RNPS.Notifications.ActorPermission"));
  }
  const normalized = normalizeActorLibrary(library, actor);
  await actor.setFlag(MODULE_ID, FLAGS.ACTOR_LIBRARY, normalized);
  return normalized;
}

export function getActorVariant(actor, variantId = null) {
  const library = getActorLibrary(actor);
  return library.variants.find(variant => variant.id === variantId)
    ?? library.variants.find(variant => variant.id === library.defaultVariantId)
    ?? library.variants[0];
}

function normalizeVariant(source) {
  if (!source || typeof source !== "object") return null;
  const variant = createPortraitVariant({
    id: source.id,
    name: source.name,
    source: source.image?.source,
    customSrc: source.image?.customSrc
  });
  variant.hover = isPlainObject(source.hover) ? { ...source.hover } : {};
  variant.effects = Array.isArray(source.effects) ? [...source.effects] : [];
  variant.flags = isPlainObject(source.flags) ? { ...source.flags } : {};
  return variant;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
