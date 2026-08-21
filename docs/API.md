# RN Portrait Stage API

> API status: Scene Portraits MVP (`apiVersion: 1`). Variants, presets, and voice methods remain placeholders.

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

The current scene-state schema version is `1`. The state contains `pcs` and `npcs` groups with entry arrays.

## Portrait cast operations

All write operations currently require a Gamemaster.

```js
const entry = await api.portraits.show("Actor.actorId", {
  scene: canvas.scene,
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
```

## Register a hover block

Extension IDs must be namespaced:

```js
api.hover.registerBlock({
  id: "my-package.statuses",
  label: "Statuses",
  packageId: "my-package",
  isAvailable: context => true,
  getData: async context => ({})
});
```

## Register an action

```js
api.actions.register({
  id: "my-package.toggle-status",
  label: "Toggle status",
  icon: "fa-solid fa-toggle-on",
  execute: async context => {}
});
```

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
