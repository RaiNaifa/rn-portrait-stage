import { CastManager } from "../apps/cast-manager.js";

export class NavigationButton {
  #button;
  #resizeHandler = () => this.position();

  initialize() {
    if (!game.user.isGM) {
      this.destroy();
      return;
    }
    if (!this.#button) {
      this.#button = document.createElement("button");
      this.#button.id = "rn-portrait-stage-navigation-button";
      this.#button.type = "button";
      this.#button.className = "ui-control icon faded-ui";
      this.#button.title = game.i18n.localize("RNPS.Controls.OpenManager");
      this.#button.setAttribute("aria-label", this.#button.title);

      const icon = document.createElement("i");
      icon.className = "fa-solid fa-masks-theater";
      icon.setAttribute("aria-hidden", "true");
      this.#button.append(icon);
      this.#button.addEventListener("click", () => CastManager.open());
      document.body.append(this.#button);
      window.addEventListener("resize", this.#resizeHandler);
    }
    this.position();
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
