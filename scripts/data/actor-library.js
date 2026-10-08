import { ACTOR_LIBRARY_SCHEMA_VERSION, FLAGS, MODULE_ID, SETTING_KEYS } from "../constants.js";

const IMAGE_SOURCES = new Set(["actor", "prototypeToken", "custom"]);

export function createDefaultActorLibrary(actor = null) {
  return {
    schemaVersion: ACTOR_LIBRARY_SCHEMA_VERSION,
    label: { mode: "actor", custom: "" },
    groups: [{ id: "default", name: "Default", access: { mode: "everyone", userIds: [] }, flags: { builtin: true } }],
    defaultGroupId: "default",
    variants: [
      createPortraitVariant({ id: "actor", name: "Actor portrait", source: "actor" }),
      createPortraitVariant({ id: "prototypeToken", name: "Actor token", source: "prototypeToken" })
    ],
    defaultVariantId: "actor",
    lastActiveVariantId: "actor"
  };
}

export function createPortraitVariant({
  id = foundry.utils.randomID(),
  name = "Variant",
  source = "custom",
  customSrc = null,
  groupId = "default"
} = {}) {
  return {
    id: String(id || foundry.utils.randomID()),
    name: String(name || "Variant"),
    groupId: String(groupId || "default"),
    image: {
      source: IMAGE_SOURCES.has(source) ? source : "custom",
      customSrc: typeof customSrc === "string" && customSrc ? customSrc : null
    },
    access: { mode: "owners", userIds: [] },
    settings: createDefaultVariantSettings(),
    gm: { scripts: [], macros: [] },
    flags: {}
  };
}

export function createDefaultVariantSettings() {
  return {
    label: {
      inherit: true,
      mode: "actor",
      custom: "",
      fontFamily: null,
      fontSize: null,
      color: null,
      shadowColor: null,
      align: "center"
    },
    media: {
      fit: "contain",
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      mirrored: false,
      opacity: 1,
      playbackRate: 1
    },
    transition: { enabled: false, enter: "none", exit: "none", duration: 300, delay: 0 },
    hover: {
      enabled: true,
      source: "inherit",
      customSrc: null,
      scale: 1,
      mirrored: false
    },
    speaking: {
      image: { source: "inherit", customSrc: null },
      scale: 1,
      mirrored: null,
      effects: []
    },
    effects: []
  };
}

export function normalizeActorLibrary(source, actor = null) {
  const fallback = createDefaultActorLibrary(actor);
  if (!source || typeof source !== "object") return fallback;
  const groups = normalizeGroups(source.groups);
  const defaultGroupId = groups.some(group => group.id === source.defaultGroupId)
    ? source.defaultGroupId
    : groups[0].id;
  const variants = Array.isArray(source.variants)
    ? source.variants.map(normalizeVariant).filter(Boolean)
    : [];
  const builtinVariants = fallback.variants.map(builtin => {
    const existing = variants.find(variant => variant.id === builtin.id);
    return existing ? {
      ...existing,
      id: builtin.id,
      name: builtin.name,
      image: builtin.image
    } : builtin;
  });
  const customVariants = variants.filter(variant => !["actor", "prototypeToken"].includes(variant.id));
  variants.splice(0, variants.length, ...builtinVariants, ...customVariants);
  for (const variant of variants) {
    if (!groups.some(group => group.id === variant.groupId)) variant.groupId = defaultGroupId;
  }
  const defaultVariantId = variants.some(variant => variant.id === source.defaultVariantId)
    ? source.defaultVariantId
    : variants[0].id;
  const lastActiveVariantId = variants.some(variant => variant.id === source.lastActiveVariantId)
    ? source.lastActiveVariantId
    : defaultVariantId;
  return {
    schemaVersion: ACTOR_LIBRARY_SCHEMA_VERSION,
    label: {
      mode: ["actor", "prototypeToken", "custom", "hidden"].includes(source.label?.mode)
        ? source.label.mode
        : "actor",
      custom: typeof source.label?.custom === "string" ? source.label.custom : ""
    },
    groups,
    defaultGroupId,
    variants,
    defaultVariantId,
    lastActiveVariantId
  };
}

export function getActorLibrary(actor) {
  return normalizeActorLibrary(actor?.getFlag(MODULE_ID, FLAGS.ACTOR_LIBRARY), actor);
}

export async function setActorLibrary(actor, library) {
  if (!actor?.isOwner && !game.user?.isGM) {
    throw new Error(game.i18n.localize("RNPS.Notifications.ActorPermission"));
  }
  if (!game.user?.isGM && !game.settings.get(MODULE_ID, SETTING_KEYS.ALLOW_OWNER_VARIANT_CONFIGURATION)) {
    throw new Error(game.i18n.localize("RNPS.Notifications.ActorPermission"));
  }
  const normalized = normalizeActorLibrary(library, actor);
  await actor.setFlag(MODULE_ID, FLAGS.ACTOR_LIBRARY, normalized);
  return normalized;
}

export async function updateActorVariant(actor, variantId, changes) {
  const library = getActorLibrary(actor);
  const index = library.variants.findIndex(variant => variant.id === variantId);
  if (index < 0) throw new Error(`Portrait variant '${variantId}' was not found.`);
  library.variants[index] = normalizeVariant({ ...library.variants[index], ...changes });
  return setActorLibrary(actor, library);
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
    customSrc: source.image?.customSrc,
    groupId: source.groupId
  });
  variant.hover = isPlainObject(source.hover) ? { ...source.hover } : {};
  variant.access = normalizeAccess(source.access);
  variant.settings = normalizeVariantSettings(source.settings ?? {
    hover: source.hover,
    effects: source.effects
  });
  variant.gm = {
    scripts: Array.isArray(source.gm?.scripts) ? [...source.gm.scripts] : [],
    macros: Array.isArray(source.gm?.macros) ? [...source.gm.macros] : []
  };
  variant.flags = isPlainObject(source.flags) ? { ...source.flags } : {};
  return variant;
}

export function normalizeAccess(source) {
  const modes = new Set(["gm", "owners", "selected", "everyone"]);
  return {
    mode: modes.has(source?.mode) ? source.mode : "owners",
    userIds: Array.isArray(source?.userIds)
      ? [...new Set(source.userIds.filter(id => typeof id === "string"))]
      : []
  };
}

export function normalizeVariantSettings(source) {
  const fallback = createDefaultVariantSettings();
  const label = isPlainObject(source?.label) ? source.label : {};
  const media = isPlainObject(source?.media) ? source.media : {};
  const transition = isPlainObject(source?.transition) ? source.transition : {};
  const hover = isPlainObject(source?.hover) ? source.hover : {};
  const speaking = isPlainObject(source?.speaking) ? source.speaking : {};
  const speakingImage = isPlainObject(speaking.image) ? speaking.image : {};
  return {
    label: {
      ...fallback.label,
      ...label,
      inherit: label.inherit !== false,
      mode: ["actor", "prototypeToken", "custom", "hidden"].includes(label.mode) ? label.mode : "actor"
    },
    media: {
      ...fallback.media,
      ...media,
      fit: ["contain", "cover"].includes(media.fit) ? media.fit : "contain"
    },
    transition: { ...fallback.transition, ...transition },
    hover: {
      ...fallback.hover,
      ...hover,
      enabled: hover.enabled !== false,
      source: ["inherit", "actor", "prototypeToken", "custom", "none"].includes(hover.source)
        ? hover.source
        : hover.image
          ? "custom"
          : hover.enlarged === false
            ? "none"
            : "inherit",
      customSrc: typeof hover.customSrc === "string" && hover.customSrc
        ? hover.customSrc
        : typeof hover.image === "string" && hover.image
          ? hover.image
          : null,
      scale: Number.isFinite(hover.scale) ? Math.max(0.1, Math.min(5, hover.scale)) : 1,
      mirrored: hover.mirrored === true
    },
    speaking: {
      image: {
        source: ["inherit", "current", "actor", "prototypeToken", "custom"].includes(speakingImage.source)
          ? speakingImage.source
          : "inherit",
        customSrc: typeof speakingImage.customSrc === "string" && speakingImage.customSrc
          ? speakingImage.customSrc
          : null
      },
      scale: Number.isFinite(speaking.scale) ? Math.max(0.1, Math.min(5, speaking.scale)) : 1,
      mirrored: typeof speaking.mirrored === "boolean" ? speaking.mirrored : null,
      effects: Array.isArray(speaking.effects) ? [...speaking.effects] : []
    },
    effects: Array.isArray(source?.effects) ? [...source.effects] : []
  };
}

export function canUserAccessVariant(variant, actor, user = game.user) {
  if (!variant || !user) return false;
  if (user.isGM) return true;
  const library = typeof actor?.getFlag === "function" ? getActorLibrary(actor) : createDefaultActorLibrary(actor);
  const group = library.groups.find(item => item.id === (variant.groupId ?? library.defaultGroupId));
  if (group && !canUserAccess(group.access, actor, user)) return false;
  const access = normalizeAccess(variant.access);
  return canUserAccess(access, actor, user);
}

export function canUserAccessGroup(group, actor, user = game.user) {
  if (!group || !user) return false;
  if (user.isGM) return true;
  return canUserAccess(normalizeAccess(group.access), actor, user);
}

function canUserAccess(access, actor, user) {
  if (access.mode === "everyone") return true;
  if (access.mode === "selected") return access.userIds.includes(user.id);
  if (access.mode === "owners") return actor?.testUserPermission(user, "OWNER") === true;
  return false;
}

function normalizeGroups(source) {
  const groups = Array.isArray(source) ? source.map(group => {
    if (!group || typeof group !== "object") return null;
    return {
      id: String(group.id || foundry.utils.randomID()),
      name: String(group.name || "Group"),
      access: normalizeAccess(group.access ?? { mode: "everyone" }),
      flags: isPlainObject(group.flags) ? { ...group.flags } : {}
    };
  }).filter(Boolean) : [];
  if (!groups.length) groups.push({
    id: "default",
    name: "Default",
    access: { mode: "everyone", userIds: [] },
    flags: { builtin: true }
  });
  return groups;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
