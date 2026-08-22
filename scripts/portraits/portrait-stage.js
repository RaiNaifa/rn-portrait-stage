import { GROUP_IDS, HOOKS, MODULE_ID, SETTING_KEYS } from "../constants.js";
import { getCombinedCastState, updateCastEntry } from "../data/cast-service.js";
import { resolveUiAnchor } from "../compatibility/ui-anchors.js";
import { preparePortraitView } from "./portrait-data.js";
import { PortraitEditor } from "../apps/portrait-editor.js";
import { VariantPicker } from "../apps/variant-picker.js";
import { createPortraitMedia } from "../media.js";
import { canUserAccessVariant } from "../data/actor-library.js";
import { isPreviewActive } from "../data/preview-service.js";
import { getCompatibilityAdapter } from "../compatibility/index.js";
import { isImageHoverActive, withImageHoverSuppressed } from "../integrations/image-hover.js";
import { voiceController } from "../voice/voice-controller.js";

export class PortraitStage {
  #groups = new Map();
  #renderVersion = 0;
  #rightUiObserver = null;
  #notificationObserver = null;
  #resizeObserver = null;
  #resizeHandler = () => this.#updateRightColumnLayout();
  #hoverLayer = null;
  #hoverArt = null;
  #hoverBlocks = null;
  #hoverVersion = 0;
  #highlightedTokens = [];

  initialize() {
    for (const groupId of Object.values(GROUP_IDS)) {
      if (this.#groups.has(groupId)) continue;
      const group = document.createElement("section");
      group.className = `rn-portrait-stage rnps-stage-group rnps-stage-group--${groupId}`;
      group.dataset.groupId = groupId;
      group.setAttribute("aria-live", "polite");
      group.setAttribute("aria-label", game.i18n.localize(
        groupId === GROUP_IDS.PCS ? "RNPS.Groups.Pcs" : "RNPS.Groups.Npcs"
      ));
      this.#groups.set(groupId, group);
    }
    this.#attachGroups();
    this.#createHoverLayer();
    this.#observeRightColumn();
    window.addEventListener("resize", this.#resizeHandler);
    this.render();
  }

  destroy() {
    document.querySelector("#ui-left-column-2")?.classList.remove("rnps-pc-layout");
    document.querySelector("#ui-right-column-1")?.classList.remove("rnps-npc-layout");
    for (const group of this.#groups.values()) group.remove();
    this.#hideHover();
    this.#hoverLayer?.remove();
    this.#hoverLayer = null;
    this.#groups.clear();
    this.#rightUiObserver?.disconnect();
    this.#notificationObserver?.disconnect();
    this.#resizeObserver?.disconnect();
    window.removeEventListener("resize", this.#resizeHandler);
  }

  async render() {
    this.#hideHover();
    this.#attachGroups();
    if (!this.#groups.size) return;
    const version = ++this.#renderVersion;
    const visible = game.settings.get(MODULE_ID, SETTING_KEYS.STAGE_ENABLED) || isPreviewActive();
    for (const group of this.#groups.values()) group.classList.toggle("rnps-preview-stage", isPreviewActive());
    for (const group of this.#groups.values()) group.hidden = !visible;
    if (!visible) {
      this.#setPcLayoutActive(false);
      return;
    }

    const scene = canvas.scene;
    const state = getCombinedCastState(scene);
    const tokenHighlight = state.layout.tokenHighlight
      ?? game.settings.get(MODULE_ID, SETTING_KEYS.TOKEN_HIGHLIGHT_DEFAULT);

    for (const groupId of Object.values(GROUP_IDS)) {
      const views = await Promise.all(
        state.groups[groupId].entries.map(entry => preparePortraitView(entry))
      );
      if (version !== this.#renderVersion) return;
      this.#renderGroup(groupId, views.filter(view => view?.visible), tokenHighlight);
    }

    this.#applySettings();
    this.#updateRightColumnLayout();
  }

  #attachGroups() {
    const left = resolveUiAnchor("leftSecondary");
    const right = resolveUiAnchor("rightPrimary");
    const pcs = this.#groups.get(GROUP_IDS.PCS);
    const npcs = this.#groups.get(GROUP_IDS.NPCS);

    if (left && pcs && pcs.parentElement !== left) left.append(pcs);
    if (right && npcs && npcs.parentElement !== right) right.append(npcs);
    right?.classList.add("rnps-npc-layout");
    const notifications = document.querySelector("#chat-notifications");
    if (right && npcs && notifications?.parentElement === right && npcs.nextSibling !== notifications) {
      right.insertBefore(npcs, notifications);
    }
  }

  #renderGroup(groupId, views, tokenHighlight) {
    const group = this.#groups.get(groupId);
    group.replaceChildren();

    for (const view of views) {
      const card = document.createElement("article");
      card.className = "rnps-portrait";
      card.dataset.entryId = view.id;
      card.dataset.actorUuid = view.actorUuid;
      card.tabIndex = 0;
      card.dataset.layer = view.entry.layer;
      card.dataset.voiceEnabled = String(voiceController.isEnabled(view.entry));
      card.classList.toggle(
        "rnps-speaking",
        voiceController.isEnabled(view.entry) && voiceController.isSpeaking(view.actorUuid)
      );

      const imageLayer = document.createElement("div");
      imageLayer.className = "rnps-portrait-image";
      const mediaSettings = view.variant.settings?.media ?? {};
      const mediaTransform = `translate(${mediaSettings.offsetX ?? 0}px, ${mediaSettings.offsetY ?? 0}px) scale(${mediaSettings.scale ?? 1})`;
      imageLayer.style.setProperty("--rnps-media-transform", mediaTransform);
      imageLayer.style.setProperty("--rnps-media-fit", mediaSettings.fit ?? "contain");
      imageLayer.style.setProperty("--rnps-media-opacity", String(mediaSettings.opacity ?? 1));
      imageLayer.classList.toggle(
        "rnps-portrait-image--mirrored",
        Boolean(view.entry.mirrored) !== Boolean(mediaSettings.mirrored)
      );

      const image = createPortraitMedia(view.image);
      if (image instanceof HTMLVideoElement) image.playbackRate = mediaSettings.playbackRate ?? 1;
      imageLayer.style.setProperty("--rnps-image", cssUrl(image.src));
      image.addEventListener("error", () => {
        if (image.src !== CONST.DEFAULT_TOKEN) {
          image.src = CONST.DEFAULT_TOKEN;
          imageLayer.style.setProperty("--rnps-image", cssUrl(image.src));
        }
      }, { once: true });
      imageLayer.append(image);
      card.append(imageLayer);

      if (view.label) {
        const name = document.createElement("span");
        name.className = "rnps-portrait-name";
        name.textContent = view.label;
        const labelSettings = view.variant.settings?.label;
        if (labelSettings?.inherit === false) {
          if (labelSettings.fontFamily) name.style.fontFamily = labelSettings.fontFamily;
          if (labelSettings.fontSize) name.style.fontSize = `${labelSettings.fontSize}px`;
          if (labelSettings.color) name.style.color = labelSettings.color;
          if (labelSettings.shadowColor) name.style.textShadow = `0 1px 2px ${labelSettings.shadowColor}, 0 0 5px ${labelSettings.shadowColor}`;
          name.style.textAlign = labelSettings.align ?? "center";
        }
        card.append(name);
      }

      const canConfigure = game.user.isGM || (
        view.actor.testUserPermission(game.user, "OWNER")
        && game.settings.get(MODULE_ID, SETTING_KEYS.ALLOW_OWNER_VARIANT_CONFIGURATION)
      );
      const canSwitch = game.user.isGM || (
        game.settings.get(MODULE_ID, SETTING_KEYS.ALLOW_PLAYER_PORTRAIT_CHANGES)
        && view.library.variants.some(variant => canUserAccessVariant(variant, view.actor))
      );
      if (canConfigure) {
        card.append(
          this.#portraitButton("rnps-ui-configure", "fa-solid fa-gear", "RNPS.Controls.Edit", () => {
            PortraitEditor.open(view.id, view.entry.layer);
          })
        );
      }
      if (canSwitch) {
        card.append(
          this.#portraitButton("rnps-ui-switch", "fa-solid fa-images", "RNPS.Controls.ChangePortrait", () => {
            VariantPicker.open(view.id, view.entry.layer);
          })
        );
      }
      if (game.user.isGM && view.personalizedUsers > 0) {
        const indicator = document.createElement("span");
        indicator.className = "rnps-ui-assignment-indicator";
        indicator.dataset.tooltip = `${game.i18n.format("RNPS.Controls.PersonalizedUsers", { count: view.personalizedUsers })}\n${view.personalizedSummary}`;
        for (const assignment of view.personalizedVariants) {
          const item = document.createElement("span");
          item.className = "rnps-ui-assignment-variant";
          item.dataset.tooltip = assignment.tooltip;
          const thumbnail = createPortraitMedia(assignment.image);
          item.append(thumbnail);
          const count = document.createElement("b");
          count.textContent = String(assignment.count);
          item.append(count);
          indicator.append(item);
        }
        card.append(indicator);
      }

      this.#renderRegisteredActions(card, view, groupId);

      card.addEventListener("mouseenter", () => this.#showHover(card, view, groupId, tokenHighlight));
      card.addEventListener("mouseleave", () => this.#hideHover());

      card.addEventListener("dblclick", () => {
        if (view.canOpenSheet) view.actor.sheet?.render({ force: true });
      });
      card.addEventListener("keydown", event => {
        if (event.key === "Enter" && view.canOpenSheet) {
          view.actor.sheet?.render({ force: true });
        }
      });
      group.append(card);
    }

    if (groupId === GROUP_IDS.PCS) this.#setPcLayoutActive(views.length > 0);
  }

  setSpeaking(actorUuid, speaking) {
    for (const group of this.#groups.values()) {
      for (const card of group.querySelectorAll(".rnps-portrait")) {
        if (card.dataset.actorUuid !== actorUuid) continue;
        card.classList.toggle("rnps-speaking", speaking && card.dataset.voiceEnabled === "true");
        const voiceButton = card.querySelector('[data-rnps-action="rn-portrait-stage.voice"]');
        const assignedOnline = game.users.find(
          user => user.active && !user.isGM && user.character?.uuid === actorUuid
        );
        if (voiceButton && game.user.isGM) {
          const enabled = card.dataset.voiceEnabled === "true";
          voiceButton.classList.toggle(
            "active",
            assignedOnline ? !enabled : voiceController.isGmActor(actorUuid)
          );
          const icon = voiceButton.querySelector("i");
          icon?.classList.toggle("fa-microphone", !assignedOnline || enabled);
          icon?.classList.toggle("fa-microphone-slash", Boolean(assignedOnline) && !enabled);
        }
      }
    }
  }

  #setPcLayoutActive(active) {
    const column = document.querySelector("#ui-left-column-2");
    if (!column) return;
    const changed = column.classList.contains("rnps-pc-layout") !== active;
    column.classList.toggle("rnps-pc-layout", active);
    if (changed) Hooks.callAll(HOOKS.LAYOUT_CHANGED, { active });
  }

  #portraitButton(className, icon, titleKey, callback) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `rnps-ui-action ${className}`;
    const tooltip = game.i18n.localize(titleKey);
    button.dataset.tooltip = tooltip;
    button.setAttribute("aria-label", tooltip);
    button.innerHTML = `<i class="${icon}" aria-hidden="true"></i>`;
    button.addEventListener("click", event => {
      event.stopPropagation();
      callback();
    });
    return button;
  }

  #createHoverLayer() {
    if (this.#hoverLayer?.isConnected) return;
    const layer = document.createElement("div");
    layer.className = "rnps-hover-layer";
    const art = document.createElement("div");
    art.className = "rnps-hover-art";
    const blocks = document.createElement("div");
    blocks.className = "rnps-hover-blocks";
    layer.append(art, blocks);
    document.body.append(layer);
    this.#hoverLayer = layer;
    this.#hoverArt = art;
    this.#hoverBlocks = blocks;
  }

  async #showHover(card, view, groupId, tokenHighlight) {
    this.#createHoverLayer();
    const version = ++this.#hoverVersion;
    this.#hideTokenHighlight();
    const imageHoverMode = game.settings.get(MODULE_ID, SETTING_KEYS.IMAGE_HOVER_PRIORITY);
    const imageHoverCanCompete = tokenHighlight && isImageHoverActive();
    this.#positionHover(card, groupId);
    let artRendered = false;
    if (imageHoverCanCompete && imageHoverMode === "imageHover") {
      const highlighted = this.#showTokenHighlight(view.actor);
      if (!highlighted) artRendered = this.#renderHoverArt(view, groupId);
    } else {
      artRendered = this.#renderHoverArt(view, groupId);
      if (tokenHighlight) {
        this.#showTokenHighlight(view.actor, {
          suppressImageHover: imageHoverMode === "rnps" && artRendered
        });
      }
    }
    this.#hoverBlocks.replaceChildren();
    const api = game.modules.get(MODULE_ID)?.api;
    const context = { card, view, entry: view.entry, actor: view.actor, variant: view.variant, groupId };
    for (const block of (api?.hover?.listBlocks?.() ?? []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) {
      try {
        if (block.isVisible && !await block.isVisible(context)) continue;
        const rendered = await block.render?.(context);
        if (version !== this.#hoverVersion) return;
        if (!rendered) continue;
        const element = rendered instanceof HTMLElement ? rendered : htmlToElement(String(rendered));
        if (element) {
          element.dataset.rnpsHoverBlock = block.id;
          this.#hoverBlocks.append(element);
        }
      } catch (error) {
        console.error(`${MODULE_ID} | Hover block '${block.id}' failed`, error);
      }
    }
    this.#hoverLayer.hidden = !this.#hoverArt.childElementCount && !this.#hoverBlocks.childElementCount;
  }

  #renderHoverArt(view, groupId) {
    this.#hoverArt.replaceChildren();
    const hover = view.variant.settings?.hover ?? {};
    if (hover.enabled === false) return false;
    const configured = hover.source === "inherit" || !hover.source
      ? game.settings.get(MODULE_ID, SETTING_KEYS.HOVER_ART_DEFAULT_SOURCE)
      : hover.source;
    if (configured === "none") return false;
    let source;
    if (configured === "prototypeToken") source = view.actor.prototypeToken?.texture?.src || view.actor.img;
    else if (configured === "custom") source = hover.customSrc;
    else source = view.actor.img || view.actor.prototypeToken?.texture?.src;
    if (!source) return false;
    const media = createPortraitMedia(source);
    media.classList.toggle("mirrored", hover.mirrored === true);
    const worldScale = game.settings.get(MODULE_ID, SETTING_KEYS.HOVER_ART_WORLD_SCALE) / 100;
    const clientScale = game.settings.get(MODULE_ID, SETTING_KEYS.HOVER_ART_SCALE) / 100;
    this.#hoverArt.style.setProperty(
      "--rnps-hover-scale",
      String((hover.scale ?? 1) * worldScale * clientScale)
    );
    this.#hoverArt.dataset.side = groupId === GROUP_IDS.NPCS ? "right" : "left";
    this.#hoverArt.append(media);
    return true;
  }

  #positionHover(card, groupId) {
    const rect = card.getBoundingClientRect();
    const bottom = game.settings.get(MODULE_ID, SETTING_KEYS.HOVER_ART_BOTTOM_OFFSET);
    this.#hoverArt.style.bottom = `${bottom}px`;
    this.#hoverBlocks.style.top = `${Math.max(8, rect.top)}px`;
    if (groupId === GROUP_IDS.NPCS) {
      this.#hoverBlocks.dataset.side = "right";
      const right = window.innerWidth - rect.left + 8;
      this.#hoverArt.style.right = `${right}px`;
      this.#hoverArt.style.left = "auto";
      this.#hoverBlocks.style.right = `${right}px`;
      this.#hoverBlocks.style.left = "auto";
    } else {
      this.#hoverBlocks.dataset.side = "left";
      const left = rect.right + 8;
      this.#hoverArt.style.left = `${left}px`;
      this.#hoverArt.style.right = "auto";
      this.#hoverBlocks.style.left = `${left}px`;
      this.#hoverBlocks.style.right = "auto";
    }
  }

  #showTokenHighlight(actor, { suppressImageHover = false } = {}) {
    const tokens = canvas.tokens?.placeables?.filter(token => (
      token.actor?.uuid === actor.uuid
      && token.visible !== false
      && token.isVisible !== false
      && (game.user.isGM || token.document?.hidden !== true)
    )) ?? [];
    this.#highlightedTokens = tokens.filter(token => !token.hover);
    const adapter = getCompatibilityAdapter();
    this.#highlightedTokens.forEach(token => {
      const hover = () => adapter.hoverToken(token, { hoverOutOthers: false });
      if (suppressImageHover) withImageHoverSuppressed(hover);
      else hover();
    });
    return tokens.length;
  }

  #hideTokenHighlight() {
    const adapter = getCompatibilityAdapter();
    for (const token of this.#highlightedTokens) adapter.unhoverToken(token);
    this.#highlightedTokens = [];
  }

  #hideHover() {
    this.#hoverVersion += 1;
    this.#hideTokenHighlight();
    this.#hoverArt?.replaceChildren();
    this.#hoverBlocks?.replaceChildren();
    if (this.#hoverLayer) this.#hoverLayer.hidden = true;
  }

  #renderRegisteredActions(card, view, groupId) {
    const api = game.modules.get(MODULE_ID)?.api;
    const definitions = (api?.actions?.list?.() ?? []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    let actionIndex = 0;
    for (const definition of definitions) {
      try {
        const context = { card, view, entry: view.entry, actor: view.actor, variant: view.variant, groupId };
        if (definition.isVisible && !definition.isVisible(context)) continue;
        const button = this.#portraitButton(
          "rnps-ui-extension-action",
          typeof definition.icon === "function"
            ? definition.icon(context)
            : definition.icon ?? "fa-solid fa-puzzle-piece",
          definition.label ?? definition.id,
          async () => {
            try {
              await definition.onClick?.({
                ...context,
                updateEntry: changes => updateCastEntry(view.id, changes, { layer: view.entry.layer })
              });
            } catch (error) {
              console.error(`${MODULE_ID} | Portrait action '${definition.id}' failed`, error);
              ui.notifications.error(error.message);
            }
          }
        );
        button.style.setProperty("--rnps-action-index", String(actionIndex));
        button.dataset.rnpsAction = definition.id;
        actionIndex += 1;
        button.classList.toggle("active", Boolean(definition.isActive?.(context)));
        card.append(button);
      } catch (error) {
        console.error(`${MODULE_ID} | Portrait action '${definition.id}' failed`, error);
      }
    }
  }

  #applySettings() {
    const state = getCombinedCastState(canvas.scene);
    const fallbackSize = 160;
    const scale = game.settings.get(MODULE_ID, SETTING_KEYS.PORTRAIT_SCALE) / 100;
    const pcSize = (state.layout.pcPortraitSize ?? fallbackSize) * scale;
    const npcSize = (state.layout.npcPortraitSize ?? fallbackSize) * scale;
    const gap = game.settings.get(MODULE_ID, SETTING_KEYS.PORTRAIT_GAP);
    const fontFamily = game.settings.get(MODULE_ID, SETTING_KEYS.LABEL_FONT_FAMILY);
    const fontSize = game.settings.get(MODULE_ID, SETTING_KEYS.LABEL_FONT_SIZE);

    for (const [groupId, directionKey, directionOverrideKey, offsetXKey, offsetYKey] of [
      [GROUP_IDS.PCS, SETTING_KEYS.PC_DIRECTION, SETTING_KEYS.PC_DIRECTION_OVERRIDE, SETTING_KEYS.PC_OFFSET_X, SETTING_KEYS.PC_OFFSET_Y],
      [GROUP_IDS.NPCS, SETTING_KEYS.NPC_DIRECTION, SETTING_KEYS.NPC_DIRECTION_OVERRIDE, SETTING_KEYS.NPC_OFFSET_X, SETTING_KEYS.NPC_OFFSET_Y]
    ]) {
      const group = this.#groups.get(groupId);
      const size = groupId === GROUP_IDS.PCS ? pcSize : npcSize;
      group.style.setProperty("--rnps-size", `${size}px`);
      group.style.setProperty("--rnps-gap", `${gap}px`);
      group.style.setProperty("--rnps-label-font", fontFamily || "Signika");
      group.style.setProperty("--rnps-label-font-size", `${fontSize}px`);
      group.style.setProperty("--rnps-offset-x", `${game.settings.get(MODULE_ID, offsetXKey)}px`);
      group.style.setProperty("--rnps-offset-y", `${game.settings.get(MODULE_ID, offsetYKey)}px`);
      const directionOverride = game.settings.get(MODULE_ID, directionOverrideKey);
      group.dataset.direction = directionOverride === "inherit"
        ? game.settings.get(MODULE_ID, directionKey)
        : directionOverride;
    }

    const leftColumn = document.querySelector("#ui-left-column-2");
    const pcGroup = this.#groups.get(GROUP_IDS.PCS);
    const pcCount = pcGroup?.childElementCount ?? 0;
    const pcTop = pcGroup?.getBoundingClientRect().top ?? 0;
    const pcAvailable = Math.max(48, window.innerHeight - pcTop - 24);
    const fittedPcSize = pcCount
      ? Math.max(48, Math.min(pcSize, Math.floor((pcAvailable - gap * (pcCount - 1)) / pcCount)))
      : pcSize;
    pcGroup?.style.setProperty("--rnps-size", `${fittedPcSize}px`);
    leftColumn?.style.setProperty("--rnps-size", `${fittedPcSize}px`);
    leftColumn?.style.setProperty("--rnps-gap", `${gap}px`);
  }

  #observeRightColumn() {
    const right = resolveUiAnchor("rightPrimary");
    if (!right) return;
    this.#rightUiObserver?.disconnect();
    this.#rightUiObserver = new MutationObserver(() => {
      this.#attachGroups();
      this.#updateRightColumnLayout();
    });
    this.#rightUiObserver.observe(right, { childList: true, subtree: true });

    this.#resizeObserver?.disconnect();
    this.#resizeObserver = new ResizeObserver(() => this.#updateRightColumnLayout());
    this.#resizeObserver.observe(right);
    const chat = this.#findMiniChat();
    if (chat) this.#resizeObserver.observe(chat);
    const notifications = document.querySelector("#chat-notifications");
    if (notifications) {
      this.#resizeObserver.observe(notifications);
      this.#notificationObserver?.disconnect();
      this.#notificationObserver = new MutationObserver(() => this.#updateRightColumnLayout());
      this.#notificationObserver.observe(notifications, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "style", "hidden"]
      });
    }
  }

  #findMiniChat() {
    return document.querySelector("#chat-message")
      ?? document.querySelector("#chat-form")
      ?? document.querySelector("#chat-controls");
  }

  #updateRightColumnLayout() {
    const group = this.#groups.get(GROUP_IDS.NPCS);
    if (!group?.isConnected) return;
    const groupRect = group.getBoundingClientRect();
    const chat = this.#findMiniChat();
    const chatRect = chat?.getBoundingClientRect();
    const bottomBoundary = chatRect?.height > 0
      ? chatRect.top
      : window.innerHeight - 24;
    const notifications = document.querySelector("#chat-notifications");
    const available = Math.max(48, bottomBoundary - groupRect.top - 8);
    const size = Number.parseFloat(group.style.getPropertyValue("--rnps-size")) || 160;
    const gap = Number.parseFloat(group.style.getPropertyValue("--rnps-gap")) || 8;
    const rows = Math.max(1, Math.floor((available + gap) / (size + gap)));
    group.style.setProperty("--rnps-available-height", `${available}px`);
    group.style.setProperty("--rnps-rows", String(rows));
    const upward = group.dataset.direction === "up";
    [...group.children].forEach((portrait, index) => {
      portrait.style.gridColumn = String(Math.floor(index / rows) + 1);
      portrait.style.gridRow = String(upward ? rows - (index % rows) : (index % rows) + 1);
    });
    group.classList.toggle(
      "rnps-notifications-active",
      this.#hasVisibleChatNotification(notifications)
    );
  }

  #hasVisibleChatNotification(container) {
    if (!container) return false;
    const sidebar = document.querySelector("#sidebar");
    const chatIsMainTab = Boolean(sidebar?.querySelector("#chat.active, [data-tab='chat'].active"));
    const miniChatActive = sidebar?.classList.contains("collapsed") || !chatIsMainTab;
    if (!miniChatActive) return false;
    return [...container.children].some(element => {
      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
        return false;
      }
      return element.getClientRects().length > 0
        && Boolean(element.textContent?.trim() || element.querySelector("img, i, svg"));
    });
  }
}

export const portraitStage = new PortraitStage();

function cssUrl(value) {
  const escaped = String(value ?? "").replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  return `url("${escaped}")`;
}

function htmlToElement(html) {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}
