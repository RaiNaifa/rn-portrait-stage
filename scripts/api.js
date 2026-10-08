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
  getCastLayers,
  getCombinedCastState,
  moveCastEntry,
  removeCastEntry,
  setCastPortraitSize,
  updateCastEntry
} from "./data/cast-service.js";
import { getActorLibrary, getActorVariant, setActorLibrary } from "./data/actor-library.js";
import { voiceController } from "./voice/voice-controller.js";

export function createPublicApi() {
  const hoverBlocks = new ExtensionRegistry("Hover block");
  const actions = new ExtensionRegistry("Portrait action");
  const dropHandlers = new ExtensionRegistry("Portrait drop handler");
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
      registerMigration: registerSceneMigration,
      getLayers: getCastLayers,
      getCombined: getCombinedCastState
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

    drop: Object.freeze({
      register: definition => {
        if (typeof definition?.canDrop !== "function" || typeof definition?.onDrop !== "function") {
          throw new TypeError("Portrait drop handlers require canDrop and onDrop functions.");
        }
        return dropHandlers.register(definition);
      },
      unregister: id => dropHandlers.unregister(id),
      get: id => dropHandlers.get(id),
      list: () => dropHandlers.list()
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
      clear: options => clearCast(options),
      setSize: (size, options) => setCastPortraitSize(size, options)
    }),

    variants: Object.freeze({
      getLibrary: actor => getActorLibrary(actor),
      setLibrary: (actor, library) => setActorLibrary(actor, library),
      getActive: (actor, variantId) => getActorVariant(actor, variantId),
      apply: (entryId, activeVariantId, options) => updateCastEntry(
        entryId,
        { activeVariantId },
        options
      )
    }),

    voice: Object.freeze({
      setGmActor: actorUuid => voiceController.setGmActor(actorUuid),
      setGmRouting: enabled => voiceController.setGmRouting(enabled),
      getState: () => voiceController.getState()
    })
  });
}
