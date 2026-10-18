# RN Portrait Stage

RN Portrait Stage is a system-agnostic Foundry VTT module for displaying character and NPC portraits in the game interface independently of scene tokens.

The module is currently in beta.

## Compatibility

- Minimum Foundry VTT version: 13
- Verified: Foundry VTT 14 (also tested on 13)

## Documentation

- [Public API](docs/API.md)

## Installation

Paste this manifest URL into Foundry's **Install Module** dialog:

`https://github.com/RaiNaifa/rn-portrait-stage/releases/latest/download/module.json`

## License

MIT. See [LICENSE](LICENSE).

## Development status

The current beta includes:

- scene-specific and persistent character and NPC portrait casts, managed with Actor drag-and-drop and a reserve;
- reusable Actor portrait variants with image and video sources, labels, groups, access rules, and individual assignments for players;
- three focus slots with independent portraits, positioning, mirroring, persistence, and player attention requests;
- a shared library of image and video scene backgrounds with fit, position, dimming, and blur controls;
- a GM preview draft and separate shared and GM-only visibility controls for side portraits, focus, and backgrounds;
- enlarged hover portraits, visible-token highlighting, and Image Hover compatibility;
- experimental local voice activity indication with client controls;
- a public portrait drop API and optional `litm-rn` integration;
- English and Russian localization and compatibility with Foundry VTT 13 and 14.

Effect and automation configuration is stored, but its full visual or automatic execution is not yet implemented. The Presets tab is temporarily unavailable; existing preset data is retained.

## Using the module

Open the cast manager from the button beside Scene Navigation. Drag Actors into the side cast, reserve, or one of the three focus slots. Use the manager's preview to review cast and focus changes before applying them.

The Background tab manages the shared image and video library. Its changes apply immediately. The manager's visibility controls show or hide side portraits, focus, and backgrounds for everyone or only for the GM.
