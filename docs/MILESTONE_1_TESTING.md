# Milestone 1 — Foundry v13 smoke test

Perform this checklist before the Milestone 1 git commit.

## Startup

- [ ] Reload the Foundry v13 world with RN Portrait Stage enabled.
- [ ] Confirm there are no red console errors from `rn-portrait-stage`.
- [ ] Confirm the Portrait Stage button appears immediately to the right of Scene Navigation.
- [ ] Resize the window and collapse/expand Scene Navigation; confirm the button follows it.

## Manager

- [ ] Click the Portrait Stage button.
- [ ] Confirm the ApplicationV2 manager opens with Characters and NPC groups.
- [ ] Drag an Actor from the Actors directory into Characters.
- [ ] Drag another Actor into NPCs.
- [ ] Drag entries to reorder them.
- [ ] Drag an entry between groups.
- [ ] Close and reopen the manager; confirm the composition remains.
- [ ] Confirm dragging an Actor onto the canvas still creates a normal token and does not add a portrait.

## Portrait display

- [ ] Confirm character portraits appear in the left UI group.
- [ ] Confirm Characters appear to the left of Scene Navigation rather than below it.
- [ ] Confirm adding many navigation Scenes does not push character portraits downward.
- [ ] Hide/remove all character portraits and confirm the left column returns to its normal width.
- [ ] Confirm NPC portraits appear in the right UI group.
- [ ] Double-click a portrait and confirm its Actor Sheet opens.
- [ ] Hover a portrait as GM and confirm edit, move, and remove controls appear.
- [ ] Remove an entry and confirm the Actor and Token documents are not deleted.

## Editor and settings

- [ ] Open the portrait editor.
- [ ] Select Actor portrait and save.
- [ ] Select Prototype Token image and save.
- [ ] Select a custom image and save.
- [ ] Toggle the portrait visibility and save.
- [ ] Change portrait size and spacing in settings.
- [ ] Change group offsets and direction.
- [ ] Confirm settings affect only the current user.

## Persistence and permissions

- [ ] Reload the world and confirm the scene composition persists.
- [ ] Change the viewed Scene and confirm each Scene has an independent composition.
- [ ] Log in as a player and confirm GM controls are absent.
- [ ] Confirm the manager button is absent for a player.
- [ ] Confirm the player sees every portrait explicitly added by the GM, including NPCs the player does not own.
- [ ] Confirm a player without LIMITED permission cannot open that Actor Sheet by double-clicking its portrait.
- [ ] Confirm the module works on a Scene with no Tokens.
