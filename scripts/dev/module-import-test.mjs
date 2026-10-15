globalThis.foundry = {
  applications: {
    api: {
      ApplicationV2: class {},
      HandlebarsApplicationMixin: Base => class extends Base {}
    }
  },
  utils: {
    randomID: () => "test-id"
  }
};

const handlers = new Map();
globalThis.Hooks = {
  once() {},
  on(name, callback) { handlers.set(name, callback); }
};

await import("../main.js");
const { HOOKS, SETTING_KEYS } = await import("../constants.js");
const { portraitStage } = await import("../portraits/portrait-stage.js");
const { CastManager } = await import("../apps/cast-manager.js");
let stageRefreshes = 0;
portraitStage.render = () => { stageRefreshes += 1; };
CastManager.refresh = () => {};
handlers.get(HOOKS.SETTINGS_CHANGED)({ key: SETTING_KEYS.CLIENT_LAYER_VISIBILITY });
await new Promise(resolve => setTimeout(resolve, 100));
if (stageRefreshes !== 1) throw new Error("A visibility setting change did not refresh the stage.");
console.log("Module import smoke test passed.");
