export const MODULE_ID = "rn-portrait-stage";
export const MODULE_TITLE = "RN Portrait Stage";
export const API_VERSION = 1;
export const SCENE_SCHEMA_VERSION = 11;
export const ACTOR_LIBRARY_SCHEMA_VERSION = 7;
export const EFFECT_SCHEMA_VERSION = 1;

export const FLAGS = Object.freeze({
  SCENE_STATE: "state",
  ACTOR_LIBRARY: "portraitLibrary"
});

export const GROUP_IDS = Object.freeze({
  PCS: "pcs",
  NPCS: "npcs"
});

export const CAST_PORTRAIT_SIZE = Object.freeze({ MIN: 100, MAX: 450, DEFAULT: 160 });

export const CAST_LAYERS = Object.freeze({
  SCENE: "scene",
  PERSISTENT: "persistent",
  RESERVE: "reserve",
  FOCUS: "focus"
});

export const SETTING_KEYS = Object.freeze({
  ALLOW_PLAYER_PORTRAIT_CHANGES: "allowPlayerPortraitChanges",
  ALLOW_OWNER_VARIANT_CONFIGURATION: "allowOwnerVariantConfiguration",
  ALLOW_ATTENTION_REQUESTS: "allowAttentionRequests",
  ATTENTION_DEFAULT_ZONE: "attentionDefaultZone",
  ATTENTION_REPLACE_OCCUPIED: "attentionReplaceOccupied",
  DEBUG_LOGGING: "debugLogging",
  LAST_SEEN_VERSION: "lastSeenVersion",
  EXPERIMENTAL_VOICE_ALLOWED: "experimentalVoiceAllowed",
  EXPERIMENTAL_VOICE_ENABLED: "experimentalVoiceEnabledClient",
  VOICE_THRESHOLD: "voiceThreshold",
  VOICE_ATTACK: "voiceAttack",
  VOICE_RELEASE: "voiceRelease",
  PORTRAIT_SCALE: "portraitScale",
  FOCUS_SCALE: "focusScale",
  BACKGROUND_DEFAULT_FIT: "backgroundDefaultFit",
  INITIAL_ACTOR_VARIANT: "initialActorVariant",
  LABEL_FONT_FAMILY: "labelFontFamily",
  LABEL_FONT_SIZE: "labelFontSize",
  PERSISTENT_STATE: "persistentState",
  STAGE_ENABLED: "stageEnabled",
  GM_STAGE_VISIBLE: "gmStageVisible",
  LAYER_VISIBILITY: "layerVisibility",
  CLIENT_LAYER_VISIBILITY: "clientLayerVisibility",
  RESERVE_ACTORS: "reserveActors",
  PORTRAIT_GAP: "portraitGap",
  FOCUS_GAP: "focusGap",
  PC_OFFSET_X: "pcOffsetX",
  PC_OFFSET_Y: "pcOffsetY",
  NPC_OFFSET_X: "npcOffsetX",
  NPC_OFFSET_Y: "npcOffsetY",
  HOVER_ART_DEFAULT_SOURCE: "hoverArtDefaultSource",
  FOCUS_IMAGE_DEFAULT_SOURCE: "focusImageDefaultSource",
  HOVER_ART_WORLD_SCALE: "hoverArtWorldScale",
  HOVER_ART_SCALE: "hoverArtScale",
  TOKEN_HIGHLIGHT_ENABLED: "tokenHighlightDefault",
  IMAGE_HOVER_PRIORITY: "imageHoverPriority",
  LITM_INTEGRATION_ENABLED: "litmIntegrationEnabled",
  PREVIEW_SESSION: "previewSession",
  PREVIEW_AUTO_APPLY: "previewAutoApply",
  RESERVE_HEIGHT: "reserveHeight",
  CAST_PRESETS: "castPresets",
  BACKGROUND_LIBRARY: "backgroundLibrary"
});

export const HOOKS = Object.freeze({
  READY: "rnPortraitStageReady",
  SETTINGS_CHANGED: "rnPortraitStageSettingsChanged",
  STATE_CHANGED: "rnPortraitStageStateChanged",
  LAYOUT_CHANGED: "rnPortraitStageLayoutChanged",
  SPEAKING_CHANGED: "rnPortraitStageSpeakingChanged"
});
