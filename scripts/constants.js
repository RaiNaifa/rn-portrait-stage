export const MODULE_ID = "rn-portrait-stage";
export const MODULE_TITLE = "RN Portrait Stage";
export const API_VERSION = 1;
export const SCENE_SCHEMA_VERSION = 1;
export const EFFECT_SCHEMA_VERSION = 1;

export const FLAGS = Object.freeze({
  SCENE_STATE: "state"
});

export const GROUP_IDS = Object.freeze({
  PCS: "pcs",
  NPCS: "npcs"
});

export const SETTING_KEYS = Object.freeze({
  ALLOW_PLAYER_PORTRAIT_CHANGES: "allowPlayerPortraitChanges",
  DEBUG_LOGGING: "debugLogging",
  EXPERIMENTAL_VOICE_ENABLED: "experimentalVoiceEnabled",
  MODULE_VISIBLE: "moduleVisible",
  PORTRAIT_SIZE: "portraitSize",
  PORTRAIT_GAP: "portraitGap",
  PC_OFFSET_X: "pcOffsetX",
  PC_OFFSET_Y: "pcOffsetY",
  NPC_OFFSET_X: "npcOffsetX",
  NPC_OFFSET_Y: "npcOffsetY",
  PC_DIRECTION: "pcDirection",
  NPC_DIRECTION: "npcDirection",
  REDUCED_MOTION: "reducedMotion"
});

export const HOOKS = Object.freeze({
  READY: "rnPortraitStageReady",
  SETTINGS_CHANGED: "rnPortraitStageSettingsChanged",
  STATE_CHANGED: "rnPortraitStageStateChanged",
  LAYOUT_CHANGED: "rnPortraitStageLayoutChanged"
});
