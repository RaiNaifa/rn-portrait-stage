import { foundryV13Adapter } from "./foundry-v13.js";
import { foundryV14Adapter } from "./foundry-v14.js";

const adapters = new Map([
  [13, foundryV13Adapter],
  [14, foundryV14Adapter]
]);

export function getFoundryGeneration() {
  const releaseGeneration = Number(globalThis.game?.release?.generation);
  if (Number.isInteger(releaseGeneration)) return releaseGeneration;

  const version = String(globalThis.game?.version ?? "");
  return Number.parseInt(version.split(".")[0], 10);
}

export function getCompatibilityAdapter() {
  const generation = getFoundryGeneration();
  const adapter = adapters.get(generation);

  if (!adapter) {
    throw new Error(`Unsupported Foundry VTT generation: ${generation || "unknown"}`);
  }

  return adapter;
}

export function isSupportedFoundryVersion() {
  return adapters.has(getFoundryGeneration());
}
