export async function preparePortraitView(entry) {
  const actor = await fromUuid(entry.actorUuid);
  if (actor?.documentName !== "Actor") return null;

  return {
    entry,
    actor,
    id: entry.id,
    actorUuid: actor.uuid,
    name: actor.name,
    image: resolvePortraitImage(entry, actor),
    visible: entry.visible,
    isOwner: actor.isOwner,
    canOpenSheet: actor.testUserPermission(game.user, "LIMITED")
  };
}

export function resolvePortraitImage(entry, actor) {
  switch (entry.image?.source) {
    case "prototypeToken":
      return actor.prototypeToken?.texture?.src || actor.img;
    case "custom":
      return entry.image?.customSrc || actor.img;
    case "actor":
    default:
      return actor.img || actor.prototypeToken?.texture?.src || CONST.DEFAULT_TOKEN;
  }
}
