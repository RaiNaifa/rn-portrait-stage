# RN Portrait Stage

RN Portrait Stage is a system-agnostic Foundry VTT module for displaying character and NPC portraits in the game interface independently of scene tokens.

The module is currently in the Scene Portraits MVP stage.

## Compatibility

- Minimum Foundry VTT version: 13
- Verified: Foundry VTT 13
- Foundry VTT 14 support is designed into the compatibility layer but must be verified in a running v14 world before it is declared in `module.json`.

## Documentation

- [Technical specification](docs/TECHNICAL_SPECIFICATION.md)

## Development status

Milestone 0 provides:

- module bootstrap and localization;
- world and user settings;
- versioned scene-state schema and migration registry;
- public API skeleton;
- portrait effect registry foundation;
- Foundry v13/v14 compatibility adapter.

Milestone 1 adds:

- character and NPC portrait groups;
- an ApplicationV2 cast manager opened from the button beside Scene Navigation;
- Actor drag-and-drop inside the manager;
- scene persistence, sorting, grouping, and portrait configuration;
- Actor, Prototype Token, and custom image sources.
