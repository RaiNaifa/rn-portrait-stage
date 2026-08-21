const IMAGE_HOVER_ID = "image-hover";

export function isImageHoverActive() {
  return game.modules.get(IMAGE_HOVER_ID)?.active === true
    && Boolean(canvas.hud?.imageHover);
}

export function withImageHoverSuppressed(callback) {
  const hud = canvas.hud?.imageHover;
  const original = hud?.showArtworkRequirements;
  if (typeof original !== "function") return callback();
  hud.showArtworkRequirements = () => {};
  try {
    return callback();
  } finally {
    hud.showArtworkRequirements = original;
  }
}
