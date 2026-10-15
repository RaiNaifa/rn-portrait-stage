import { CastManager } from "../apps/cast-manager.js";
import { HOOKS } from "../constants.js";
import { getSharedVisibility, VISIBILITY_LAYERS } from "../data/visibility-service.js";

export class NavigationButton {
  #button;
  #resizeHandler = () => this.position();
  #playerHidden = false;
  #focusControls = null;

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
      this.#createFocusControls();
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

  refresh() {
    this.#syncAppearance();
  }

  setFocusEditControls({ active, dirty, onToggle, onApply, onReset }) {
    if (!this.#focusControls) this.#createFocusControls();
    const controls = this.#focusControls;
    controls.hidden = !game.user?.isGM || !active;
    controls.querySelector("[data-rnps-focus-toggle]").onclick = onToggle;
    const apply = controls.querySelector("[data-rnps-focus-apply]");
    apply.onclick = onApply;
    apply.disabled = !dirty;
    const reset = controls.querySelector("[data-rnps-focus-reset]");
    reset.onclick = onReset;
    reset.disabled = !dirty;
    this.position();
  }

  #createFocusControls() {
    if (this.#focusControls) return;
    const controls = document.createElement("div");
    controls.id = "rnps-navigation-focus-controls";
    for (const [name, label, icon] of [
      ["toggle", "RNPS.FocusEdit.Disable", "fa-solid fa-sliders"],
      ["apply", "RNPS.FocusEdit.Apply", "fa-solid fa-check"],
      ["reset", "RNPS.FocusEdit.Discard", "fa-solid fa-rotate-left"]
    ]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ui-control rnps-navigation-focus-action";
      button.dataset[`rnpsFocus${name[0].toUpperCase()}${name.slice(1)}`] = "";
      button.title = game.i18n.localize(label);
      button.setAttribute("aria-label", button.title);
      if (name === "toggle") {
        button.classList.add("rnps-navigation-focus-toggle");
        button.setAttribute("aria-pressed", "true");
        button.innerHTML = `<i class="${icon}" aria-hidden="true"></i><span>${game.i18n.localize("RNPS.FocusEdit.Mode")}</span><span class="rnps-focus-edit-switch" aria-hidden="true"><span></span></span>`;
      } else button.innerHTML = `<i class="${icon}" aria-hidden="true"></i>`;
      controls.append(button);
    }
    controls.hidden = true;
    document.body.append(controls);
    this.#focusControls = controls;
  }

  #onClick() {
    if (game.user.isGM) return CastManager.open();
    if (!VISIBILITY_LAYERS.some(layer => getSharedVisibility()[layer])) return;
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
      const shared = getSharedVisibility();
      const worldVisible = VISIBILITY_LAYERS.some(layer => shared[layer]);
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
      if (this.#focusControls) this.#focusControls.style.display = "none";
      return;
    }

    const rect = navigation.getBoundingClientRect();
    this.#button.hidden = false;
    if (this.#focusControls) this.#focusControls.style.display = "";
    this.#button.style.left = `${rect.right + 8}px`;
    this.#button.style.top = `${rect.top}px`;
    if (this.#focusControls) {
      this.#focusControls.style.left = `${rect.right + 48}px`;
      this.#focusControls.style.top = `${rect.top}px`;
    }
  }

  destroy() {
    window.removeEventListener("resize", this.#resizeHandler);
    this.#button?.remove();
    this.#button = null;
    this.#focusControls?.remove();
    this.#focusControls = null;
  }
}

export const navigationButton = new NavigationButton();
