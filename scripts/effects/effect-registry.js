import { EFFECT_SCHEMA_VERSION } from "../constants.js";
import { ExtensionRegistry } from "../registries/extension-registry.js";

const VALID_TRIGGERS = new Set([
  "hover",
  "speaking",
  "selected",
  "active-turn",
  "manual",
  "portrait-change",
  "always"
]);

export class EffectRegistry {
  #engines = new ExtensionRegistry("Effect engine");
  #presets = new ExtensionRegistry("Effect preset");

  registerEngine(id, engine) {
    if (!engine || typeof engine.play !== "function" || typeof engine.stop !== "function") {
      throw new TypeError("An effect engine must provide play() and stop() methods.");
    }
    return this.#engines.register({ id, engine });
  }

  registerPreset(definition) {
    if (definition?.schemaVersion !== EFFECT_SCHEMA_VERSION) {
      throw new Error(`Effect preset '${definition?.id ?? "unknown"}' has an unsupported schema version.`);
    }
    if (!this.#engines.has(definition.engine)) {
      throw new Error(`Unknown effect engine '${definition.engine}'.`);
    }
    if (!VALID_TRIGGERS.has(definition.trigger)) {
      throw new Error(`Unknown effect trigger '${definition.trigger}'.`);
    }
    return this.#presets.register(definition);
  }

  getEngine(id) {
    return this.#engines.get(id)?.engine ?? null;
  }

  getPreset(id) {
    return this.#presets.get(id);
  }

  listEngines() {
    return this.#engines.list().map(item => item.id);
  }

  listPresets() {
    return this.#presets.list();
  }
}
