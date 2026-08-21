import { MODULE_ID, SETTING_KEYS } from "../constants.js";
import { createDefaultSceneState, normalizeSceneState } from "./scene-state.js";

export function getPersistentState() {
  const value = game.settings.get(MODULE_ID, SETTING_KEYS.PERSISTENT_STATE);
  return normalizeSceneState(value ?? createDefaultSceneState());
}

export async function setPersistentState(state) {
  const normalized = normalizeSceneState(state);
  await game.settings.set(MODULE_ID, SETTING_KEYS.PERSISTENT_STATE, normalized);
  return normalized;
}
