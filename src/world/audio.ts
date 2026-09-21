import type { PlacementKind, WeatherKind } from "./types";

type Layer = { gain: GainNode; filter: BiquadFilterNode; target: number };
type FootstepSurface = "moss" | "gravel" | "wet" | "water";
type NoiseColour = "white" | "pink" | "brown";

/** A fully procedural, offline soundscape built from gentle filtered noise and resonant tones. */
class ForestAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambience: GainNode | null = null;
  private ambienceFilter: BiquadFilterNode | null = null;
  private wind: Layer[] = [];
  private water: Layer[] = [];
  private rain: Layer[] = [];
  private mist: Layer | null = null;
  private muted = false;
  private volume = 0.45;
  private weather: WeatherKind = "clear";
  private waterNearness = 0;
  private bubbleTimer: number | null = null;

  init() {
    if (typeof window === "undefined") return;
    if (this.context) {
      void this.context.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const context = new Ctor();
    const master = context.createGain();
    const ambience = context.createGain();
    const ambienceFilter = context.createBiquadFilter();
    const limiter = context.createDynamicsCompressor();
    master.gain.value = 0;
    ambience.gain.value = 1;
    ambienceFilter.type = "lowpass";
    ambienceFilter.frequency.value = 12000;
    ambienceFilter.Q.value = 0.18;
    limiter.threshold.value = -18;
    limiter.knee.value = 14;
    limiter.ratio.value = 5;
    limiter.attack.value = 0.01;
    limiter.release.value = 0.35;
    ambience.connect(ambienceFilter);
    ambienceFilter.connect(master);
    master.connect(limiter);
    limiter.connect(context.destination);
    this.context = context;
    this.master = master;
    this.ambience = ambience;
    this.ambienceFilter = ambienceFilter;

    this.wind = [
      this.makeNoiseLayer("brown", "lowpass", 240, 0.042, 0.08),
      this.makeNoiseLayer("pink", "bandpass", 760, 0.025, 0.22),
      this.makeNoiseLayer("pink", "bandpass", 1850, 0.011, 0.35),
    ].filter((layer): layer is Layer => layer !== null);
    this.water = [
      this.makeNoiseLayer("brown", "bandpass", 520, 0.006, 0.55),
      this.makeNoiseLayer("pink", "bandpass", 1450, 0.004, 0.8),
      this.makeNoiseLayer("white", "highpass", 3200, 0.0015, 0.4),
    ].filter((layer): layer is Layer => layer !== null);
    this.rain = [
      this.makeNoiseLayer("pink", "bandpass", 2100, 0, 0.55),
      this.makeNoiseLayer("white", "highpass", 5200, 0, 0.35),
      this.makeNoiseLayer("brown", "lowpass", 340, 0, 0.5),
    ].filter((layer): layer is Layer => layer !== null);
    this.mist = this.makeNoiseLayer("brown", "lowpass", 115, 0, 0.5);
    this.addOrganicGust(this.wind[0] ?? null, 0.012, 0.07);
    this.addOrganicGust(this.wind[1] ?? null, 0.007, 0.043, 0.061);
    this.applyWeather(0.15);
    this.applyWaterNearness(0.15);
    master.gain.setTargetAtTime(this.muted ? 0 : this.volume, context.currentTime, 0.22);
    this.scheduleBubble();
  }

  private noiseBuffer(colour: NoiseColour) {
    const context = this.context;
    if (!context) return null;
    const length = context.sampleRate * 4;
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    let brown = 0;
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let index = 0; index < length; index += 1) {
      const white = Math.random() * 2 - 1;
      if (colour === "brown") {
        brown = (brown + 0.018 * white) / 1.018;
        data[index] = brown * 3.2;
      } else if (colour === "pink") {
        b0 = 0.99765 * b0 + white * 0.099046;
        b1 = 0.963 * b1 + white * 0.296516;
        b2 = 0.57 * b2 + white * 1.052691;
        data[index] = (b0 + b1 + b2 + white * 0.1848) * 0.16;
      } else data[index] = white;
    }
    return buffer;
  }

  private makeNoiseLayer(
    colour: NoiseColour,
    filterType: BiquadFilterType,
    frequency: number,
    gainValue: number,
    q: number,
  ): Layer | null {
    const context = this.context;
    const ambience = this.ambience;
    const buffer = this.noiseBuffer(colour);
    if (!context || !ambience || !buffer) return null;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    gain.gain.value = gainValue;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ambience);
    source.start();
    return { gain, filter, target: gainValue };
  }

  private addOrganicGust(layer: Layer | null, depth: number, speed: number, secondSpeed = 0.037) {
    const context = this.context;
    if (!context || !layer) return;
    const lfo = context.createOscillator();
    const wander = context.createOscillator();
    const lfoGain = context.createGain();
    const wanderGain = context.createGain();
    lfo.type = "sine";
    wander.type = "sine";
    lfo.frequency.value = speed;
    wander.frequency.value = secondSpeed;
    lfoGain.gain.value = depth;
    wanderGain.gain.value = depth * 0.45;
    lfo.connect(lfoGain);
    wander.connect(wanderGain);
    lfoGain.connect(layer.gain.gain);
    wanderGain.connect(layer.gain.gain);
    lfo.start();
    wander.start();
  }

  private ramp(layer: Layer | null, value: number, time = 1.4) {
    if (!this.context || !layer) return;
    layer.target = value;
    layer.gain.gain.setTargetAtTime(value, this.context.currentTime, time);
  }

  private applyWeather(time = 1.4) {
    const indoors = 1 - this.shelter * 0.74;
    const wind = this.weather === "mist" ? [0.014, 0.008, 0.002] : this.weather === "sun" ? [0.03, 0.018, 0.006] : [0.042, 0.025, 0.011];
    this.wind.forEach((layer, index) => this.ramp(layer, (wind[index] ?? 0) * indoors, time));
    // rain overhead keeps a soft low rumble on the roots, so the low band stays
    const rain = this.weather === "rain" ? [0.026 * indoors, 0.016 * indoors, 0.014 * (1 + this.shelter * 0.5)] : [0, 0, 0];
    this.rain.forEach((layer, index) => this.ramp(layer, rain[index] ?? 0, time));
    this.ramp(this.mist, this.weather === "mist" ? 0.025 : 0, this.weather === "mist" ? 2.8 : 1.8);
    if (this.context && this.ambienceFilter) {
      const open = this.weather === "mist" ? 720 : this.weather === "rain" ? 7200 : 12000;
      const sheltered = 620 - this.warmth * 180;
      this.ambienceFilter.frequency.setTargetAtTime(
        open + (Math.min(open, sheltered) - open) * this.shelter,
        this.context.currentTime,
        this.shelter > 0 ? 1.1 : this.weather === "mist" ? 1.6 : 0.8,
      );
    }
    this.applyWaterNearness(time);
  }

  /** 0 = out in the open forest, 1 = inside the den. */
  setShelter(amount: number, warmth = this.warmth) {
    const next = Math.min(1, Math.max(0, amount));
    const nextWarmth = Math.min(1, Math.max(0, warmth));
    if (Math.abs(next - this.shelter) < 0.02 && Math.abs(nextWarmth - this.warmth) < 0.02) return;
    this.shelter = next;
    this.warmth = nextWarmth;
    this.applyWeather(1.2);
  }

  /** Soft rustle of needles, moss or bark settling into the nest. */
  bedding() {
    this.duckAmbience(0.6, 0.9);
    this.noiseBurst("brown", 280, 0.42, 0.015, "lowpass");
    this.noiseBurst("pink", 980, 0.28, 0.007);
    this.softTone(196, 0.7, 0.008, "triangle", 0.12);
  }

  /** A keepsake set down on a stone shelf. */
  keepsake() {
    this.softTone(349.23, 0.9, 0.014, "triangle");
    this.softTone(523.25, 0.75, 0.007, "sine", 0.11);
  }

  private applyWaterNearness(time = 0.45) {
    const closeness = this.waterNearness;
    const rainFullness = this.weather === "rain" ? 1.35 : 1;
    const levels = [0.0015 + closeness * 0.03, 0.0006 + closeness * 0.024, closeness * 0.01];
    this.water.forEach((layer, index) => {
      this.ramp(layer, (levels[index] ?? 0) * rainFullness, time);
      if (this.context) {
        const farCutoff = index === 0 ? 430 : index === 1 ? 680 : 1200;
        const nearCutoff = index === 0 ? 850 : index === 1 ? 2300 : 5600;
        layer.filter.frequency.setTargetAtTime(
          farCutoff + (nearCutoff - farCutoff) * closeness,
          this.context.currentTime,
          time,
        );
      }
    });
  }

  private scheduleBubble() {
    if (typeof window === "undefined") return;
    if (this.bubbleTimer !== null) window.clearTimeout(this.bubbleTimer);
    const delay = 1400 + Math.random() * 3600;
    this.bubbleTimer = window.setTimeout(() => {
      if (this.waterNearness > 0.28 && !this.muted) this.waterBubble();
      this.scheduleBubble();
    }, delay);
  }

  setVolume(value: number) {
    this.volume = Math.min(1, Math.max(0, value));
    if (this.context && this.master && !this.muted) {
      this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.12);
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.context && this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : this.volume, this.context.currentTime, muted ? 0.08 : 0.2);
    }
  }

  setWeather(kind: WeatherKind) {
    this.weather = kind;
    this.applyWeather();
  }

  /** Nearness to the stream, 0..1. */
  setWaterNearness(value: number) {
    const next = Math.min(1, Math.max(0, value));
    if (Math.abs(next - this.waterNearness) < 0.025) return;
    this.waterNearness = next;
    this.applyWaterNearness();
  }

  private duckAmbience(amount: number, holdSeconds: number) {
    const context = this.context;
    const ambience = this.ambience;
    if (!context || !ambience) return;
    const now = context.currentTime;
    ambience.gain.cancelScheduledValues(now);
    ambience.gain.setTargetAtTime(amount, now, 0.05);
    ambience.gain.setTargetAtTime(1, now + holdSeconds, 0.35);
  }

  private noiseBurst(colour: NoiseColour, frequency: number, duration: number, volume: number, filterType: BiquadFilterType = "bandpass") {
    const context = this.context;
    const master = this.master;
    const buffer = this.noiseBuffer(colour);
    if (!context || !master || !buffer || this.muted) return;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = 0.7;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume, context.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
    source.stop(context.currentTime + duration + 0.03);
  }

  private softTone(frequency: number, duration: number, volume = 0.018, type: OscillatorType = "sine", delay = 0) {
    const context = this.context;
    const master = this.master;
    if (!context || !master || this.muted) return;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.76, start + duration);
    filter.type = "lowpass";
    filter.frequency.value = 1450;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.04);
  }

  private waterBubble() {
    const base = 520 + Math.random() * 260;
    this.softTone(base, 0.16, 0.004 + this.waterNearness * 0.006, "sine");
    this.softTone(base * 1.32, 0.11, 0.003 + this.waterNearness * 0.004, "sine", 0.07);
  }

  footstep(surface: FootstepSurface, pace = 0.5) {
    const strength = 0.8 + Math.min(1, Math.max(0, pace)) * 0.35;
    if (surface === "water") {
      this.noiseBurst("pink", 1150, 0.14, 0.014 * strength);
      this.softTone(175, 0.16, 0.012 * strength);
    } else if (surface === "wet") {
      this.noiseBurst("pink", 820, 0.17, 0.012 * strength);
      this.softTone(132, 0.15, 0.011 * strength);
    } else if (surface === "gravel") {
      this.noiseBurst("white", 1850, 0.085, 0.009);
      this.softTone(105, 0.1, 0.011);
    } else {
      this.noiseBurst("brown", 310, 0.11, 0.014, "lowpass");
      this.softTone(72, 0.12, 0.01);
    }
  }

  sniff() {
    this.duckAmbience(0.42, 0.75);
    this.noiseBurst("pink", 920, 0.32, 0.011, "highpass");
    this.noiseBurst("brown", 480, 0.22, 0.008, "lowpass");
  }

  flutter() {
    this.noiseBurst("pink", 2100, 0.2, 0.009, "highpass");
    this.softTone(620, 0.13, 0.004, "triangle", 0.05);
  }

  splash() {
    this.noiseBurst("pink", 1300, 0.28, 0.017);
    this.softTone(225, 0.24, 0.012);
  }

  sip() {
    this.duckAmbience(0.68, 1.25);
    this.noiseBurst("pink", 780, 0.55, 0.009);
    this.softTone(315, 0.42, 0.01);
    this.softTone(405, 0.34, 0.007, "sine", 0.24);
    this.softTone(285, 0.3, 0.006, "sine", 0.58);
  }

  dig() {
    this.noiseBurst("brown", 360, 0.38, 0.018, "lowpass");
    this.noiseBurst("pink", 1150, 0.22, 0.008);
    this.softTone(88, 0.2, 0.009);
  }

  rest() {
    this.duckAmbience(0.72, 4.6);
    this.noiseBurst("brown", 260, 0.7, 0.015, "lowpass");
    this.softTone(155, 0.8, 0.009, "sine", 0.08);
    this.noiseBurst("pink", 540, 0.65, 0.004, "lowpass");
    this.softTone(118, 1.1, 0.006, "sine", 1.7);
    this.softTone(112, 1.2, 0.005, "sine", 3.5);
  }

  placement(kind: PlacementKind) {
    if (kind === "stone") {
      this.softTone(238, 0.38, 0.018, "sine");
      this.softTone(321, 0.3, 0.01, "sine", 0.045);
      this.noiseBurst("brown", 420, 0.12, 0.006, "lowpass");
      return;
    }
    const root = kind === "lantern" ? 392 : kind === "flower" ? 440 : 330;
    this.softTone(root, 1.25, 0.018, "triangle");
    this.softTone(root * 1.5, 1.05, 0.009, "sine", 0.09);
  }

  discoveryResonance() {
    const notes = [293.66, 329.63, 392, 440, 523.25];
    const root = notes[Math.floor(Math.random() * notes.length)] ?? 392;
    this.softTone(root, 2.4, 0.014, "triangle");
    this.softTone(root * 1.5, 2.8, 0.007, "sine", 0.75);
  }

  chime(frequency: number) {
    this.softTone(frequency, 1.6, 0.018, "triangle");
  }
}

export const audio = new ForestAudio();