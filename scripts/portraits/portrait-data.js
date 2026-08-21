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
  const variant = library.variants.find(item => item.id === entry.activeVariantId)
    ?? library.variants.find(item => item.id === library.defaultVariantId)
    ?? library.variants[0];
  const label = resolvePortraitLabel(entry, actor, library);
  const portraitImage = resolvePortraitImage(entry, actor, variant);
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

export function resolvePortraitLabel(entry, actor, library = getActorLibrary(actor)) {
  if (typeof entry.labelOverride === "string") return entry.labelOverride || null;
  if (library.label.mode === "hidden") return null;
  if (library.label.mode === "custom") return library.label.custom || actor.name;
  if (library.label.mode === "prototypeToken") return actor.prototypeToken?.name || actor.name;
  return actor.name;
}
