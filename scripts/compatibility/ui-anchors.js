import { getCompatibilityAdapter } from "./index.js";

export function resolveUiAnchor(anchorId) {
  const { anchors } = getCompatibilityAdapter();
  const selector = anchors[anchorId] ?? anchors.fallback;
  return document.querySelector(selector) ?? document.querySelector(anchors.fallback);
}

export function getUiAnchorSelectors() {
  return { ...getCompatibilityAdapter().anchors };
}
