import { MODULE_ID } from "../constants.js";
import { getActorLibrary, normalizeAccess, setActorLibrary } from "../data/actor-library.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class VariantGroups extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "rn-portrait-stage-variant-groups",
    classes: ["rn-portrait-stage-app", "rnps-variant-groups"],
    tag: "form",
    position: { width: 560, height: 560 },
    window: { icon: "fa-solid fa-layer-group", title: "RNPS.VariantGroups.Title", resizable: true },
    actions: {
      addGroup: VariantGroups.#addGroup,
      removeGroup: VariantGroups.#removeGroup,
      makeDefault: VariantGroups.#makeDefault
    },
    form: { closeOnSubmit: false, handler: VariantGroups.#submit }
  };

  static PARTS = { content: { template: `modules/${MODULE_ID}/templates/variant-groups.hbs` } };
  #actor;
  #timer;
  #onChange;

  constructor(actor, options = {}) {
    super(options);
    this.#actor = actor;
    this.#onChange = typeof options.onChange === "function" ? options.onChange : null;
  }

  static open(actor, options = {}) {
    if (!actor || !game.user.isGM) return null;
    return new this(actor, options).render({ force: true });
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const library = getActorLibrary(this.#actor);
    return {
      ...context,
      groups: library.groups.map(group => ({
        ...group,
        displayName: group.flags?.builtin ? game.i18n.localize("RNPS.VariantGroups.DefaultGroup") : group.name,
        isDefault: group.id === library.defaultGroupId,
        isOnly: library.groups.length === 1,
        gm: group.access.mode === "gm",
        owners: group.access.mode === "owners",
        selected: group.access.mode === "selected",
        everyone: group.access.mode === "everyone",
        users: game.users.filter(user => !user.isGM).map(user => ({
          id: user.id,
          name: user.name,
          selected: group.access.userIds.includes(user.id)
        }))
      }))
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.element.addEventListener("change", event => {
      if (event.target.matches("[name='groupAccess']")) {
        const users = event.target.closest("[data-group-id]")?.querySelector(".rnps-group-users");
        if (users) users.hidden = event.target.value !== "selected";
      }
      this.#schedule(0);
    });
    this.element.addEventListener("input", () => this.#schedule(250));
    this.#activateGroupSorting();
  }

  #activateGroupSorting() {
    const list = this.element.querySelector(".rnps-group-list");
    if (!list) return;
    for (const row of list.querySelectorAll("[data-group-id]")) {
      const handle = row.querySelector(".rnps-group-drag-handle");
      handle?.addEventListener("dragstart", event => {
        event.dataTransfer.setData("text/plain", JSON.stringify({
          type: "RNPortraitStageVariantGroup",
          groupId: row.dataset.groupId
        }));
        event.dataTransfer.effectAllowed = "move";
        row.classList.add("dragging");
      });
      handle?.addEventListener("dragend", () => row.classList.remove("dragging"));
      row.addEventListener("dragover", event => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      });
      row.addEventListener("drop", async event => {
        event.preventDefault();
        let data;
        try { data = JSON.parse(event.dataTransfer.getData("text/plain")); } catch { return; }
        if (data?.type !== "RNPortraitStageVariantGroup") return;
        const dragged = list.querySelector(`[data-group-id='${CSS.escape(data.groupId)}']`);
        if (!dragged || dragged === row) return;
        const rect = row.getBoundingClientRect();
        list.insertBefore(dragged, event.clientY > rect.top + rect.height / 2 ? row.nextElementSibling : row);
        dragged.classList.remove("dragging");
        clearTimeout(this.#timer);
        await VariantGroups.#persist(this, this.element);
      });
    }
    list.addEventListener("dragover", event => event.preventDefault());
    list.addEventListener("drop", async event => {
      if (event.target.closest("[data-group-id]")) return;
      let data;
      try { data = JSON.parse(event.dataTransfer.getData("text/plain")); } catch { return; }
      if (data?.type !== "RNPortraitStageVariantGroup") return;
      const dragged = list.querySelector(`[data-group-id='${CSS.escape(data.groupId)}']`);
      if (!dragged) return;
      list.append(dragged);
      dragged.classList.remove("dragging");
      clearTimeout(this.#timer);
      await VariantGroups.#persist(this, this.element);
    });
  }

  #schedule(delay) {
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => VariantGroups.#persist(this, this.element), delay);
  }

  static #addGroup() {
    const library = getActorLibrary(this.#actor);
    library.groups.push({
      id: foundry.utils.randomID(),
      name: game.i18n.localize("RNPS.VariantGroups.NewGroup"),
      access: { mode: "everyone", userIds: [] },
      flags: {}
    });
    setActorLibrary(this.#actor, library).then(() => {
      this.#onChange?.();
      this.render();
    });
  }

  static async #removeGroup(event, target) {
    await VariantGroups.#persist(this, this.element);
    const id = target.closest("[data-group-id]")?.dataset.groupId;
    const library = getActorLibrary(this.#actor);
    if (!id || library.groups.length <= 1) return;
    const fallback = library.groups.find(group => group.id !== id);
    library.groups = library.groups.filter(group => group.id !== id);
    if (library.defaultGroupId === id) library.defaultGroupId = fallback.id;
    for (const variant of library.variants) if (variant.groupId === id) variant.groupId = fallback.id;
    await setActorLibrary(this.#actor, library);
    this.#onChange?.();
    this.render();
  }

  static async #makeDefault(event, target) {
    await VariantGroups.#persist(this, this.element);
    const library = getActorLibrary(this.#actor);
    library.defaultGroupId = target.closest("[data-group-id]")?.dataset.groupId ?? library.defaultGroupId;
    await setActorLibrary(this.#actor, library);
    this.#onChange?.();
    this.render();
  }

  static #submit(event, form) {
    return VariantGroups.#persist(this, form);
  }

  static async #persist(app, form) {
    const library = getActorLibrary(app.#actor);
    const old = new Map(library.groups.map(group => [group.id, group]));
    library.groups = [...form.querySelectorAll("[data-group-id]")].map(row => {
      const previous = old.get(row.dataset.groupId);
      return {
        ...previous,
        id: row.dataset.groupId,
        name: row.querySelector("[name='groupName']")?.value.trim() || previous?.name || "Group",
        access: normalizeAccess({
          mode: row.querySelector("[name='groupAccess']")?.value,
          userIds: [...row.querySelectorAll("[name='groupUserIds']:checked")].map(input => input.value)
        })
      };
    });
    if (!library.groups.length) return;
    await setActorLibrary(app.#actor, library);
    app.#onChange?.();
  }
}
