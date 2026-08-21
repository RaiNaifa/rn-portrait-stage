import { API_VERSION, MODULE_ID } from "./constants.js";
import { getCompatibilityAdapter, getFoundryGeneration } from "./compatibility/index.js";
import { getUiAnchorSelectors, resolveUiAnchor } from "./compatibility/ui-anchors.js";
import { createDefaultSceneState, getSceneState, setSceneState } from "./data/scene-state.js";
import { registerSceneMigration } from "./data/migrations.js";
import { EffectRegistry } from "./effects/effect-registry.js";
import { cssEffectEngine } from "./effects/css-engine.js";
import { ExtensionRegistry } from "./registries/extension-registry.js";
import {
  addActorToCast,
  clearCast,
  moveCastEntry,
  removeCastEntry,
  updateCastEntry
} from "./data/cast-service.js";

function notImplemented(feature) {
  throw new Error(`${MODULE_ID} | ${feature} is not implemented in Milestone 0.`);
}

export function createPublicApi() {
  const hoverBlocks = new ExtensionRegistry("Hover block");
  const actions = new ExtensionRegistry("Portrait action");
  const imageResolvers = new ExtensionRegistry("Image resolver");
  const effects = new EffectRegistry();

  effects.registerEngine(`${MODULE_ID}.css`, cssEffectEngine);

  return Object.freeze({
    apiVersion: API_VERSION,

    compatibility: Object.freeze({
      get generation() {
        return getFoundryGeneration();
      },
      get adapter() {
        return getCompatibilityAdapter();
      },
      get anchors() {
        return getUiAnchorSelectors();
      },
      resolveAnchor: resolveUiAnchor
    }),

    state: Object.freeze({
      createDefault: createDefaultSceneState,
      get: getSceneState,
      set: setSceneState,
      registerMigration: registerSceneMigration
    }),

    hover: Object.freeze({
      registerBlock: definition => hoverBlocks.register(definition),
      unregisterBlock: id => hoverBlocks.unregister(id),
      getBlock: id => hoverBlocks.get(id),
      listBlocks: () => hoverBlocks.list()
    }),

    actions: Object.freeze({
      register: definition => actions.register(definition),
      unregister: id => actions.unregister(id),
      get: id => actions.get(id),
      list: () => actions.list()
    }),

    images: Object.freeze({
      registerResolver: definition => imageResolvers.register(definition),
      unregisterResolver: id => imageResolvers.unregister(id),
      getResolver: id => imageResolvers.get(id),
      listResolvers: () => imageResolvers.list()
    }),

    effects: Object.freeze({
      registerEngine: (id, engine) => effects.registerEngine(id, engine),
      registerPreset: definition => effects.registerPreset(definition),
      getEngine: id => effects.getEngine(id),
      getPreset: id => effects.getPreset(id),
      listEngines: () => effects.listEngines(),
      listPresets: () => effects.listPresets()
    }),

    portraits: Object.freeze({
      show: (actorUuid, options) => addActorToCast(actorUuid, options),
      hide: (entryId, options) => removeCastEntry(entryId, options),
      move: (entryId, options) => moveCastEntry(entryId, options),
      update: (entryId, changes, options) => updateCastEntry(entryId, changes, options),
      clear: options => clearCast(options)
    }),

    variants: Object.freeze({
      apply: () => notImplemented("Portrait variants")
    }),

    presets: Object.freeze({
      save: () => notImplemented("Scene presets"),
      load: () => notImplemented("Scene presets"),
      remove: () => notImplemented("Scene presets")
    }),

    voice: Object.freeze({
      setGmActor: () => notImplemented("Voice activation"),
      setGmRouting: () => notImplemented("Voice activation"),
      getState: () => Object.freeze({ enabled: false, speaking: false })
    })
  });
}
