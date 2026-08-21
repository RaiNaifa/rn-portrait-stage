import { MODULE_ID, SETTING_KEYS } from "../constants.js";

const INTEGRATION_ID = "litm-rn";

export function registerLitmIntegration(api) {
  if (game.system.id !== INTEGRATION_ID || !api) return;

  api.actions.register({
    id: `${INTEGRATION_ID}.toggle-tags`,
    order: 100,
    icon: "fa-solid fa-tags",
    label: "RNPS.Integrations.Litm.ToggleTags",
    isVisible: () => game.user.isGM
      && game.settings.get(MODULE_ID, SETTING_KEYS.LITM_INTEGRATION_ENABLED),
    isActive: ({ entry }) => entry.flags?.[INTEGRATION_ID]?.tagsVisible === true,
    onClick: async ({ entry, updateEntry }) => updateEntry({
      flags: {
        [INTEGRATION_ID]: {
          ...(entry.flags?.[INTEGRATION_ID] ?? {}),
          tagsVisible: entry.flags?.[INTEGRATION_ID]?.tagsVisible !== true
        }
      }
    })
  });

  api.hover.registerBlock({
    id: `${INTEGRATION_ID}.tags`,
    order: 100,
    isVisible: ({ entry }) => game.settings.get(MODULE_ID, SETTING_KEYS.LITM_INTEGRATION_ENABLED)
      && entry.flags?.[INTEGRATION_ID]?.tagsVisible === true,
    render: ({ actor }) => renderTags(actor)
  });
}

function renderTags(actor) {
  const effects = actor.effects
    .filter(effect => {
      const flags = effect.flags?.[INTEGRATION_ID];
      if (!["tag", "status", "might"].includes(flags?.type)) return false;
      if (flags.isPrivate && !game.user.isGM && !actor.isOwner) return false;
      return !flags.ownerType;
    })
    .map(effect => {
      const flags = effect.flags[INTEGRATION_ID];
      if (flags.type === "status") {
        const index = (flags.values ?? []).findLastIndex(Boolean);
        return { name: effect.name, type: "status", value: index >= 0 ? index + 1 : null, private: flags.isPrivate };
      }
      if (flags.type === "might") {
        const value = flags.value ?? 3;
        return {
          name: effect.name,
          type: "might",
          tier: value >= 6 ? "greatness" : value >= 3 ? "adventure" : "origin",
          private: flags.isPrivate
        };
      }
      return { name: effect.name, type: "tag", private: flags.isPrivate };
    })
    .sort((a, b) => ({ status: 0, tag: 1, might: 2 })[a.type] - ({ status: 0, tag: 1, might: 2 })[b.type]
      || a.name.localeCompare(b.name));
  if (!effects.length) return null;
  const element = document.createElement("div");
  element.className = "litm-token-tooltip rnps-litm-tags";
  for (const effect of effects) element.append(renderMark(effect));
  return element;
}

function renderMark(effect) {
  const mark = document.createElement("mark");
  mark.className = `litm--hover-${effect.type}${effect.type === "might" ? ` litm--hover-might-${effect.tier}` : ""}${effect.private ? " litm--hover-private" : ""}`;
  mark.append(document.createTextNode(effect.name));
  if (effect.type === "status" && effect.value) {
    const value = document.createElement("span");
    value.className = "litm--hover-status-val";
    value.textContent = String(effect.value);
    mark.append(value);
  }
  return mark;
}
