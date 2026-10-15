import { SCENE_SCHEMA_VERSION } from "../constants.js";

const migrations = new Map();

export function registerSceneMigration(fromVersion, migration) {
  if (!Number.isInteger(fromVersion) || fromVersion < 0) {
    throw new TypeError("Migration version must be a non-negative integer.");
  }
  if (typeof migration !== "function") {
    throw new TypeError("Migration must be a function.");
  }
  if (migrations.has(fromVersion)) {
    throw new Error(`A scene migration from version ${fromVersion} is already registered.`);
  }
  migrations.set(fromVersion, migration);
}

export function migrateSceneState(source) {
  let state = source && typeof source === "object" ? cloneData(source) : {};
  let version = Number.isInteger(state.schemaVersion) ? state.schemaVersion : 0;

  if (version > SCENE_SCHEMA_VERSION) {
    throw new Error(
      `Scene state schema ${version} is newer than supported schema ${SCENE_SCHEMA_VERSION}.`
    );
  }

  while (version < SCENE_SCHEMA_VERSION) {
    const migration = migrations.get(version);
    if (!migration) throw new Error(`Missing scene migration from schema version ${version}.`);
    state = migration(cloneData(state));
    version += 1;
    state.schemaVersion = version;
  }

  return state;
}

function cloneData(value) {
  if (typeof globalThis.structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

registerSceneMigration(0, source => ({
  ...source,
  schemaVersion: 1,
  groups: {
    pcs: {
      ...source.groups?.pcs,
      entries: Array.isArray(source.groups?.pcs?.entries) ? source.groups.pcs.entries : []
    },
    npcs: {
      ...source.groups?.npcs,
      entries: Array.isArray(source.groups?.npcs?.entries) ? source.groups.npcs.entries : []
    }
  }
}));

registerSceneMigration(1, source => ({
  ...source,
  schemaVersion: 2,
  layout: {
    portraitSize: Number.isFinite(source.layout?.portraitSize)
      ? source.layout.portraitSize
      : null
  }
}));

registerSceneMigration(2, source => ({
  ...source,
  schemaVersion: 3,
  layout: {
    pcPortraitSize: Number.isFinite(source.layout?.portraitSize)
      ? source.layout.portraitSize
      : null,
    npcPortraitSize: Number.isFinite(source.layout?.portraitSize)
      ? source.layout.portraitSize
      : null
  }
}));

registerSceneMigration(3, source => ({
  ...source,
  schemaVersion: 4,
  groups: Object.fromEntries(["pcs", "npcs"].map(groupId => [groupId, {
    ...source.groups?.[groupId],
    entries: (source.groups?.[groupId]?.entries ?? []).map(entry => ({
      ...entry,
      userVariants: entry.userVariants && typeof entry.userVariants === "object"
        ? entry.userVariants
        : {}
    }))
  }]))
}));

registerSceneMigration(4, source => ({
  ...source,
  schemaVersion: 5,
  layout: {
    ...source.layout,
    tokenHighlight: typeof source.layout?.tokenHighlight === "boolean"
      ? source.layout.tokenHighlight
      : null
  }
}));

registerSceneMigration(5, source => ({
  ...source,
  schemaVersion: 6,
  focus: source.focus ?? { left: null, center: null, right: null, showSideCast: true },
  background: source.background ?? { src: "", fit: "cover", positionX: 50, positionY: 50, dim: 0, blur: 0, overUi: false }
}));

registerSceneMigration(6, source => {
  const focus = { ...source.focus };
  delete focus.showSideCast;
  return { ...source, schemaVersion: 7, focus };
});

registerSceneMigration(7, source => {
  const layout = { ...source.layout };
  delete layout.tokenHighlight;
  return { ...source, schemaVersion: 8, layout };
});

registerSceneMigration(8, source => {
  const background = source.background ?? {};
  const hasBackground = typeof background.src === "string" && background.src.trim();
  const id = hasBackground ? "legacy-background" : null;
  return {
    ...source,
    schemaVersion: 9,
    backgrounds: id ? [{ id, name: background.src.split(/[\\/]/).pop(), ...background }] : [],
    activeBackgroundId: id
  };
});

registerSceneMigration(9, source => ({ ...source, schemaVersion: 10 }));

registerSceneMigration(10, source => ({ ...source, schemaVersion: 11, backgroundSuppressed: false }));
