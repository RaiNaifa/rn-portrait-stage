export const foundryV13Adapter = Object.freeze({
  generation: 13,

  anchors: Object.freeze({
    leftSecondary: "#ui-left-column-2",
    rightPrimary: "#ui-right-column-1",
    fallback: "#interface"
  }),

  getApplicationV2() {
    return foundry.applications.api.ApplicationV2;
  },

  clone(value) {
    return foundry.utils.deepClone(value);
  },

  hoverToken(token, { hoverOutOthers = false } = {}) {
    token?._onHoverIn?.(new MouseEvent("mouseenter"), { hoverOutOthers });
  },

  unhoverToken(token) {
    token?._onHoverOut?.(new MouseEvent("mouseleave"));
  }
});
