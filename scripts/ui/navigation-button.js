import { CastManager } from "../apps/cast-manager.js";
import { HOOKS, MODULE_ID, SETTING_KEYS } from "../constants.js";

export class NavigationButton {
  #button;
  #resizeHandler = () => this.position();
  #playerHidden = false;

  initialize() {
    if (!this.#button) {
      this.#button = document.createElement("button");
      this.#button.id = "rn-portrait-stage-navigation-button";
      this.#button.type = "button";
      this.#button.className = "ui-control icon faded-ui";
      const icon = document.createElement("i");
      icon.className = "fa-solid fa-masks-theater";
      icon.setAttribute("aria-hidden", "true");
      this.#button.append(icon);
      this.#button.addEventListener("click", () => this.#onClick());
      document.body.append(this.#button);
      window.addEventListener("resize", this.#resizeHandler);
    }
    this.#syncAppearance();
    this.position();
  }

  isPlayerHidden() {
    return !game.user?.isGM && this.#playerHidden;
  }

  revealForSceneChange() {
    const changed = !game.user?.isGM && this.#playerHidden;
    if (changed) this.#playerHidden = false;
    this.#syncAppearance();
    return changed;
  }

  #onClick() {
    if (game.user.isGM) return CastManager.open();
    if (!game.settings.get(MODULE_ID, SETTING_KEYS.STAGE_ENABLED)) return;
    this.#playerHidden = !this.#playerHidden;
    this.#syncAppearance();
    Hooks.callAll(HOOKS.STATE_CHANGED, { clientVisibility: true });
  }

  #syncAppearance() {
    if (!this.#button) return;
    const icon = this.#button.querySelector("i");
    if (game.user?.isGM) {
      this.#button.disabled = false;
      this.#button.title = game.i18n.localize("RNPS.Controls.OpenManager");
      if (icon) icon.className = "fa-solid fa-masks-theater";
      this.#button.classList.remove("active");
    } else {
      const worldVisible = game.settings.get(MODULE_ID, SETTING_KEYS.STAGE_ENABLED);
      this.#button.disabled = !worldVisible;
      this.#button.title = game.i18n.localize(!worldVisible
        ? "RNPS.Controls.PortraitsHiddenByGm"
        : this.#playerHidden ? "RNPS.Controls.ShowPortraitsClient" : "RNPS.Controls.HidePortraitsClient");
      if (icon) icon.className = `fa-solid ${!worldVisible || this.#playerHidden ? "fa-eye-slash" : "fa-eye"}`;
      this.#button.classList.toggle("active", this.#playerHidden);
    }
    this.#button.setAttribute("aria-label", this.#button.title);
  }

  position() {
    if (!this.#button) return;
    const navigation = document.querySelector("#scene-navigation");
    if (!navigation) {
      this.#button.hidden = true;
      return;
    }

    const rect = navigation.getBoundingClientRect();
    this.#button.hidden = false;
    this.#button.style.left = `${rect.right + 8}px`;
    this.#button.style.top = `${rect.top}px`;
  }

  destroy() {
    window.removeEventListener("resize", this.#resizeHandler);
    this.#button?.remove();
    this.#button = null;
  }
}

export const navigationButton = new NavigationButton();
