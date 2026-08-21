export const foundryV14Adapter = Object.freeze({
  generation: 14,

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
  }
});
