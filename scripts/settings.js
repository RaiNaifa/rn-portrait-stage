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

function getAvailableFontChoices() {
  const FontConfigClass = foundry.applications.settings.menus.FontConfig;
  const foundryChoices = FontConfigClass?.getAvailableFontChoices?.();
  const choices = foundryChoices && typeof foundryChoices === "object"
    ? { ...foundryChoices }
    : {};
  const available = FontConfigClass?.getAvailableFonts?.();
  const names = available instanceof Map
    ? [...available.keys()]
    : available instanceof Set
      ? [...available]
    : Array.isArray(available)
      ? available
      : available && typeof available === "object"
        ? Object.keys(available)
        : Object.keys(globalThis.CONFIG?.fontDefinitions ?? {});
  for (const name of names) {
    if (typeof name === "string" && name.trim()) choices[name] = name;
  }
  for (const name of Object.keys(globalThis.CONFIG?.fontDefinitions ?? {})) choices[name] = name;
  if (!Object.keys(choices).length) choices.Signika = "Signika";
  return choices;
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

  register(SETTING_KEYS.ALLOW_OWNER_VARIANT_CONFIGURATION, {
    name: "RNPS.Settings.AllowOwnerVariantConfiguration.Name",
    hint: "RNPS.Settings.AllowOwnerVariantConfiguration.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  register(SETTING_KEYS.DEBUG_LOGGING, {
    name: "RNPS.Settings.DebugLogging.Name",
    hint: "RNPS.Settings.DebugLogging.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: false
  });

  register(SETTING_KEYS.EXPERIMENTAL_VOICE_ALLOWED, {
    name: "RNPS.Settings.ExperimentalVoiceAllowed.Name",
    hint: "RNPS.Settings.ExperimentalVoiceAllowed.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  register(SETTING_KEYS.EXPERIMENTAL_VOICE_ENABLED, {
    name: "RNPS.Settings.ExperimentalVoiceEnabled.Name",
    hint: "RNPS.Settings.ExperimentalVoiceEnabled.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });

  register(SETTING_KEYS.PORTRAIT_SCALE, {
    name: "RNPS.Settings.PortraitScale.Name",
    hint: "RNPS.Settings.PortraitScale.Hint",
    scope: "client",
    config: true,
    type: Number,
    default: 100,
    range: {
      min: 50,
      max: 150,
      step: 5
    }
  });

  const fontChoices = getAvailableFontChoices();
  register(SETTING_KEYS.LABEL_FONT_FAMILY, {
    name: "RNPS.Settings.LabelFontFamily.Name",
    hint: "RNPS.Settings.LabelFontFamily.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: fontChoices,
    default: fontChoices[CONFIG.defaultFontFamily]
      ? CONFIG.defaultFontFamily
      : Object.keys(fontChoices)[0] ?? "Signika"
  });

  register(SETTING_KEYS.LABEL_FONT_SIZE, {
    name: "RNPS.Settings.LabelFontSize.Name",
    hint: "RNPS.Settings.LabelFontSize.Hint",
    scope: "world",
    config: true,
    type: Number,
    default: 12,
    range: { min: 8, max: 48, step: 1 }
  });

  register(SETTING_KEYS.STAGE_ENABLED, {
    name: "RNPS.Settings.StageEnabled.Name",
    hint: "RNPS.Settings.StageEnabled.Hint",
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });

  register(SETTING_KEYS.PERSISTENT_STATE, {
    name: "RNPS.Settings.PersistentState.Name",
    hint: "RNPS.Settings.PersistentState.Hint",
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });

  register(SETTING_KEYS.RESERVE_ACTORS, {
    name: "RNPS.Settings.ReserveActors.Name",
    hint: "RNPS.Settings.ReserveActors.Hint",
    scope: "world",
    config: false,
    type: Object,
    default: []
  });

  register(SETTING_KEYS.PORTRAIT_GAP, {
    name: "RNPS.Settings.PortraitGap.Name",
    hint: "RNPS.Settings.PortraitGap.Hint",
    scope: "world",
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
      scope: "world",
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
      scope: "world",
      config: true,
      type: String,
      choices: {
        down: "RNPS.Settings.Direction.Down",
        up: "RNPS.Settings.Direction.Up"
      },
      default: "down"
    });
  }

  for (const [key, labelKey] of [
    [SETTING_KEYS.PC_DIRECTION_OVERRIDE, "PcDirectionOverride"],
    [SETTING_KEYS.NPC_DIRECTION_OVERRIDE, "NpcDirectionOverride"]
  ]) {
    register(key, {
      name: `RNPS.Settings.${labelKey}.Name`,
      hint: `RNPS.Settings.${labelKey}.Hint`,
      scope: "client",
      config: true,
      type: String,
      choices: {
        inherit: "RNPS.Settings.Direction.Inherit",
        down: "RNPS.Settings.Direction.Down",
        up: "RNPS.Settings.Direction.Up"
      },
      default: "inherit"
    });
  }

  logger.debug("Settings registered");
}

export function refreshFontChoices() {
  const choices = getAvailableFontChoices();
  const setting = game.settings.settings.get(`${MODULE_ID}.${SETTING_KEYS.LABEL_FONT_FAMILY}`);
  if (setting) setting.choices = choices;
}
