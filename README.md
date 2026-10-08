# RN Portrait Stage

RN Portrait Stage is a system-agnostic Foundry VTT module for displaying character and NPC portraits in the game interface independently of scene tokens.

The module is currently in beta.

## Compatibility

- Minimum Foundry VTT version: 13
- Verified: Foundry VTT 14 (also tested on 13)

## Documentation

- [Public API](docs/API.md)

## Installation

After the beta release is published, paste this manifest URL into Foundry's **Install Module** dialog:

`https://raw.githubusercontent.com/RaiNaifa/rn-portrait-stage/master/module.json`

The matching `v0.7.0` GitHub release must include `rn-portrait-stage.zip`. Future releases must update `module.json` and upload the matching archive before the manifest version changes.

## License

MIT. See [LICENSE](LICENSE).

## Development status

Milestone 0 provides:

- module bootstrap and localization;
- world and user settings;
- versioned scene-state schema and migration registry;
- public API foundation for scene state and cast operations;
- portrait effect registry foundation;
- Foundry v13/v14 compatibility adapter.

Milestone 1 adds:

- character and NPC portrait groups;
- an ApplicationV2 cast manager opened from the button beside Scene Navigation;
- Actor drag-and-drop inside the manager;
- scene persistence, sorting, grouping, and portrait configuration;
- persistent portraits which remain visible between scene changes, merged with scene-specific portraits;
- reusable Actor portrait libraries with multiple named variants and per-cast active variants;
- per-variant labels, typography, media framing, and explicit player access policies;
- GM-controlled individual variant assignments with a global fallback variant;
- stored foundations for transitions, hover behavior, portrait effects, macros, and scripts;
- configurable labels, shared cast sizing, alpha-aware shadows, and image-masked lower gradients;
- absolutely positioned NPC grid which never moves mini-chat, wraps into columns toward the left, and reacts to chat notifications;
- GM-controlled global show/hide switch; staged entries remain saved while hidden;
- independent PC/NPC size controls and manager-card buttons for mirroring, saving between scenes, visibility, editing, and removal;
- a compact Actor reserve with full portrait-entry state and two-way drag-and-drop;
- label-font choices populated from the fonts registered in the current Foundry world;
- immediate autosave in portrait configuration and a separate activation-only variant picker;
- owner-aware Configure/Change Portrait controls on staged portraits;
- Actor, Prototype Token, and custom image sources.
