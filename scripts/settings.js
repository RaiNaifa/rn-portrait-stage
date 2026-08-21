import { HOOKS, MODULE_ID, SETTING_KEYS } from "./constants.js";
import { logger } from "./logger.js";

function notifySettingChanged(key, value) {
  logger.debug("Setting changed", { key, value });
  Hooks.callAll(HOOKS.SETTINGS_CHANGED, { key, value });
}

function register(key, data) {
  game.settings.register(MODULE_ID, key, {
    ...data,
    onChange: value => notifySettingChanged(key, value)
  });
}

export function registerSettings() {
  register(SETTING_KEYS.ALLOW_PLAYER_PORTRAIT_CHANGES, {
    name: "RNPS.Settings.AllowPlayerPortraitChanges.Name",
    hint: "RNPS.Settings.AllowPlayerPortraitChanges.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  register(SETTING_KEYS.DEBUG_LOGGING, {
    name: "RNPS.Settings.DebugLogging.Name",
    hint: "RNPS.Settings.DebugLogging.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  register(SETTING_KEYS.EXPERIMENTAL_VOICE_ENABLED, {
    name: "RNPS.Settings.ExperimentalVoiceEnabled.Name",
    hint: "RNPS.Settings.ExperimentalVoiceEnabled.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  register(SETTING_KEYS.MODULE_VISIBLE, {
    name: "RNPS.Settings.ModuleVisible.Name",
    hint: "RNPS.Settings.ModuleVisible.Hint",
    scope: "user",
    config: true,
    type: Boolean,
    default: true
  });

  register(SETTING_KEYS.PORTRAIT_SIZE, {
    name: "RNPS.Settings.PortraitSize.Name",
    hint: "RNPS.Settings.PortraitSize.Hint",
    scope: "user",
    config: true,
    type: Number,
    default: 160,
    range: {
      min: 48,
      max: 480,
      step: 4
    }
  });

  register(SETTING_KEYS.PORTRAIT_GAP, {
    name: "RNPS.Settings.PortraitGap.Name",
    hint: "RNPS.Settings.PortraitGap.Hint",
    scope: "user",
    config: true,
    type: Number,
    default: 8,
    range: {
      min: 0,
      max: 64,
      step: 1
    }
  });

  for (const [key, labelKey, defaultValue] of [
    [SETTING_KEYS.PC_OFFSET_X, "PcOffsetX", 0],
    [SETTING_KEYS.PC_OFFSET_Y, "PcOffsetY", 0],
    [SETTING_KEYS.NPC_OFFSET_X, "NpcOffsetX", 0],
    [SETTING_KEYS.NPC_OFFSET_Y, "NpcOffsetY", 0]
  ]) {
    register(key, {
      name: `RNPS.Settings.${labelKey}.Name`,
      hint: `RNPS.Settings.${labelKey}.Hint`,
      scope: "user",
      config: true,
      type: Number,
      default: defaultValue,
      range: {
        min: -500,
        max: 500,
        step: 1
      }
    });
  }

  for (const [key, labelKey] of [
    [SETTING_KEYS.PC_DIRECTION, "PcDirection"],
    [SETTING_KEYS.NPC_DIRECTION, "NpcDirection"]
  ]) {
    register(key, {
      name: `RNPS.Settings.${labelKey}.Name`,
      hint: `RNPS.Settings.${labelKey}.Hint`,
      scope: "user",
      config: true,
      type: String,
      choices: {
        down: "RNPS.Settings.Direction.Down",
        up: "RNPS.Settings.Direction.Up"
      },
      default: "down"
    });
  }

  register(SETTING_KEYS.REDUCED_MOTION, {
    name: "RNPS.Settings.ReducedMotion.Name",
    hint: "RNPS.Settings.ReducedMotion.Hint",
    scope: "user",
    config: true,
    type: Boolean,
    default: false
  });

  logger.debug("Settings registered");
}
