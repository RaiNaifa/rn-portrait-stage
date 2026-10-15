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
- GM-controlled visibility for side portraits, focus art, and scene background; staged entries remain saved while hidden;
- independent PC/NPC size controls and manager-card buttons for mirroring, saving between scenes, visibility, editing, and removal;
- a compact Actor reserve with full portrait-entry state and two-way drag-and-drop;
- label-font choices populated from the fonts registered in the current Foundry world;
- immediate autosave in portrait configuration and a separate activation-only variant picker;
- owner-aware Configure/Change Portrait controls on staged portraits;
- Actor, Prototype Token, and custom image sources.

## Scene presentation

The cast manager can prepare three independent focus slots (left, center, right) by dragging Actor cards from the cast or reserve, dragging between focus slots, or dropping a world Actor from the Actors directory. Dropping into focus copies the Actor without removing it from the source. Each slot can be hidden without clearing its Actor. The side cast can remain visible or be hidden while focus art is shown. Manager edits use a draft with Apply and Reset controls; a GM can enable Apply immediately to publish each subsequent edit and any already pending draft changes. A GM can also publish a focus assignment immediately from the button on a side portrait. The world setting for the initial Actor variant chooses the Actor portrait or prototype token for a new cast, reserve, or focus entry when that Actor has no saved portrait library; changing it does not alter existing entries.

Focus cards use the same top and bottom action groups as side portraits: edit and remove above, mirror, keep between scenes, and show or hide below. Persistent focus assignments retain their zone across scene changes and appear whenever that scene has no assignment in the zone. A variant can choose its portrait image, hover image, or its own image for focus; the world setting selects the default from hover, actor portrait, or prototype token portrait. Focus mirroring, scale, and pixel offsets are separate from portrait and hover settings. GMs can enable focus editing in the cast manager, drag focus images to move them, and scroll over them to resize; Escape or the same toggle exits the mode. The mode remains active across scene changes.

Focus slots share the screen width between 300-pixel side margins, with a configurable pixel gap in module settings. The margins shrink on narrower windows. Art fits within the viewport height minus 100 pixels and remains beneath Foundry's interface, including the hotbar.

The world shares one library of image and video background variants. The manager's Background tab and right-hand panel show preview cards arranged in collapsible groups, searchable by background or group name; cards can be dragged between groups and sorted. A Foundry Scene can be dropped into a group to add its background image and name. Cards have immediate activation, settings, and removal controls. A separate header button keeps the current active background when changing Foundry scenes and follows later background selections. Activation and variant edits take effect immediately, without applying the scene draft. Common browser images (`png`, `jpg`, `jpeg`, `webp`, `gif`, `avif`) and the module's video paths (`webm`, `mp4`, `m4v`, `ogv`, `ogg`) are recognized; actual codec playback depends on the client's browser. Each background has its own fit, position, dimming, and blur. Displaying the background over the interface is reserved for a later release; its control is disabled.

The Presets tab is reserved for a future redesign. Its earlier controls are currently unavailable. Previously stored preset data is retained in the hidden world setting but is not loaded or applied.

At the top of the cast manager, an All control precedes three controls for side portraits, focus art, and the scene background. Each has an eye button for everyone and an eye button for the GM's own view. All switches the three layers together. These changes take effect immediately and are stored outside scene drafts. The player's existing single visibility button remains unchanged.

Visible-token highlighting on portrait hover is controlled by one world setting in the module settings. Changing it updates connected clients without a world reload.
