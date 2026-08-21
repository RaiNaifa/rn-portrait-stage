# Changelog

## 0.5.0 — Unreleased

- Added a GM-only client draft for previewing cast, reserve, ordering, sizes, visibility, mirroring, and active or individual variants before publishing.
- Preview drafts survive leaving preview and browser refreshes; resetting explicitly restores the published state.
- Kept public stage visibility independent from GM preview visibility.
- Added world-level cast presets with preview, merge, scene replacement, persistent replacement, full replacement, and independent reserve modes.
- Preset preview is an editable preset session: save updates that preset and reset restores its last saved snapshot.
- Added thematic Actor variant groups, a default group, group access controls, and grouped variant selection.
- Added grouped drag-and-drop variant ordering in the portrait editor and fixed the grouped ApplicationV2 picker template root.
- Added active portrait thumbnails to preset cards, with PCs ordered left-to-right and NPCs right-to-left.
- Added cast and reserve application modes to an active preset preview.
- Separated the Preview button's active styling from its unsaved-draft dot indicator.
- Kept Actor variant definitions outside preview drafts and presets; cast snapshots reference stable variant IDs.

## 0.4.1 — Unreleased

- Made portrait visibility fully GM-controlled and removed the client hide setting.
- Removed the obsolete default portrait-size setting; unconfigured groups use an internal 160px default and manager sizes remain authoritative.
- Added a client portrait scale from 50% to 150%.
- Made portrait spacing and PC/NPC offsets world settings controlled by the GM.
- Added world PC/NPC directions plus client overrides which inherit the GM value by default.
- Split experimental voice activation into a world permission and a client opt-in enabled by default.
- Made debug logging client-scoped and removed the unused reduced-motion setting; browser `prefers-reduced-motion` remains supported.

## 0.4.0 — Unreleased

- Added per-variant ApplicationV2 settings for labels, typography, media framing, transitions, hover behavior, effects foundations, and GM automation metadata.
- Added explicit variant access modes: GM only, Actor owners, selected players, or everyone.
- Added a world setting allowing Actor owners to configure variants available to them without exposing GM-only variants or controls.
- Allowed explicitly authorized non-owners to open Change Portrait and activate accessible variants for everyone.
- Added GM-only per-user variant assignments, assignment management, and indicators on staged and manager portraits.
- Added per-user active variant resolution while preserving one global fallback variant.
- Added scene schema v4 and Actor portrait-library schema v2 normalization.

## 0.3.1 — 2026-08-21

- Prevented empty custom portrait variants from being activated while keeping them as editable drafts.
- Added explicit empty-image placeholders in the portrait editor and variant picker.
- Added looping video portrait playback throughout the stage, manager, editor, and variant picker.
- Moved portrait labels into the editor preview area and added the Actor name to the ApplicationV2 window header.
- Placed mini-chat notifications above NPC portraits without changing portrait opacity.
- Fixed staged label wrapping, Foundry tooltips, mirrored action placement, and inactive Scene navigation layout.

## 0.3.0

- Added persistent and scene-specific cast layers with scene overrides.
- Added reusable Actor portrait libraries with multiple variants.
- Added configurable labels and manager-controlled shared portrait size.
- Removed portrait frames and container backgrounds; added alpha-aware shadows and masked gradients.
- Added adaptive NPC height around mini-chat and notification-aware opacity.
- Changed NPC overflow to left-growing columns without scrollbars and made the right group absolute so it cannot move chat.
- Added a GM-controlled global portrait visibility switch.
- Reworked variants into tiles with activation buttons and fixed Actor portrait/token variants.
- Changed the label font setting to a dropdown and portrait-size increments to one pixel.
- Fixed CSS mask URLs resolving relative to the module stylesheet.
- Replaced the cast-layer selector with per-portrait persistence controls; new PCs persist by default.
- Split PC and NPC portrait sizes and added schema migration v2 to v3.
- Added a compact world-level Actor reserve to the manager footer.
- Added mirror, persistence, hide/show, configure, and remove controls to portrait cards in the manager (not the main game UI).
- Reserve entries now retain their portrait state and support two-way drag-and-drop.
- Fixed variant add/edit/activate controls by using ApplicationV2 actions and per-tile form parsing.
- NPC opacity now reacts only to visible mini-chat notifications instead of the persistent notification container.
- Removed Actor Sheet opening from manager names and enabled dragging from the entire card, including its image.
- Font choices now come from the fonts registered by Foundry, the system, and active modules.
- Deferred font-setting registration until `ready`, after modules such as `ru-ru` extend `CONFIG.fontDefinitions`.
- Replaced portrait-editor submission with immediate debounced autosave and removed placement, cast label override, and default-variant controls.
- Added Actor name, Prototype Token name, hidden, and custom label modes.
- Added owner-aware Configure and Change Portrait buttons to staged UI portraits plus a settings-free variant picker.
- Preserved one combined manual order across scene/persistent layers when toggling Save between Scenes.
- Changed active highlights to `rgb(255 179 0)` and mirrored manager previews immediately.

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
