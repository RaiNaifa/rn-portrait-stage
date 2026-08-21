export const MODULE_ID = "rn-portrait-stage";
export const MODULE_TITLE = "RN Portrait Stage";
export const API_VERSION = 1;
export const SCENE_SCHEMA_VERSION = 5;
export const ACTOR_LIBRARY_SCHEMA_VERSION = 4;
export const EFFECT_SCHEMA_VERSION = 1;

export const FLAGS = Object.freeze({
  SCENE_STATE: "state",
  ACTOR_LIBRARY: "portraitLibrary"
});

export const GROUP_IDS = Object.freeze({
  PCS: "pcs",
  NPCS: "npcs"
});

export const CAST_LAYERS = Object.freeze({
  SCENE: "scene",
  PERSISTENT: "persistent",
  RESERVE: "reserve"
});

export const SETTING_KEYS = Object.freeze({
  ALLOW_PLAYER_PORTRAIT_CHANGES: "allowPlayerPortraitChanges",
  ALLOW_OWNER_VARIANT_CONFIGURATION: "allowOwnerVariantConfiguration",
  DEBUG_LOGGING: "debugLogging",
  EXPERIMENTAL_VOICE_ALLOWED: "experimentalVoiceAllowed",
  EXPERIMENTAL_VOICE_ENABLED: "experimentalVoiceEnabledClient",
  PORTRAIT_SCALE: "portraitScale",
  LABEL_FONT_FAMILY: "labelFontFamily",
  LABEL_FONT_SIZE: "labelFontSize",
  PERSISTENT_STATE: "persistentState",
  STAGE_ENABLED: "stageEnabled",
  RESERVE_ACTORS: "reserveActors",
  PORTRAIT_GAP: "portraitGap",
  PC_OFFSET_X: "pcOffsetX",
  PC_OFFSET_Y: "pcOffsetY",
  NPC_OFFSET_X: "npcOffsetX",
  NPC_OFFSET_Y: "npcOffsetY",
  PC_DIRECTION: "pcDirection",
  NPC_DIRECTION: "npcDirection",
  PC_DIRECTION_OVERRIDE: "pcDirectionOverride",
  NPC_DIRECTION_OVERRIDE: "npcDirectionOverride",
  HOVER_ART_DEFAULT_SOURCE: "hoverArtDefaultSource",
  HOVER_ART_BOTTOM_OFFSET: "hoverArtBottomOffset",
  HOVER_ART_WORLD_SCALE: "hoverArtWorldScale",
  HOVER_ART_SCALE: "hoverArtScale",
  TOKEN_HIGHLIGHT_DEFAULT: "tokenHighlightDefault",
  IMAGE_HOVER_PRIORITY: "imageHoverPriority",
  LITM_INTEGRATION_ENABLED: "litmIntegrationEnabled",
  PREVIEW_SESSION: "previewSession",
  CAST_PRESETS: "castPresets"
});

export const HOOKS = Object.freeze({
  READY: "rnPortraitStageReady",
  SETTINGS_CHANGED: "rnPortraitStageSettingsChanged",
  STATE_CHANGED: "rnPortraitStageStateChanged",
  LAYOUT_CHANGED: "rnPortraitStageLayoutChanged"
});
