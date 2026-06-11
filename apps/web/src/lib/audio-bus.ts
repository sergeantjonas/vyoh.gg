import { SOUND_RECIPES, type SoundSlot } from "./audio-recipes";

export class AudioBus {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  enabled = false;
  volume = 0.5;

  /** Must be invoked inside a user gesture (browser autoplay policy). Idempotent. */
  init(): void {
    if (this.ctx || typeof window === "undefined") return;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volume;
    this.masterGain.connect(this.ctx.destination);
    // Browsers ship the context in "suspended" until a gesture-coupled
    // resume(). Caller already guarantees gesture context, so call it now so
    // the first play() doesn't race the async resume completion.
    void this.ctx.resume().catch(() => {});
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.masterGain) {
      this.masterGain.gain.value = this.volume;
    }
  }

  play(slot: SoundSlot): void {
    if (!this.enabled || !this.ctx || !this.masterGain) return;
    const recipe = SOUND_RECIPES[slot];
    if (!recipe) return;
    const ctx = this.ctx;
    const master = this.masterGain;
    if (ctx.state === "suspended") {
      // Schedule the recipe AFTER resume settles. Recipes pin envelopes to
      // ctx.currentTime, which is frozen while suspended; running them
      // inline can produce a silent no-op when the timeline jumps.
      void ctx
        .resume()
        .then(() => {
          if (this.ctx === ctx && this.masterGain === master) {
            recipe(ctx, master);
          }
        })
        .catch(() => {});
      return;
    }
    recipe(ctx, master);
  }

  dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.masterGain = null;
    }
  }
}

export const audioBus = new AudioBus();
