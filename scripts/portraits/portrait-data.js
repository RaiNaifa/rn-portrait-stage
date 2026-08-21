import { FLAGS, MODULE_ID } from "../constants.js";
import { getActorLibrary, getActorVariant } from "../data/actor-library.js";
import { isVideoPath } from "../media.js";

export async function preparePortraitView(entry) {
  const actor = await fromUuid(entry.actorUuid);
  if (actor?.documentName !== "Actor") return null;

  const library = getActorLibrary(actor);
  if (!actor.getFlag(MODULE_ID, FLAGS.ACTOR_LIBRARY) && entry.image) {
    if (entry.image.source === "custom" && entry.image.customSrc) {
      library.variants.push({
        id: "legacy-custom",
        name: "Custom portrait",
        image: { ...entry.image },
        hover: {},
        effects: [],
        flags: {}
      });
      library.defaultVariantId = "legacy-custom";
    } else if (entry.image.source === "prototypeToken") {
      library.defaultVariantId = "prototypeToken";
    }
  }
  const globalVariant = library.variants.find(item => item.id === entry.activeVariantId)
    ?? library.variants.find(item => item.id === library.defaultVariantId)
    ?? library.variants[0];
  const resolvedVariantId = entry.userVariants?.[game.user.id] ?? globalVariant.id;
  const variant = library.variants.find(item => item.id === resolvedVariantId)
    ?? library.variants.find(item => item.id === library.defaultVariantId)
    ?? library.variants[0];
  const label = resolvePortraitLabel(entry, actor, library, variant);
  const portraitImage = resolvePortraitImage(entry, actor, variant);
  const divergentAssignments = Object.entries(entry.userVariants ?? {}).filter(([userId, variantId]) => (
    variantId !== globalVariant.id
    && game.users.get(userId)
    && library.variants.some(item => item.id === variantId)
  ));
  const personalizedSummary = divergentAssignments.map(([userId, variantId]) => {
    const user = game.users.get(userId);
    const assigned = library.variants.find(item => item.id === variantId);
    return user && assigned ? `${user.name} — ${assigned.name}` : null;
  }).filter(Boolean).join("\n");
  const assignmentGroups = new Map();
  for (const [userId, variantId] of divergentAssignments) {
    const assigned = library.variants.find(item => item.id === variantId);
    const user = game.users.get(userId);
    if (!assigned || !user) continue;
    const group = assignmentGroups.get(variantId) ?? {
      id: variantId,
      name: assigned.name,
      image: resolvePortraitImage(entry, actor, assigned),
      users: []
    };
    group.users.push(user.name);
    assignmentGroups.set(variantId, group);
  }
  const personalizedVariants = [...assignmentGroups.values()].map(group => ({
    ...group,
    count: group.users.length,
    isVideo: isVideoPath(group.image),
    tooltip: `${group.name}: ${group.users.join(", ")}`
  }));
  return {
    entry,
    actor,
    id: entry.id,
    actorUuid: actor.uuid,
    name: label ?? actor.name,
    actorName: actor.name,
    label,
    variant,
    library,
    resolvedVariantId: variant.id,
    personalized: Boolean(entry.userVariants?.[game.user.id]),
    personalizedUsers: divergentAssignments.length,
    personalizedSummary,
    personalizedVariants,
    image: portraitImage,
    isVideo: isVideoPath(portraitImage),
    visible: entry.visible,
    isOwner: actor.isOwner,
    canOpenSheet: actor.testUserPermission(game.user, "LIMITED")
  };
}

export function resolvePortraitImage(entry, actor, variant = getActorVariant(actor, entry.activeVariantId)) {
  const image = variant?.image ?? entry.image;
  switch (image?.source) {
    case "prototypeToken":
      return actor.prototypeToken?.texture?.src || actor.img;
    case "custom":
      return image?.customSrc || actor.img;
    case "actor":
    default:
      return actor.img || actor.prototypeToken?.texture?.src || CONST.DEFAULT_TOKEN;
  }
}

export function resolvePortraitLabel(entry, actor, library = getActorLibrary(actor), variant = null) {
  if (typeof entry.labelOverride === "string") return entry.labelOverride || null;
  const override = variant?.settings?.label;
  const label = override?.inherit === false ? override : library.label;
  if (label.mode === "hidden") return null;
  if (label.mode === "custom") return label.custom || actor.name;
  if (label.mode === "prototypeToken") return actor.prototypeToken?.name || actor.name;
  return actor.name;
}
