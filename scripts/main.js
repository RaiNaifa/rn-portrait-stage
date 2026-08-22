import { HOOKS, MODULE_ID, MODULE_TITLE, SETTING_KEYS } from "./constants.js";
import { createPublicApi } from "./api.js";
import { getCompatibilityAdapter, isSupportedFoundryVersion } from "./compatibility/index.js";
import { logger } from "./logger.js";
import { refreshFontChoices, registerSettings } from "./settings.js";
import { CastManager } from "./apps/cast-manager.js";
import { portraitStage } from "./portraits/portrait-stage.js";
import { navigationButton } from "./ui/navigation-button.js";
import { initializeSocketService } from "./data/socket-service.js";
import { syncPreviewScene } from "./data/preview-service.js";
import { registerLitmIntegration } from "./integrations/litm-rn.js";
import { voiceController } from "./voice/voice-controller.js";

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

  refreshFontChoices();
  initializeSocketService();
  const adapter = getCompatibilityAdapter();
  const api = game.modules.get(MODULE_ID)?.api;
  registerLitmIntegration(api);
  registerVoiceAction(api);
  voiceController.initialize();

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

Hooks.on("canvasReady", async () => {
  await syncPreviewScene(canvas.scene);
  portraitStage.render();
  navigationButton.position();
  CastManager.refresh();
});

Hooks.on("updateScene", scene => {
  if (scene.id !== canvas.scene?.id) return;
  scheduleUiRefresh();
});

Hooks.on("updateActor", () => {
  scheduleUiRefresh();
});

Hooks.on("deleteActor", () => {
  scheduleUiRefresh();
});
Hooks.on("updateUser", () => scheduleUiRefresh());

Hooks.on("renderSceneNavigation", () => navigationButton.position());
Hooks.on("collapseSceneNavigation", () => requestAnimationFrame(() => navigationButton.position()));
Hooks.on(HOOKS.SETTINGS_CHANGED, () => {
  scheduleUiRefresh();
});
Hooks.on(HOOKS.STATE_CHANGED, () => scheduleUiRefresh());
Hooks.on(HOOKS.SPEAKING_CHANGED, ({ actorUuid, speaking }) => {
  portraitStage.setSpeaking(actorUuid, speaking);
});
Hooks.on(HOOKS.LAYOUT_CHANGED, () => requestAnimationFrame(() => navigationButton.position()));
window.addEventListener("beforeunload", () => voiceController.stop());

let uiRefreshTimer;
function scheduleUiRefresh() {
  clearTimeout(uiRefreshTimer);
  uiRefreshTimer = setTimeout(() => {
    portraitStage.render();
    CastManager.refresh();
  }, 75);
}

function registerVoiceAction(api) {
  api?.actions.register({
    id: `${MODULE_ID}.voice`,
    order: 110,
    icon: ({ entry, actor }) => {
      const assignedOnline = game.users.find(
        user => user.active && !user.isGM && user.character?.uuid === actor.uuid
      );
      return assignedOnline && !voiceController.isEnabled(entry)
        ? "fa-solid fa-microphone-slash"
        : "fa-solid fa-microphone";
    },
    label: "RNPS.Controls.VoiceActivation",
    isVisible: ({ actor }) => game.settings.get(MODULE_ID, SETTING_KEYS.EXPERIMENTAL_VOICE_ALLOWED)
      && voiceController.canControl(actor),
    isActive: ({ entry, actor }) => {
      const assignedOnline = game.users.find(
        user => user.active && !user.isGM && user.character?.uuid === actor.uuid
      );
      return game.user.isGM && !assignedOnline
        ? voiceController.isGmActor(actor.uuid)
        : !voiceController.isEnabled(entry);
    },
    onClick: context => voiceController.toggleEntry(context.view)
  });
}
