import assert from "node:assert/strict";
import { SETTING_KEYS } from "../constants.js";

let id = 0;
globalThis.foundry = { utils: {
  randomID: () => `test-${++id}`,
  deepClone: value => structuredClone(value)
} };
globalThis.Hooks = { callAll() {} };

const settings = new Map([
  [SETTING_KEYS.BACKGROUND_LIBRARY, { groups: [{ id: "default", name: "Default" }], backgrounds: [] }],
  [SETTING_KEYS.BACKGROUND_DEFAULT_FIT, "contain-blur"],
  [SETTING_KEYS.PREVIEW_SESSION, {}],
  [SETTING_KEYS.RESERVE_ACTORS, []]
]);
const scenes = [];
globalThis.game = {
  release: { generation: 13 },
  user: { isGM: true },
  i18n: { localize: key => key },
  scenes: { contents: scenes },
  settings: {
    get: (_module, key) => settings.get(key),
    set: async (_module, key, value) => { settings.set(key, structuredClone(value)); }
  }
};
function makeScene(id, initial = null) {
  let flag = initial;
  const scene = {
    id,
    name: id,
    getFlag: () => flag,
    setFlag: async (_module, _key, value) => { flag = structuredClone(value); }
  };
  scenes.push(scene);
  return scene;
}
const first = makeScene("first");
const second = makeScene("second");
const third = makeScene("third");
globalThis.canvas = { scene: first };

const { addBackgroundVariant, addBackgroundGroup, getBackgroundLibrary, getBackgroundSceneAssignments, moveBackgroundGroup, moveBackgroundVariant, updateBackgroundVariant, removeBackgroundVariant, importLegacySceneBackgrounds } = await import("../data/background-library.js");
const { activateSceneBackground, deactivateSceneBackground, getPresentation, setBackgroundFollowActive } = await import("../data/scene-presentation.js");
const { ensurePreviewDraft, getPreviewLayer, getPreviewSession, setPreviewAutoApply, setPreviewLayer, syncImmediateBackgroundSelection } = await import("../data/preview-service.js");
const { getSceneState } = await import("../data/scene-state.js");
const { getPersistentState } = await import("../data/persistent-state.js");

const forest = await addBackgroundVariant({ src: "forest.webp", name: "Forest" });
assert.equal(forest.fit, "contain-blur");
settings.set(SETTING_KEYS.BACKGROUND_DEFAULT_FIT, "cover");
const castle = await addBackgroundVariant({ src: "castle.webp", name: "Castle" });
assert.equal(castle.fit, "cover");
assert.equal(getBackgroundLibrary().backgrounds.find(item => item.id === forest.id).fit, "contain-blur");
const group = await addBackgroundGroup("Places");
const laterGroup = await addBackgroundGroup("Later");
await moveBackgroundGroup(laterGroup.id, group.id);
assert.deepEqual(getBackgroundLibrary().groups.map(item => item.id), ["default", laterGroup.id, group.id]);
await moveBackgroundGroup(group.id, "default");
assert.deepEqual(getBackgroundLibrary().groups.map(item => item.id), ["default", group.id, laterGroup.id]);
await moveBackgroundVariant(castle.id, group.id);
assert.equal(getBackgroundLibrary().backgrounds.find(item => item.id === castle.id).groupId, group.id);
await moveBackgroundVariant(forest.id, group.id, castle.id);
assert.deepEqual(getBackgroundLibrary().backgrounds.filter(item => item.groupId === group.id).map(item => item.id), [forest.id, castle.id]);
assert.equal(getBackgroundLibrary().backgrounds.length, 2);

await ensurePreviewDraft(first);
const draft = getPreviewLayer("scene", first);
draft.layout.pcPortraitSize = 220;
await setPreviewLayer("scene", draft, first);
await activateSceneBackground(forest.id);
assert.equal(getSceneState(first).activeBackgroundId, forest.id);
assert.equal(getPreviewLayer("scene", first).activeBackgroundId, forest.id);
assert.equal(getPreviewLayer("scene", first).layout.pcPortraitSize, 220);

assert.equal(getPreviewSession().dirty, true);

await activateSceneBackground(castle.id, { scene: second });
assert.equal(getPresentation(second).activeBackgroundId, castle.id);
globalThis.canvas.scene = third;
await ensurePreviewDraft(third);
assert.equal(getPresentation(third).activeBackgroundId, null);
globalThis.canvas.scene = first;
await ensurePreviewDraft(first);
await setBackgroundFollowActive(true);
assert.equal(getSceneState(first).activeBackgroundId, forest.id);
assert.equal(getPresentation(second).activeBackgroundId, castle.id);
assert.equal(getPresentation(third).activeBackgroundId, forest.id);
globalThis.canvas.scene = third;
await ensurePreviewDraft(third);
assert.equal(getPresentation(third).activeBackgroundId, forest.id);
const stalePersistent = getPreviewLayer("persistent", third);
stalePersistent.backgroundId = null;
stalePersistent.backgroundFollowActive = false;
await setPreviewLayer("persistent", stalePersistent, third);
assert.equal(getPresentation(third).activeBackgroundId, forest.id);
await syncImmediateBackgroundSelection(third);
globalThis.canvas.scene = first;
await ensurePreviewDraft(first);
assert.equal(getSceneState(third).activeBackgroundId, null);
assert.deepEqual(getBackgroundSceneAssignments().get(forest.id), ["first"]);
assert.deepEqual(getBackgroundSceneAssignments().get(castle.id), ["second"]);
assert.equal(getPresentation(second).backgroundFollowActive, true);
await updateBackgroundVariant(forest.id, { dim: 35 });
assert.equal(getPresentation(third).background.dim, 35);
assert.equal(getPreviewLayer("scene", first).layout.pcPortraitSize, 220);

// Applying an old portrait draft on an empty scene must preserve the
// published background selection, including the pinned fallback.
const empty = makeScene("empty");
globalThis.canvas.scene = empty;
await ensurePreviewDraft(empty);
const oldSession = getPreviewSession();
oldSession.draft.persistent.backgroundId = null;
oldSession.draft.persistent.backgroundFollowActive = false;
oldSession.draft.scene.backgroundSuppressed = true;
settings.set(SETTING_KEYS.PREVIEW_SESSION, oldSession);
assert.equal(getPresentation(empty).activeBackgroundId, forest.id);
await setPreviewAutoApply(true, empty);
assert.equal(getPresentation(empty).activeBackgroundId, forest.id);
assert.equal(getSceneState(empty).activeBackgroundId, null);
assert.equal(Object.hasOwn(getSceneState(empty), "backgroundSuppressed"), false);
assert.equal(getPersistentState().backgroundId, forest.id);
await setPreviewAutoApply(false, empty);
game.user.isGM = false;
assert.equal(getPresentation(empty).activeBackgroundId, forest.id);
game.user.isGM = true;
globalThis.canvas.scene = first;
await ensurePreviewDraft(first);

// A scene with no assignment always uses the pinned fallback.
const hidden = makeScene("hidden");
assert.equal(await deactivateSceneBackground({ scene: hidden }), false);
assert.equal(getPresentation(hidden).activeBackgroundId, forest.id);
assert.equal(getPresentation(third).activeBackgroundId, forest.id);
assert.equal(getPresentation(empty).sceneBackgroundId, null);
await activateSceneBackground(forest.id, { scene: empty });
assert.equal(getPresentation(empty).sceneBackgroundId, forest.id);
await deactivateSceneBackground({ scene: empty });
assert.equal(getPresentation(empty).sceneBackgroundId, null);
assert.equal(getPresentation(empty).activeBackgroundId, forest.id);

// The eye button removes the scene assignment, then the pinned fallback shows.
const disabledLocal = makeScene("disabled-local");
await activateSceneBackground(castle.id, { scene: disabledLocal });
await deactivateSceneBackground({ scene: disabledLocal });
assert.equal(getSceneState(disabledLocal).activeBackgroundId, null);
assert.equal(Object.hasOwn(getSceneState(disabledLocal), "backgroundSuppressed"), false);
assert.equal(getPresentation(disabledLocal).activeBackgroundId, forest.id);
game.user.isGM = false;
assert.equal(getPresentation(disabledLocal).activeBackgroundId, forest.id);
game.user.isGM = true;

globalThis.canvas.scene = second;
await ensurePreviewDraft(second);
assert.equal(getPresentation(second).activeBackgroundId, castle.id);
game.user.isGM = false;
assert.equal(getPresentation(second).activeBackgroundId, castle.id);
game.user.isGM = true;
globalThis.canvas.scene = first;
await ensurePreviewDraft(first);

globalThis.canvas.scene = third;
await ensurePreviewDraft(third);
await activateSceneBackground(castle.id);
assert.equal(getSceneState(third).activeBackgroundId, castle.id);
assert.equal(getPresentation(third).activeBackgroundId, castle.id);
assert.deepEqual(getBackgroundSceneAssignments().get(castle.id), ["second", "third"]);
assert.equal(getPersistentState().backgroundId, forest.id);
await deactivateSceneBackground();
assert.equal(getPresentation(third).activeBackgroundId, forest.id);
assert.equal(getSceneState(third).activeBackgroundId, null);
assert.deepEqual(getBackgroundSceneAssignments().get(castle.id), ["second"]);
assert.equal(getPresentation(first).activeBackgroundId, forest.id);
await setBackgroundFollowActive(false, { scene: third });
assert.equal(getPresentation(second).activeBackgroundId, castle.id);
assert.equal(getPresentation(first).activeBackgroundId, forest.id);
assert.equal(getPresentation(third).activeBackgroundId, null);
assert.equal(getPresentation(disabledLocal).activeBackgroundId, null);
assert.equal(getSceneState(third).activeBackgroundId, null);
assert.equal(getPersistentState().backgroundId, null);
globalThis.canvas.scene = first;
await ensurePreviewDraft(first);

const legacy = makeScene("legacy", {
  schemaVersion: 9,
  backgrounds: [{ id: "legacy-background", src: "old.webp", name: "Old" }],
  activeBackgroundId: "legacy-background",
  background: { src: "old.webp" }
});
await importLegacySceneBackgrounds();
assert.equal(getSceneState(legacy).backgrounds.length, 0);
assert.equal(getPresentation(legacy).background.src, "old.webp");
assert.equal(getBackgroundLibrary().backgrounds.length, 3);

await removeBackgroundVariant(forest.id);
assert.equal(getPresentation(first).activeBackgroundId, null);
assert.equal(getPersistentState().backgroundId, null);
assert.equal(getPersistentState().backgroundFollowActive, false);
assert.equal(getPreviewLayer("scene", first).layout.pcPortraitSize, 220);

await setPreviewAutoApply(true, first);
assert.equal(getSceneState(first).layout.pcPortraitSize, 220);
assert.equal(getPreviewSession().dirty, false);
const autoDraft = getPreviewLayer("scene", first);
autoDraft.layout.pcPortraitSize = 240;
await setPreviewLayer("scene", autoDraft, first);
assert.equal(getSceneState(first).layout.pcPortraitSize, 240);
assert.equal(getPreviewSession().dirty, false);
await setPreviewAutoApply(false, first);
const manualDraft = getPreviewLayer("scene", first);
manualDraft.layout.pcPortraitSize = 260;
await setPreviewLayer("scene", manualDraft, first);
assert.equal(getSceneState(first).layout.pcPortraitSize, 240);
assert.equal(getPreviewSession().dirty, true);

console.log("Background library and selection tests passed.");
