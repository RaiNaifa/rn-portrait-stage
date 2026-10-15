import assert from "node:assert/strict";

import { EFFECT_SCHEMA_VERSION, SCENE_SCHEMA_VERSION, SETTING_KEYS } from "../constants.js";
import { migrateSceneState } from "../data/migrations.js";
import { EffectRegistry } from "../effects/effect-registry.js";
import { ExtensionRegistry } from "../registries/extension-registry.js";

globalThis.foundry = {
  utils: {
    randomID: () => "test-entry-id",
    deepClone: value => structuredClone(value)
  }
};
globalThis.game = { release: { generation: 13 } };

const {
  createPortraitEntry,
  normalizePortraitEntry
} = await import("../data/portrait-entry.js");
const {
  canUserAccessVariant,
  createDefaultActorLibrary,
  getStartingVariantId,
  normalizeActorLibrary
} = await import("../data/actor-library.js");

const migrated = migrateSceneState({});
assert.equal(migrated.schemaVersion, SCENE_SCHEMA_VERSION);
assert.deepEqual(migrated.groups.pcs.entries, []);
assert.deepEqual(migrated.groups.npcs.entries, []);
assert.equal(migrated.layout.pcPortraitSize, null);
assert.equal(migrated.layout.npcPortraitSize, null);
assert.equal(Object.hasOwn(migrated.layout, "tokenHighlight"), false);
assert.deepEqual(migrated.focus, { left: null, center: null, right: null });
assert.deepEqual(migrated.background, { src: "", fit: "cover", positionX: 50, positionY: 50, dim: 0, blur: 0, overUi: false });
assert.deepEqual(migrated.backgrounds, []);
assert.equal(migrated.activeBackgroundId, null);
const previousScene = migrateSceneState({ schemaVersion: 5, layout: {}, groups: { pcs: { entries: [] }, npcs: { entries: [] } } });
assert.equal(previousScene.schemaVersion, SCENE_SCHEMA_VERSION);
assert.deepEqual(previousScene.focus, { left: null, center: null, right: null });

const highlightedScene = migrateSceneState({
  schemaVersion: 7,
  layout: { tokenHighlight: true },
  groups: { pcs: { entries: [] }, npcs: { entries: [] } }
});
assert.equal(Object.hasOwn(highlightedScene.layout, "tokenHighlight"), false);

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

const { normalizeSceneState } = await import("../data/scene-state.js");
const focusEntry = createPortraitEntry("Actor.test");
const normalizedScene = normalizeSceneState({
  schemaVersion: SCENE_SCHEMA_VERSION,
  layout: { tokenHighlight: true },
  focus: {
    left: { entry: focusEntry, visible: false },
    right: { entry: focusEntry, visible: true },
    showSideCast: false
  },
  background: { src: "scene.webm", positionX: 200, dim: -10, fit: "contain" }
});
assert.equal(normalizedScene.focus.left.visible, false);
assert.equal(normalizedScene.focus.right, null);
assert.deepEqual(normalizedScene.focusOrder, ["left", "center", "right"]);
assert.deepEqual(normalizeSceneState({ focusOrder: ["right", "left", "right", "invalid"] }).focusOrder,
  ["right", "left", "center"]);
assert.equal(Object.hasOwn(normalizedScene.focus, "showSideCast"), false);
assert.equal(Object.hasOwn(normalizedScene.layout, "tokenHighlight"), false);
assert.equal(normalizedScene.background.positionX, 100);
assert.equal(normalizedScene.background.dim, 0);
assert.equal(normalizedScene.background.fit, "contain");

const migratedBackground = migrateSceneState({ schemaVersion: 8, background: { src: "art/forest.webp", fit: "contain" } });
assert.equal(migratedBackground.backgrounds[0].src, "art/forest.webp");
assert.equal(migratedBackground.activeBackgroundId, "legacy-background");
const { withActiveBackground } = await import("../data/scene-state.js");
const withPresetBackground = withActiveBackground(normalizeSceneState({
  schemaVersion: SCENE_SCHEMA_VERSION,
  backgrounds: [{ id: "a", name: "Forest", src: "forest.webp" }],
  activeBackgroundId: "a",
  background: { src: "forest.webp" }
}), { src: "castle.webp", dim: 25 });
assert.equal(withPresetBackground.backgrounds.length, 2);
assert.equal(withPresetBackground.backgrounds.find(item => item.id === withPresetBackground.activeBackgroundId).src, "castle.webp");
assert.equal(withPresetBackground.background.dim, 25);

const visibilitySettings = new Map([
  [SETTING_KEYS.STAGE_ENABLED, true],
  [SETTING_KEYS.GM_STAGE_VISIBLE, true],
  [SETTING_KEYS.LAYER_VISIBILITY, {}],
  [SETTING_KEYS.CLIENT_LAYER_VISIBILITY, {}]
]);
game.user = { isGM: true };
game.settings = {
  get: (_module, key) => visibilitySettings.get(key),
  set: async (_module, key, value) => visibilitySettings.set(key, value)
};
const unsavedActor = { getFlag: () => null };
assert.equal(getStartingVariantId(unsavedActor), "actor");
visibilitySettings.set(SETTING_KEYS.INITIAL_ACTOR_VARIANT, "prototypeToken");
assert.equal(getStartingVariantId(unsavedActor), "prototypeToken");
const configuredActor = { getFlag: () => ({ defaultVariantId: "actor", lastActiveVariantId: "actor" }) };
assert.equal(getStartingVariantId(configuredActor), "actor");
const { getSharedVisibility, getClientVisibility, toggleSharedVisibility, toggleClientVisibility, isLayerVisible } = await import("../data/visibility-service.js");
assert.deepEqual(getSharedVisibility(), { side: true, focus: true, background: true });
await toggleSharedVisibility("focus");
assert.equal(getSharedVisibility().focus, false);
assert.equal(getClientVisibility().focus, false);
await toggleClientVisibility("focus");
assert.equal(isLayerVisible("focus"), true);
await toggleClientVisibility("all");
assert.deepEqual(getClientVisibility(), { side: false, focus: false, background: false });
await toggleClientVisibility("all");
assert.deepEqual(getClientVisibility(), { side: true, focus: true, background: true });
await toggleSharedVisibility("all");
assert.deepEqual(getSharedVisibility(), { side: true, focus: true, background: true });
await toggleSharedVisibility("all");
assert.deepEqual(getSharedVisibility(), { side: false, focus: false, background: false });
assert.deepEqual(getClientVisibility(), { side: false, focus: false, background: false });
game.user = { isGM: false };
assert.equal(isLayerVisible("focus"), false);
assert.equal(await toggleClientVisibility("focus"), false);
const playerSettings = game.settings;
game.settings = {
  get: (module, key) => key === SETTING_KEYS.CLIENT_LAYER_VISIBILITY
    ? { side: true, focus: true, background: true }
    : playerSettings.get(module, key),
  set: playerSettings.set
};
assert.equal(isLayerVisible("focus"), false);
visibilitySettings.set(SETTING_KEYS.LAYER_VISIBILITY, { side: false, focus: true, background: false });
assert.equal(isLayerVisible("focus"), true);
assert.equal(isLayerVisible("side"), false);

const library = createDefaultActorLibrary();
assert.equal(library.variants.length, 2);
assert.equal(library.defaultVariantId, "actor");
assert.equal(library.groups[0].id, "default");
assert.equal(library.defaultGroupId, "default");
const normalizedLibrary = normalizeActorLibrary({
  label: { mode: "custom", custom: "Hero" },
  variants: [{ id: "angry", name: "Angry", image: { source: "custom", customSrc: "angry.webp" } }],
  defaultVariantId: "angry"
});
assert.equal(normalizedLibrary.label.custom, "Hero");
assert.equal(normalizedLibrary.variants[2].image.customSrc, "angry.webp");
assert.equal(normalizedLibrary.variants[2].access.mode, "owners");
assert.equal(normalizedLibrary.variants[2].settings.label.inherit, true);
assert.equal(normalizedLibrary.variants[2].settings.hover.source, "inherit");
assert.deepEqual(normalizedLibrary.variants[2].settings.focus, {
  source: "inherit", customSrc: null, mirrored: false, scale: 1, offsetX: 0, offsetY: 0
});
const positionedFocus = normalizeActorLibrary({
  variants: [{ id: "positioned", settings: { focus: { scale: 1.75, offsetX: -24, offsetY: 36 } } }]
}).variants[2].settings.focus;
assert.equal(positionedFocus.scale, 1.75);
assert.equal(positionedFocus.offsetX, -24);
assert.equal(positionedFocus.offsetY, 36);
assert.equal(normalizedLibrary.variants[2].settings.speaking.image.source, "inherit");
assert.deepEqual(normalizedLibrary.variants[2].settings.speaking.effects, []);
const hoverLibrary = normalizeActorLibrary({
  variants: [{
    id: "hover",
    name: "Hover",
    settings: { hover: { source: "custom", customSrc: "close.webp", scale: 1.5, mirrored: true } }
  }]
});
assert.equal(hoverLibrary.variants[2].settings.hover.customSrc, "close.webp");
assert.equal(hoverLibrary.variants[2].settings.hover.scale, 1.5);
assert.equal(hoverLibrary.variants[2].settings.hover.mirrored, true);
const legacyDisabledHover = normalizeActorLibrary({
  variants: [{ id: "legacy-hover", settings: { hover: { enabled: false, source: "custom", customSrc: "old.webp" } } }]
}).variants[2].settings.hover;
assert.equal(legacyDisabledHover.source, "none");
assert.equal(Object.hasOwn(legacyDisabledHover, "enabled"), false);
assert.equal(Object.hasOwn(library.variants[0].settings.hover, "enabled"), false);
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
const privateGroupLibrary = normalizeActorLibrary({
  groups: [{ id: "secret", name: "Secret", access: { mode: "gm" } }],
  defaultGroupId: "secret",
  variants: [{ id: "secretVariant", name: "Secret", groupId: "secret", access: { mode: "everyone" } }]
});
const actorWithPrivateGroup = {
  getFlag: () => privateGroupLibrary,
  testUserPermission: () => true
};
assert.equal(canUserAccessVariant(privateGroupLibrary.variants[2], actorWithPrivateGroup, guest), false);

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

const { createDefaultSceneState } = await import("../data/scene-state.js");
const { getCombinedCastState, updateCastEntry } = await import("../data/cast-service.js");
const { getPresentation } = await import("../data/scene-presentation.js");
const { resolveFocusView } = await import("../portraits/portrait-data.js");
let sceneFocus = createDefaultSceneState();
const persistentFocus = createDefaultSceneState();
sceneFocus.focus.left = { entry: createPortraitEntry("Actor.scene"), visible: true };
sceneFocus.groups.pcs.entries.push(createPortraitEntry("Actor.scene", { groupId: "pcs" }));
persistentFocus.focus.left = { entry: createPortraitEntry("Actor.shadowed"), visible: true };
persistentFocus.focus.right = { entry: createPortraitEntry("Actor.persistent"), visible: false };
visibilitySettings.set(SETTING_KEYS.PERSISTENT_STATE, persistentFocus);
const focusScene = {
  id: "focus-scene",
  getFlag: () => sceneFocus,
  setFlag: async (_module, _key, value) => { sceneFocus = value; }
};
const presented = getPresentation(focusScene, { published: true });
assert.equal(presented.focus.left.entry.actorUuid, "Actor.scene");
assert.equal(presented.focus.left.persistent, false);
assert.equal(presented.focus.right.entry.actorUuid, "Actor.persistent");
assert.equal(presented.focus.right.persistent, true);
visibilitySettings.set(SETTING_KEYS.FOCUS_IMAGE_DEFAULT_SOURCE, "hover");
const focusView = resolveFocusView({
  image: "portrait.webp", entry: { mirrored: false }, actor: { img: "actor.webp" },
  variant: { settings: { focus: { source: "inherit", mirrored: true }, hover: { source: "custom", customSrc: "hover.webp" } } }
});
assert.equal(focusView.image, "hover.webp");
assert.equal(focusView.mirrored, true);
const inheritedFocus = {
  image: "variant.webp", entry: { mirrored: false },
  actor: { img: "actor.webp", prototypeToken: { texture: { src: "token.webp" } } },
  variant: { settings: { focus: { source: "inherit", mirrored: false } } }
};
visibilitySettings.set(SETTING_KEYS.FOCUS_IMAGE_DEFAULT_SOURCE, "actor");
assert.equal(resolveFocusView(inheritedFocus).image, "actor.webp");
visibilitySettings.set(SETTING_KEYS.FOCUS_IMAGE_DEFAULT_SOURCE, "prototypeToken");
assert.equal(resolveFocusView(inheritedFocus).image, "token.webp");
visibilitySettings.set(SETTING_KEYS.FOCUS_IMAGE_DEFAULT_SOURCE, "portrait");
assert.equal(resolveFocusView(inheritedFocus).image, "actor.webp");
visibilitySettings.set(SETTING_KEYS.FOCUS_IMAGE_DEFAULT_SOURCE, "actor");
globalThis.Hooks = { callAll() {} };
globalThis.canvas = { scene: focusScene };
game.user = { isGM: true };
game.settings = playerSettings;
visibilitySettings.set(SETTING_KEYS.PREVIEW_SESSION, {});
visibilitySettings.set(SETTING_KEYS.RESERVE_ACTORS, []);
const { moveFocusZone, setFocusPersistent, setFocusVisible, syncFocusVariantForActor, updateFocusEntry } = await import("../data/scene-presentation.js");
await moveFocusZone("left", "right", { scene: focusScene });
assert.equal(getPresentation(focusScene).focus.left.entry.actorUuid, "Actor.persistent");
assert.equal(getPresentation(focusScene).focus.right.entry.actorUuid, "Actor.scene");
assert.equal(getPresentation(focusScene).focus.left.persistent, true);
assert.equal(getPresentation(focusScene).focus.right.persistent, false);
await moveFocusZone("right", "left", { scene: focusScene });
await syncFocusVariantForActor("Actor.scene", "variant-two", { scene: focusScene });
assert.equal(getPresentation(focusScene).focus.left.entry.activeVariantId, "variant-two");
assert.equal(getPresentation(focusScene).focus.right.entry.activeVariantId, null);
const { setPreviewReserve } = await import("../data/preview-service.js");
const { getReserveEntries, updateReserveEntry } = await import("../data/reserve-service.js");
const reserveCopy = createPortraitEntry("Actor.scene");
await setPreviewReserve([reserveCopy], focusScene);
await updateFocusEntry(getPresentation(focusScene).focus.left.entry.id,
  { activeVariantId: "variant-three" }, { scene: focusScene });
assert.equal(getCombinedCastState(focusScene).groups.pcs.entries[0].activeVariantId, "variant-three");
assert.equal(getReserveEntries()[0].activeVariantId, "variant-three");
await updateReserveEntry(reserveCopy.id, { activeVariantId: "variant-four" });
assert.equal(getCombinedCastState(focusScene).groups.pcs.entries[0].activeVariantId, "variant-four");
assert.equal(getPresentation(focusScene).focus.left.entry.activeVariantId, "variant-four");
const castCopy = getCombinedCastState(focusScene).groups.pcs.entries[0];
await updateCastEntry(castCopy.id, { activeVariantId: "variant-five" }, { scene: focusScene, layer: castCopy.layer });
assert.equal(getPresentation(focusScene).focus.left.entry.activeVariantId, "variant-five");
assert.equal(getReserveEntries()[0].activeVariantId, "variant-five");
await setFocusPersistent("left", true, { scene: focusScene });
const focusDraft = visibilitySettings.get(SETTING_KEYS.PREVIEW_SESSION).draft;
assert.equal(focusDraft.scene.focus.left, null);
assert.equal(focusDraft.persistent.focus.left.entry.actorUuid, "Actor.scene");
const { applyPreview, getPreviewSession } = await import("../data/preview-service.js");
const savedDraftSession = structuredClone(visibilitySettings.get(SETTING_KEYS.PREVIEW_SESSION));
visibilitySettings.set(SETTING_KEYS.PREVIEW_SESSION, {
  ...savedDraftSession,
  presetId: "obsolete-preset",
  draft: { sceneId: "obsolete-preview" },
  returnBase: savedDraftSession.base,
  returnDraft: savedDraftSession.draft
});
assert.deepEqual(getPreviewSession().draft, savedDraftSession.draft);
assert.equal(Object.hasOwn(getPreviewSession(), "presetId"), false);
visibilitySettings.set(SETTING_KEYS.PREVIEW_SESSION, savedDraftSession);
globalThis.fromUuid = async () => null;
await applyPreview(focusScene);
assert.equal(getPresentation(focusScene, { published: true }).focus.left.persistent, true);
const focusEntryId = getPresentation(focusScene).focus.left.entry.id;
await updateFocusEntry(focusEntryId, { mirrored: true }, { scene: focusScene });
await setFocusVisible("left", false, { scene: focusScene });
assert.equal(getPresentation(focusScene).focus.left.entry.mirrored, true);
assert.equal(getPresentation(focusScene).focus.left.visible, false);
await applyPreview(focusScene);
const nextScene = { id: "next-scene", getFlag: () => createDefaultSceneState() };
assert.equal(getPresentation(nextScene, { published: true }).focus.left.entry.actorUuid, "Actor.scene");
assert.equal(getPresentation(nextScene, { published: true }).focus.left.entry.mirrored, true);
assert.equal(getPresentation(nextScene, { published: true }).focus.left.visible, false);

console.log("Foundation unit tests passed.");
