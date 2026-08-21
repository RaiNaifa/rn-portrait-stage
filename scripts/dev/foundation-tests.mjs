import assert from "node:assert/strict";

import { EFFECT_SCHEMA_VERSION, SCENE_SCHEMA_VERSION } from "../constants.js";
import { migrateSceneState } from "../data/migrations.js";
import { EffectRegistry } from "../effects/effect-registry.js";
import { ExtensionRegistry } from "../registries/extension-registry.js";

globalThis.foundry = {
  utils: {
    randomID: () => "test-entry-id"
  }
};

const {
  createPortraitEntry,
  normalizePortraitEntry
} = await import("../data/portrait-entry.js");
const {
  canUserAccessVariant,
  createDefaultActorLibrary,
  normalizeActorLibrary
} = await import("../data/actor-library.js");

const migrated = migrateSceneState({});
assert.equal(migrated.schemaVersion, SCENE_SCHEMA_VERSION);
assert.deepEqual(migrated.groups.pcs.entries, []);
assert.deepEqual(migrated.groups.npcs.entries, []);
assert.equal(migrated.layout.pcPortraitSize, null);
assert.equal(migrated.layout.npcPortraitSize, null);

assert.throws(
  () => migrateSceneState({ schemaVersion: SCENE_SCHEMA_VERSION + 1 }),
  /newer than supported/
);

const entry = createPortraitEntry("Actor.test", { groupId: "npcs" });
assert.equal(entry.id, "test-entry-id");
assert.equal(entry.actorUuid, "Actor.test");
assert.equal(entry.groupId, "npcs");
assert.equal(entry.image.source, "actor");
assert.deepEqual(entry.userVariants, {});

const normalizedEntry = normalizePortraitEntry({
  actorUuid: "Actor.test",
  groupId: "invalid",
  image: { source: "invalid" }
});
assert.equal(normalizedEntry.groupId, "pcs");
assert.equal(normalizedEntry.image.source, "actor");
assert.deepEqual(normalizedEntry.userVariants, {});
assert.equal(normalizePortraitEntry({ actorUuid: "Compendium.test" }), null);

const library = createDefaultActorLibrary();
assert.equal(library.variants.length, 2);
assert.equal(library.defaultVariantId, "actor");
const normalizedLibrary = normalizeActorLibrary({
  label: { mode: "custom", custom: "Hero" },
  variants: [{ id: "angry", name: "Angry", image: { source: "custom", customSrc: "angry.webp" } }],
  defaultVariantId: "angry"
});
assert.equal(normalizedLibrary.label.custom, "Hero");
assert.equal(normalizedLibrary.variants[2].image.customSrc, "angry.webp");
assert.equal(normalizedLibrary.variants[2].access.mode, "owners");
assert.equal(normalizedLibrary.variants[2].settings.label.inherit, true);
const owner = { id: "owner", isGM: false };
const guest = { id: "guest", isGM: false };
const actor = { testUserPermission: user => user.id === "owner" };
assert.equal(canUserAccessVariant(normalizedLibrary.variants[2], actor, owner), true);
assert.equal(canUserAccessVariant(normalizedLibrary.variants[2], actor, guest), false);
const selectedLibrary = normalizeActorLibrary({
  variants: [{
    id: "selected",
    name: "Selected",
    image: { source: "custom", customSrc: "selected.webp" },
    access: { mode: "selected", userIds: ["guest"] }
  }]
});
assert.equal(canUserAccessVariant(selectedLibrary.variants[2], actor, guest), true);

const extensions = new ExtensionRegistry("Test extension");
const extension = extensions.register({ id: "test.extension", value: 1 });
assert.equal(extensions.get("test.extension"), extension);
assert.throws(() => extensions.register({ id: "test.extension" }), /already registered/);
assert.throws(() => extensions.register({ id: "not-namespaced" }), /namespaced/);

const effects = new EffectRegistry();
effects.registerEngine("test.engine", {
  play() {},
  stop() {}
});
effects.registerPreset({
  id: "test.preset",
  schemaVersion: EFFECT_SCHEMA_VERSION,
  engine: "test.engine",
  trigger: "hover",
  options: {}
});
assert.equal(effects.getPreset("test.preset")?.id, "test.preset");
assert.throws(
  () => effects.registerPreset({
    id: "test.bad-trigger",
    schemaVersion: EFFECT_SCHEMA_VERSION,
    engine: "test.engine",
    trigger: "unknown"
  }),
  /Unknown effect trigger/
);

console.log("Foundation unit tests passed.");
