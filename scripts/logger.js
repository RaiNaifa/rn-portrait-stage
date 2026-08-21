import { MODULE_ID, SETTING_KEYS } from "./constants.js";

function canReadSettings() {
  return Boolean(globalThis.game?.settings?.settings?.has(`${MODULE_ID}.${SETTING_KEYS.DEBUG_LOGGING}`));
}

function debugEnabled() {
  if (!canReadSettings()) return false;
  return Boolean(game.settings.get(MODULE_ID, SETTING_KEYS.DEBUG_LOGGING));
}

export const logger = Object.freeze({
  debug(...args) {
    if (debugEnabled()) console.debug(`${MODULE_ID} |`, ...args);
  },

  info(...args) {
    console.info(`${MODULE_ID} |`, ...args);
  },

  warn(...args) {
    console.warn(`${MODULE_ID} |`, ...args);
  },

  error(...args) {
    console.error(`${MODULE_ID} |`, ...args);
  }
});
