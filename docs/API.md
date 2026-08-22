# RN Portrait Stage API

> API status: Scene Portraits, Hover Extensions, and experimental Voice Activation (`apiVersion: 1`).

Access the API after the `rnPortraitStageReady` hook:

```js
Hooks.once("rnPortraitStageReady", api => {
  console.log(api.apiVersion);
});
```

Or retrieve it directly after Foundry is ready:

```js
const api = game.modules.get("rn-portrait-stage")?.api;
```

## Scene state

```js
const state = api.state.get(canvas.scene);
await api.state.set(canvas.scene, state);
```

The current scene-state schema version is `5`. The state contains `pcs` and `npcs` groups with entry arrays, independent PC/NPC portrait-size overrides, and a scene-level token-highlight override.

`api.state.getLayers(scene)` returns the persistent and scene-specific layers. `api.state.getCombined(scene)` returns the effective cast; a scene entry overrides a persistent entry for the same Actor.

## Portrait cast operations

All write operations currently require a Gamemaster.

```js
const entry = await api.portraits.show("Actor.actorId", {
  scene: canvas.scene,
  layer: "scene", // or "persistent"
  groupId: "pcs"
});

await api.portraits.move(entry.id, {
  scene: canvas.scene,
  groupId: "npcs",
  index: 0
});

await api.portraits.update(entry.id, {
  visible: true,
  image: {
    source: "custom",
    customSrc: "portraits/example.webp"
  }
});

await api.portraits.hide(entry.id);
await api.portraits.clear({ scene: canvas.scene, groupId: "npcs" });
await api.portraits.setSize(180, { scene: canvas.scene, layer: "scene", groupId: "npcs" });
```

## Actor portrait variants

Variant libraries persist in Actor flags and remain available after the Actor is removed from a cast.

```js
const actor = game.actors.get("actorId");
const library = api.variants.getLibrary(actor);
await api.variants.setLibrary(actor, library);
await api.variants.apply(entry.id, "angry", { layer: "scene" });
```

## Register a hover block

Extension IDs must be namespaced:

```js
api.hover.registerBlock({
  id: "my-package.statuses",
  order: 100,
  isVisible: context => context.actor.type === "character",
  render: async context => {
    const element = document.createElement("div");
    element.textContent = context.actor.name;
    return element;
  }
});
```

`render` may return one `HTMLElement`, an HTML string with one root element, or `null`. Context contains `card`, `view`, `entry`, `actor`, `variant`, and `groupId`. Blocks are ordered by `order`; asynchronous results are discarded after the pointer leaves the portrait.

## Register an action

```js
api.actions.register({
  id: "my-package.toggle-status",
  label: "Toggle status",
  icon: "fa-solid fa-toggle-on",
  order: 100,
  isVisible: context => game.user.isGM,
  isActive: context => context.entry.flags?.["my-package"]?.enabled,
  onClick: async context => context.updateEntry({
    flags: { "my-package": { enabled: true } }
  })
});
```

Registered actions are placed beside the built-in lower portrait action. `onClick` receives the hover context plus `updateEntry(changes)`.

## litm-rn example integration

When the active system is `litm-rn`, RN Portrait Stage registers `litm-rn.toggle-tags` and `litm-rn.tags`. The action stores `flags["litm-rn"].tagsVisible` on the cast entry; the hover block renders visible tag, status, and might Active Effects. This is the reference implementation for system integrations.

## Effects foundation

The core CSS engine is registered as `rn-portrait-stage.css`. A preset must use effect schema version `1` and a supported trigger.

```js
api.effects.registerPreset({
  id: "my-package.hover-glow",
  schemaVersion: 1,
  engine: "rn-portrait-stage.css",
  trigger: "hover",
  options: {
    className: "rn-portrait-stage--hover-glow"
  }
});
```

The renderer that applies registered presets to portrait elements is scheduled for the Portrait FX milestone.
