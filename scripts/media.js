const VIDEO_EXTENSIONS = new Set(["mp4", "m4v", "webm", "ogv", "ogg"]);

export function isVideoPath(source) {
  const path = String(source ?? "").split(/[?#]/, 1)[0];
  const extension = path.includes(".") ? path.slice(path.lastIndexOf(".") + 1).toLowerCase() : "";
  return VIDEO_EXTENSIONS.has(extension);
}

export function createPortraitMedia(source, { className = "", loading = false } = {}) {
  const media = document.createElement(isVideoPath(source) ? "video" : "img");
  media.className = className;
  media.src = source;
  media.draggable = false;
  if (media instanceof HTMLVideoElement) {
    media.autoplay = true;
    media.loop = true;
    media.muted = true;
    media.playsInline = true;
    media.preload = "metadata";
  } else {
    media.alt = "";
    if (loading) media.loading = "lazy";
  }
  return media;
}
