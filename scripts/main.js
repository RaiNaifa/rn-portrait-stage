import { HOOKS, MODULE_ID, MODULE_TITLE } from "./constants.js";
import { createPublicApi } from "./api.js";
import { getCompatibilityAdapter, isSupportedFoundryVersion } from "./compatibility/index.js";
import { logger } from "./logger.js";
import { registerSettings } from "./settings.js";
import { CastManager } from "./apps/cast-manager.js";
import { portraitStage } from "./portraits/portrait-stage.js";
import { navigationButton } from "./ui/navigation-button.js";

Hooks.once("init", () => {
  logger.info(`Initializing ${MODULE_TITLE}`);
  registerSettings();

  const module = game.modules.get(MODULE_ID);
  if (!module) {
    logger.error("The module package is unavailable during init.");
    return;
  }

  module.api = createPublicApi();
});

Hooks.once("ready", () => {
  if (!isSupportedFoundryVersion()) {
    const message = game.i18n.localize("RNPS.Notifications.UnsupportedVersion");
    ui.notifications.error(message, { permanent: true });
    logger.error(message);
    return;
  }

  const adapter = getCompatibilityAdapter();
  const api = game.modules.get(MODULE_ID)?.api;

  portraitStage.initialize();
  navigationButton.initialize();

  logger.info(`${MODULE_TITLE} ready`, {
    apiVersion: api?.apiVersion,
    foundryGeneration: adapter.generation,
    systemId: game.system.id,
    systemVersion: game.system.version
  });

  Hooks.callAll(HOOKS.READY, api);
});

Hooks.on("canvasReady", () => {
  portraitStage.render();
  navigationButton.position();
  CastManager.refresh();
});

Hooks.on("updateScene", scene => {
  if (scene.id !== canvas.scene?.id) return;
  portraitStage.render();
  CastManager.refresh();
});

Hooks.on("updateActor", () => {
  portraitStage.render();
  CastManager.refresh();
});

Hooks.on("deleteActor", () => {
  portraitStage.render();
  CastManager.refresh();
});

Hooks.on("renderSceneNavigation", () => navigationButton.position());
Hooks.on("collapseSceneNavigation", () => requestAnimationFrame(() => navigationButton.position()));
Hooks.on(HOOKS.SETTINGS_CHANGED, () => portraitStage.render());
Hooks.on(HOOKS.LAYOUT_CHANGED, () => requestAnimationFrame(() => navigationButton.position()));
