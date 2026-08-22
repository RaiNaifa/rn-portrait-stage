import { HOOKS, MODULE_ID, SETTING_KEYS } from "../constants.js";
import { emitVoiceState, requestVoiceEntryToggle } from "../data/socket-service.js";

const PROTOCOL_VERSION = 1;
const HEARTBEAT_MS = 1500;
const EXPIRE_MS = 4000;

class VoiceController {
  #stream = null;
  #context = null;
  #timer = null;
  #heartbeat = null;
  #speaking = false;
  #aboveSince = 0;
  #belowSince = 0;
  #states = new Map();
  #gmActorUuid = null;

  initialize() {
    Hooks.on("rnPortraitStageVoiceSocket", message => this.#receive(message));
    Hooks.on(HOOKS.SETTINGS_CHANGED, ({ key }) => {
      if ([SETTING_KEYS.EXPERIMENTAL_VOICE_ALLOWED, SETTING_KEYS.EXPERIMENTAL_VOICE_ENABLED].includes(key)) {
        this.syncDetector();
      }
    });
    setInterval(() => this.#expire(), 1000);
    this.syncDetector();
  }

  async syncDetector() {
    const enabled = game.settings.get(MODULE_ID, SETTING_KEYS.EXPERIMENTAL_VOICE_ALLOWED)
      && game.settings.get(MODULE_ID, SETTING_KEYS.EXPERIMENTAL_VOICE_ENABLED);
    if (!enabled) return this.stop();
    if (this.#stream) return;
    if (!globalThis.isSecureContext || !navigator.mediaDevices?.getUserMedia) return;
    try {
      this.#stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
      if (!AudioContextClass) throw new Error("Web Audio API is unavailable.");
      this.#context = new AudioContextClass();
      const source = this.#context.createMediaStreamSource(this.#stream);
      const analyser = this.#context.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      this.#timer = setInterval(() => this.#sample(analyser, samples), 50);
      this.#stream.getAudioTracks()[0]?.addEventListener("ended", () => this.stop());
    } catch (error) {
      console.warn(`${MODULE_ID} | Microphone unavailable`, error);
      ui.notifications.warn(game.i18n.localize("RNPS.Notifications.MicrophoneUnavailable"));
    }
  }

  async stop() {
    this.#setSpeaking(false);
    clearInterval(this.#timer);
    clearInterval(this.#heartbeat);
    this.#timer = this.#heartbeat = null;
    this.#stream?.getTracks().forEach(track => track.stop());
    this.#stream = null;
    await this.#context?.close().catch(() => {});
    this.#context = null;
  }

  #sample(analyser, samples) {
    analyser.getFloatTimeDomainData(samples);
    const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
    const threshold = game.settings.get(MODULE_ID, SETTING_KEYS.VOICE_THRESHOLD);
    const attack = game.settings.get(MODULE_ID, SETTING_KEYS.VOICE_ATTACK);
    const release = game.settings.get(MODULE_ID, SETTING_KEYS.VOICE_RELEASE);
    const now = performance.now();
    if (rms >= threshold) {
      this.#belowSince = 0;
      this.#aboveSince ||= now;
      if (!this.#speaking && now - this.#aboveSince >= attack) this.#setSpeaking(true);
    } else {
      this.#aboveSince = 0;
      this.#belowSince ||= now;
      if (this.#speaking && now - this.#belowSince >= release) this.#setSpeaking(false);
    }
  }

  #localActorUuid() {
    return game.user.isGM ? this.#gmActorUuid : game.user.character?.uuid ?? null;
  }

  #setSpeaking(speaking) {
    if (this.#speaking === speaking) return;
    this.#speaking = speaking;
    const actorUuid = this.#localActorUuid();
    if (!actorUuid) return;
    this.#apply(game.user.id, actorUuid, speaking);
    emitVoiceState({ userId: game.user.id, actorUuid, speaking, timestamp: Date.now(), protocolVersion: PROTOCOL_VERSION });
    clearInterval(this.#heartbeat);
    if (speaking) this.#heartbeat = setInterval(() => {
      emitVoiceState({ userId: game.user.id, actorUuid, speaking: true, timestamp: Date.now(), protocolVersion: PROTOCOL_VERSION });
    }, HEARTBEAT_MS);
  }

  #receive(message) {
    if (message.protocolVersion !== PROTOCOL_VERSION) return;
    const user = game.users.get(message.userId);
    if (!user) return;
    const actorUuid = user.isGM ? message.actorUuid : user.character?.uuid;
    if (!actorUuid || actorUuid !== message.actorUuid) return;
    if (user.isGM && this.#assignedActiveUser(actorUuid)) return;
    this.#apply(user.id, actorUuid, message.speaking === true, Date.now());
  }

  #apply(userId, actorUuid, speaking, timestamp = Date.now()) {
    if (speaking) this.#states.set(actorUuid, { userId, expires: timestamp + EXPIRE_MS });
    else this.#states.delete(actorUuid);
    Hooks.callAll(HOOKS.SPEAKING_CHANGED, { actorUuid, userId, speaking });
  }

  #expire() {
    if (game.user.isGM && this.#gmActorUuid && this.#assignedActiveUser(this.#gmActorUuid)) {
      if (this.#speaking) this.#setSpeaking(false);
      this.#gmActorUuid = null;
    }
    const now = Date.now();
    for (const [actorUuid, state] of this.#states) if (state.expires < now) this.#apply(state.userId, actorUuid, false);
  }

  #assignedActiveUser(actorUuid) {
    return game.users.find(user => user.active && !user.isGM && user.character?.uuid === actorUuid);
  }

  isSpeaking(actorUuid) { return this.#states.has(actorUuid); }
  isEnabled(entry) { return entry.flags?.[MODULE_ID]?.voiceEnabled !== false; }
  canControl(actor) { return game.user.isGM || game.user.character?.uuid === actor.uuid; }
  isGmActor(actorUuid) { return this.#gmActorUuid === actorUuid; }

  setGmActor(actorUuid) {
    if (!game.user.isGM) throw new Error(game.i18n.localize("RNPS.Notifications.GmOnly"));
    if (actorUuid && this.#assignedActiveUser(actorUuid)) return false;
    if (this.#speaking) this.#setSpeaking(false);
    this.#gmActorUuid = actorUuid || null;
    return true;
  }

  setGmRouting(enabled) {
    if (!game.user.isGM) throw new Error(game.i18n.localize("RNPS.Notifications.GmOnly"));
    if (!enabled) this.setGmActor(null);
    return Boolean(enabled && this.#gmActorUuid);
  }

  async toggleEntry(view) {
    if (!this.canControl(view.actor)) return;
    if (game.user.isGM && !this.#assignedActiveUser(view.actorUuid)) {
      const previous = this.#gmActorUuid;
      const next = this.#gmActorUuid === view.actorUuid ? null : view.actorUuid;
      if (this.#speaking) this.#setSpeaking(false);
      this.#gmActorUuid = next;
      if (previous && previous !== view.actorUuid) {
        Hooks.callAll(HOOKS.SPEAKING_CHANGED, { actorUuid: previous, speaking: false });
      }
      Hooks.callAll(HOOKS.SPEAKING_CHANGED, { actorUuid: view.actorUuid, speaking: false });
      return;
    }
    await requestVoiceEntryToggle(view.id, !this.isEnabled(view.entry), {
      layer: view.entry.layer,
      actor: view.actor
    });
  }

  getState() {
    return Object.freeze({ enabled: Boolean(this.#stream), speaking: this.#speaking, gmActorUuid: this.#gmActorUuid });
  }
}

export const voiceController = new VoiceController();
