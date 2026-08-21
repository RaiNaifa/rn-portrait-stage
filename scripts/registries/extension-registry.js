export class ExtensionRegistry {
  #items = new Map();
  #label;

  constructor(label) {
    this.#label = label;
  }

  register(definition) {
    const id = definition?.id;
    if (typeof id !== "string" || !id.includes(".")) {
      throw new TypeError(`${this.#label} IDs must be namespaced strings.`);
    }
    if (this.#items.has(id)) {
      throw new Error(`${this.#label} '${id}' is already registered.`);
    }

    const stored = Object.freeze({ ...definition });
    this.#items.set(id, stored);
    return stored;
  }

  unregister(id) {
    return this.#items.delete(id);
  }

  get(id) {
    return this.#items.get(id) ?? null;
  }

  has(id) {
    return this.#items.has(id);
  }

  list() {
    return [...this.#items.values()];
  }
}
