import assert from "node:assert/strict";
import { SETTING_KEYS } from "../constants.js";

class FakeImage extends EventTarget {
  complete = false;
  naturalWidth = 0;
  set src(value) {
    this.currentSrc = value;
    queueMicrotask(() => {
      this.complete = true;
      this.naturalWidth = 100;
      this.dispatchEvent(new Event("load"));
    });
  }
  get src() { return this.currentSrc; }
}
globalThis.HTMLVideoElement = class extends EventTarget {};
globalThis.document = { createElement: () => new FakeImage() };
globalThis.foundry = { utils: { randomID: () => "request-1" } };
const messages = [];
let changes = 0;
globalThis.Hooks = { callAll: () => { changes += 1; } };
const users = [
  { id: "gm", active: true, isGM: true },
  { id: "player", active: true, isGM: false }
];
globalThis.game = {
  user: users[0],
  users: { contents: users, get: id => users.find(user => user.id === id) },
  i18n: { localize: key => key },
  settings: { get: (_module, key) => key === SETTING_KEYS.BACKGROUND_LIBRARY
    ? { groups: [], backgrounds: [{ id: "forest", src: "forest.webp" }] } : null },
  socket: { emit: (_channel, message) => messages.push(message) }
};

const { getBackgroundPreloadStatus, handleBackgroundPreloadMessage, requestBackgroundPreload } = await import("../data/background-preload.js");
assert.equal(getBackgroundPreloadStatus("forest", "forest.webp").state, "idle");
await requestBackgroundPreload("forest", "forest.webp");
assert.equal(messages[0].type, "preload-background");
assert.equal(getBackgroundPreloadStatus("forest", "forest.webp").state, "loading");
await handleBackgroundPreloadMessage({ type: "background-preload-result", backgroundId: "forest", requestId: "request-1", userId: "player", ok: true });
assert.deepEqual(getBackgroundPreloadStatus("forest", "forest.webp"), { state: "ready", ready: 1, total: 1 });
assert.ok(changes >= 3);
console.log("Background preload tests passed.");
