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
    getFlag: () => flag,
    setFlag: async (_module, _key, value) => { flag = structuredClone(value); }
  };
  scenes.push(scene);
  return scene;
}
const first = makeScene("first");
const second = makeScene("second");
globalThis.canvas = { scene: first };

const { addBackgroundVariant, addBackgroundGroup, getBackgroundLibrary, moveBackgroundGroup, moveBackgroundVariant, updateBackgroundVariant, removeBackgroundVariant, importLegacySceneBackgrounds } = await import("../data/background-library.js");
const { activateSceneBackground, deactivateSceneBackground, getPresentation, setBackgroundFollowActive } = await import("../data/scene-presentation.js");
const { ensurePreviewDraft, getPreviewLayer, getPreviewSession, setPreviewAutoApply, setPreviewLayer } = await import("../data/preview-service.js");
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
await setBackgroundFollowActive(true);
assert.equal(getSceneState(first).activeBackgroundId, null);
assert.equal(getPresentation(second).activeBackgroundId, forest.id);
assert.equal(getPresentation(second).backgroundFollowActive, true);
await updateBackgroundVariant(forest.id, { dim: 35 });
assert.equal(getPresentation(second).background.dim, 35);
assert.equal(getPreviewLayer("scene", first).layout.pcPortraitSize, 220);

await activateSceneBackground(castle.id, { scene: second });
assert.equal(getPresentation(second).activeBackgroundId, castle.id);
assert.equal(getPresentation(first).activeBackgroundId, castle.id);
assert.equal(getPersistentState().backgroundId, castle.id);
await deactivateSceneBackground({ scene: second });
assert.equal(getPresentation(second).activeBackgroundId, null);
assert.equal(getPresentation(first).activeBackgroundId, null);
await activateSceneBackground(castle.id, { scene: second });
assert.equal(getPresentation(second).activeBackgroundId, castle.id);
await setBackgroundFollowActive(false, { scene: second });
assert.equal(getPresentation(second).activeBackgroundId, castle.id);
assert.equal(getPresentation(first).activeBackgroundId, null);
assert.equal(getPersistentState().backgroundId, null);

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
