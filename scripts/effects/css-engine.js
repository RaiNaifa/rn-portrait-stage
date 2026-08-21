const activeClasses = new WeakMap();

export const cssEffectEngine = Object.freeze({
  play(element, preset) {
    if (!(element instanceof HTMLElement)) {
      throw new TypeError("CSS portrait effects require an HTMLElement target.");
    }

    const className = preset.options?.className;
    if (typeof className !== "string" || !className.startsWith("rn-portrait-stage--")) {
      throw new TypeError("CSS effect class names must start with 'rn-portrait-stage--'.");
    }

    element.classList.add(className);
    const classes = activeClasses.get(element) ?? new Set();
    classes.add(className);
    activeClasses.set(element, classes);
  },

  update(element, preset) {
    this.stop(element, preset);
    this.play(element, preset);
  },

  stop(element, preset) {
    const className = preset.options?.className;
    if (typeof className === "string") element.classList.remove(className);
    activeClasses.get(element)?.delete(className);
  },

  destroy(element) {
    for (const className of activeClasses.get(element) ?? []) {
      element.classList.remove(className);
    }
    activeClasses.delete(element);
  }
});
