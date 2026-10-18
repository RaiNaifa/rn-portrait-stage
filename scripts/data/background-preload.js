import { MODULE_ID } from "../constants.js";
import { createPortraitMedia, isVideoPath } from "../media.js";
import { findBackground } from "./background-library.js";

const CHANNEL = `module.${MODULE_ID}`;
const requests = new Map();
const cached = new Map();

export function waitForBackgroundMedia(media) {
  return new Promise((resolve, reject) => {
    const video = media instanceof HTMLVideoElement;
    const decoded = () => Promise.resolve().then(() => video ? undefined : media.decode?.()).then(() => resolve(media), reject);
    if (video ? media.error : media.complete && media.naturalWidth === 0) {
      reject(new Error(`Unable to load background: ${media.src}`));
      return;
    }
    if (video ? media.readyState >= 2 : media.complete && media.naturalWidth > 0) {
      decoded();
      return;
    }
    let timer;
    const cleanup = () => {
      clearTimeout(timer);
      media.removeEventListener(video ? "loadeddata" : "load", ready);
      media.removeEventListener("error", failed);
    };
    const ready = () => { cleanup(); decoded(); };
    const failed = () => { cleanup(); reject(new Error(`Unable to load background: ${media.src}`)); };
    media.addEventListener(video ? "loadeddata" : "load", ready, { once: true });
    media.addEventListener("error", failed, { once: true });
    timer = setTimeout(failed, 30000);
    if (video) media.load();
  });
}

export function preloadBackground(src) {
  if (!src) return Promise.reject(new Error("Background source is empty"));
  if (cached.has(src)) return cached.get(src);
  const media = createPortraitMedia(src);
  if (isVideoPath(src)) {
    media.preload = "auto";
    media.autoplay = false;
  }
  const pending = waitForBackgroundMedia(media).then(() => media);
  cached.set(src, pending);
  pending.catch(() => { if (cached.get(src) === pending) cached.delete(src); });
  return pending;
}

function changed() { Hooks.callAll("rnPortraitStageBackgroundPreloadChanged"); }

export function getBackgroundPreloadStatus(id, src) {
  const request = requests.get(id);
  if (!request || request.src !== src) return { state: "idle", ready: 0, total: 0 };
  const players = (game.users?.contents ?? []).filter(user => user.active && request.expected.has(user.id));
  const ready = players.filter(user => request.ready.has(user.id)).length;
  const failed = players.some(user => request.failed.has(user.id)) || request.localFailed;
  const pending = !request.localReady || players.some(user => !request.ready.has(user.id) && !request.failed.has(user.id));
  return { state: failed ? "failed" : pending ? "loading" : "ready", ready, total: players.length };
}

export async function requestBackgroundPreload(id, src) {
  if (!game.user?.isGM || !src) return;
  const requestId = foundry.utils.randomID();
  const request = {
    id: requestId, src, ready: new Set(), failed: new Set(),
    expected: new Set((game.users?.contents ?? []).filter(user => user.active && !user.isGM).map(user => user.id)),
    localReady: false, localFailed: false
  };
  requests.set(id, request);
  changed();
  game.socket.emit(CHANNEL, { type: "preload-background", backgroundId: id, src, requestId, senderId: game.user.id });
  try { await preloadBackground(src); request.localReady = true; }
  catch { request.localFailed = true; }
  if (requests.get(id) === request) changed();
}

export async function handleBackgroundPreloadMessage(message) {
  if (message?.type === "preload-background") {
    if (game.user.isGM || !game.users.get(message.senderId)?.isGM) return true;
    if (findBackground(message.backgroundId)?.src !== message.src) return true;
    let ok = true;
    try { await preloadBackground(message.src); } catch { ok = false; }
    game.socket.emit(CHANNEL, {
      type: "background-preload-result", backgroundId: message.backgroundId,
      requestId: message.requestId, userId: game.user.id, ok
    });
    return true;
  }
  if (message?.type === "background-preload-result") {
    if (!game.user.isGM) return true;
    const request = requests.get(message.backgroundId);
    if (request?.id !== message.requestId || !request.expected.has(message.userId)) return true;
    (message.ok ? request.ready : request.failed).add(message.userId);
    changed();
    return true;
  }
  return false;
}
