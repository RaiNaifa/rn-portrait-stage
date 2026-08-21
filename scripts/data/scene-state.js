import { FLAGS, GROUP_IDS, MODULE_ID, SCENE_SCHEMA_VERSION } from "../constants.js";
import { getCompatibilityAdapter } from "../compatibility/index.js";
import { migrateSceneState } from "./migrations.js";
import { normalizePortraitEntry } from "./portrait-entry.js";

export function createDefaultSceneState() {
  return {
    schemaVersion: SCENE_SCHEMA_VERSION,
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
