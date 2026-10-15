import { CAST_PORTRAIT_SIZE, FLAGS, GROUP_IDS, MODULE_ID, SCENE_SCHEMA_VERSION } from "../constants.js";
import { getCompatibilityAdapter } from "../compatibility/index.js";
import { migrateSceneState } from "./migrations.js";
import { normalizePortraitEntry } from "./portrait-entry.js";

export function createDefaultSceneState() {
  return {
    schemaVersion: SCENE_SCHEMA_VERSION,
    layout: {
      pcPortraitSize: null,
      npcPortraitSize: null
    },
    focus: { left: null, center: null, right: null },
    background: { src: "", fit: "cover", positionX: 50, positionY: 50, dim: 0, blur: 0, overUi: false },
    backgrounds: [],
    activeBackgroundId: null,
    backgroundSuppressed: false,
    backgroundId: null,
    backgroundFollowActive: false,
    groups: {
      [GROUP_IDS.PCS]: {
        entries: []
      },
      [GROUP_IDS.NPCS]: {
        entries: []
      }
    }
  };
}

export function normalizeSceneState(source) {
  const adapter = getCompatibilityAdapter();
  const state = migrateSceneState(source ?? createDefaultSceneState());
  const normalized = createDefaultSceneState();
  normalized.layout.pcPortraitSize = normalizePortraitSize(state.layout?.pcPortraitSize);
  normalized.layout.npcPortraitSize = normalizePortraitSize(state.layout?.npcPortraitSize);
  const seen = new Set();
  for (const zone of ["left", "center", "right"]) {
    const item = state.focus?.[zone];
    const entry = normalizePortraitEntry(item?.entry);
    if (!entry || seen.has(entry.actorUuid)) continue;
    seen.add(entry.actorUuid);
    normalized.focus[zone] = { entry, visible: item.visible !== false };
  }
  const bg = state.background ?? {};
  normalized.background = {
    src: typeof bg.src === "string" ? bg.src.trim() : "",
    fit: bg.fit === "contain" ? "contain" : "cover",
    positionX: clamp(bg.positionX, 0, 100, 50),
    positionY: clamp(bg.positionY, 0, 100, 50),
    dim: clamp(bg.dim, 0, 100, 0),
    blur: clamp(bg.blur, 0, 30, 0),
    overUi: false
  };
  normalized.backgrounds = (Array.isArray(state.backgrounds) ? state.backgrounds : [])
    .filter(item => item && typeof item.id === "string" && typeof item.src === "string" && item.src.trim())
    .map(item => ({
      id: item.id,
      name: typeof item.name === "string" && item.name.trim() ? item.name.trim() : item.src.split(/[\\/]/).pop(),
      src: item.src.trim(),
      fit: item.fit === "contain" ? "contain" : "cover",
      positionX: clamp(item.positionX, 0, 100, 50),
      positionY: clamp(item.positionY, 0, 100, 50),
      dim: clamp(item.dim, 0, 100, 0),
      blur: clamp(item.blur, 0, 30, 0)
    }));
  normalized.activeBackgroundId = normalized.backgrounds.some(item => item.id === state.activeBackgroundId)
    ? state.activeBackgroundId : typeof state.activeBackgroundId === "string" ? state.activeBackgroundId : null;
  normalized.backgroundId = typeof state.backgroundId === "string" ? state.backgroundId : null;
  normalized.backgroundFollowActive = state.backgroundFollowActive === true
    || (state.backgroundFollowActive == null && Boolean(normalized.backgroundId));
  normalized.backgroundSuppressed = state.backgroundSuppressed === true;

  for (const groupId of Object.values(GROUP_IDS)) {
    const entries = state.groups?.[groupId]?.entries;
    normalized.groups[groupId].entries = Array.isArray(entries)
      ? adapter.clone(entries)
        .map(entry => normalizePortraitEntry(entry, groupId))
        .filter(Boolean)
        .sort((a, b) => a.sort - b.sort)
      : [];
  }

  return normalized;
}

export function withActiveBackground(source, background) {
  const state = normalizeSceneState(source);
  const normalized = normalizeSceneState({ ...state, background }).background;
  state.background = normalized;
  if (!normalized.src) {
    state.activeBackgroundId = null;
    return state;
  }
  let item = state.backgrounds.find(value => value.src === normalized.src);
  if (!item) {
    item = { id: foundry.utils.randomID(), name: normalized.src.split(/[\\/]/).pop(), ...normalized };
    state.backgrounds.push(item);
  } else Object.assign(item, normalized);
  state.activeBackgroundId = item.id;
  return state;
}

function clamp(value, min, max, fallback) {
  return Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
}

function normalizePortraitSize(value) {
  if (!Number.isFinite(value)) return null;
  return Math.max(CAST_PORTRAIT_SIZE.MIN, Math.min(CAST_PORTRAIT_SIZE.MAX, Math.round(value)));
}

export function getSceneState(
  scene = globalThis.canvas?.scene ?? globalThis.game?.scenes?.active
) {
  if (!scene) return createDefaultSceneState();
  return normalizeSceneState(scene.getFlag(MODULE_ID, FLAGS.SCENE_STATE));
}

export async function setSceneState(scene, state) {
  if (!scene) throw new TypeError("A Scene document is required.");
  const normalized = normalizeSceneState(state);
  await scene.setFlag(MODULE_ID, FLAGS.SCENE_STATE, normalized);
  return normalized;
}
