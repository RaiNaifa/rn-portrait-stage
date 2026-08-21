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

globalThis.Hooks = {
  once() {},
  on() {}
};

await import("../main.js");
console.log("Module import smoke test passed.");
