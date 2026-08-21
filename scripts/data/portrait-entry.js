import { GROUP_IDS } from "../constants.js";

const IMAGE_SOURCES = new Set(["actor", "prototypeToken", "custom"]);

export function createPortraitEntry(actorUuid, { groupId = GROUP_IDS.PCS, tokenUuid = null } = {}) {
  if (typeof actorUuid !== "string" || !actorUuid.startsWith("Actor.")) {
    throw new TypeError("A world Actor UUID is required.");
  }

  return {
    id: foundry.utils.randomID(),
    actorUuid,
    tokenUuid: typeof tokenUuid === "string" ? tokenUuid : null,
    groupId: normalizeGroupId(groupId),
    sort: 0,
    visible: true,
    image: {
      source: "actor",
      customSrc: null
    },
    hover: {},
    actions: [],
    effects: [],
    activeVariantId: null,
    flags: {}
  };
}

export function normalizePortraitEntry(source, fallbackGroupId = GROUP_IDS.PCS) {
  if (!source || typeof source !== "object") return null;
  if (typeof source.actorUuid !== "string" || !source.actorUuid.startsWith("Actor.")) return null;

  const imageSource = IMAGE_SOURCES.has(source.image?.source) ? source.image.source : "actor";
  return {
    id: typeof source.id === "string" && source.id ? source.id : foundry.utils.randomID(),
    actorUuid: source.actorUuid,
    tokenUuid: typeof source.tokenUuid === "string" ? source.tokenUuid : null,
    groupId: normalizeGroupId(source.groupId ?? fallbackGroupId),
    sort: Number.isFinite(source.sort) ? source.sort : 0,
    visible: source.visible !== false,
    image: {
      source: imageSource,
      customSrc: typeof source.image?.customSrc === "string" && source.image.customSrc
        ? source.image.customSrc
        : null
    },
    hover: isPlainObject(source.hover) ? { ...source.hover } : {},
    actions: Array.isArray(source.actions) ? [...source.actions] : [],
    effects: Array.isArray(source.effects) ? [...source.effects] : [],
    activeVariantId: typeof source.activeVariantId === "string" ? source.activeVariantId : null,
    flags: isPlainObject(source.flags) ? { ...source.flags } : {}
  };
}

export function normalizeGroupId(groupId) {
  return Object.values(GROUP_IDS).includes(groupId) ? groupId : GROUP_IDS.PCS;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
