# Changelog

All notable changes to RN Portrait Stage will be documented in this file.

## 0.2.0 — 2026-08-21

### Added

- Persistent character and NPC portrait groups anchored to the Foundry v13 interface.
- Portrait Stage button positioned to the right of Scene Navigation.
- ApplicationV2 scene cast manager with Actor drag-and-drop.
- Reordering and moving entries between character and NPC groups.
- Portrait entry editor with Actor, Prototype Token, and custom image sources.
- Scene flag persistence and public API cast operations.
- Per-user portrait size, spacing, offsets, direction, and visibility settings.
- GM portrait controls and Actor Sheet opening.
- Permission filtering, missing Actor placeholders, and broken image fallbacks.

### Changed

- Direct drag-and-drop onto the canvas or portrait overlay is intentionally not intercepted. Actor drops outside the manager retain normal Foundry behavior.

## 0.1.0 — 2026-08-21

### Added

- Initial Foundry VTT module manifest and ES module bootstrap.
- English and Russian localization.
- World and per-user settings foundation.
- Versioned scene-state schema with migration registry.
- Public API skeleton and extension registries.
- Portrait effect schema and CSS engine foundation.
- Foundry v13/v14 compatibility adapter.
