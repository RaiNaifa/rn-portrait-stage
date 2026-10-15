import { MODULE_ID, SETTING_KEYS } from "../constants.js";

export const VISIBILITY_LAYERS = Object.freeze(["side", "focus", "background"]);
let previousShared = null;

function read(key, fallback) {
  const stored = game.settings.get(MODULE_ID, key) ?? {};
  return Object.fromEntries(VISIBILITY_LAYERS.map(layer => [
    layer, typeof stored[layer] === "boolean" ? stored[layer] : fallback
  ]));
}

export function getSharedVisibility() {
  const state = read(SETTING_KEYS.LAYER_VISIBILITY, game.settings.get(MODULE_ID, SETTING_KEYS.STAGE_ENABLED));
  previousShared ??= { ...state };
  return state;
}

export async function reconcileSharedVisibility() {
  const current = getSharedVisibility();
  const prior = previousShared ?? current;
  previousShared = { ...current };
  if (game.user?.isGM) return;
  const personal = getClientVisibility();
  let changed = false;
  for (const layer of VISIBILITY_LAYERS) {
    if (!prior[layer] && current[layer] && !personal[layer]) {
      personal[layer] = true;
      changed = true;
    }
  }
  if (changed) await game.settings.set(MODULE_ID, SETTING_KEYS.CLIENT_LAYER_VISIBILITY, personal);
}

export function getClientVisibility() {
  return read(
    SETTING_KEYS.CLIENT_LAYER_VISIBILITY,
    game.user?.isGM ? game.settings.get(MODULE_ID, SETTING_KEYS.GM_STAGE_VISIBLE) : true
  );
}

export function isLayerVisible(layer) {
  if (!VISIBILITY_LAYERS.includes(layer)) return false;
  const self = getClientVisibility()[layer];
  return game.user?.isGM ? self : getSharedVisibility()[layer] && self;
}

export async function toggleSharedVisibility(layer) {
  if (!game.user?.isGM || (layer !== "all" && !VISIBILITY_LAYERS.includes(layer))) return false;
  const shared = getSharedVisibility();
  const layers = layer === "all" ? VISIBILITY_LAYERS : [layer];
  const visible = layer === "all" ? !layers.every(key => shared[key]) : !shared[layer];
  const changes = Object.fromEntries(layers.map(key => [key, visible]));
  await game.settings.set(MODULE_ID, SETTING_KEYS.LAYER_VISIBILITY, { ...shared, ...changes });
  await game.settings.set(MODULE_ID, SETTING_KEYS.CLIENT_LAYER_VISIBILITY, {
    ...getClientVisibility(), ...changes
  });
  return visible;
}

export async function toggleClientVisibility(layer) {
  if (layer !== "all" && !VISIBILITY_LAYERS.includes(layer)) return false;
  const layers = layer === "all" ? VISIBILITY_LAYERS : [layer];
  if (!game.user?.isGM && layers.some(key => !getSharedVisibility()[key])) return false;
  const current = getClientVisibility();
  const visible = layer === "all" ? !layers.every(key => current[key]) : !current[layer];
  await game.settings.set(MODULE_ID, SETTING_KEYS.CLIENT_LAYER_VISIBILITY, {
    ...current, ...Object.fromEntries(layers.map(key => [key, visible]))
  });
  return visible;
}
