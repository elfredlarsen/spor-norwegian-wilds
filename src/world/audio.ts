import type { WeatherKind } from "./types";

type Layer = { gain: GainNode; filter: BiquadFilterNode; target: number };
type FootstepSurface = "moss" | "gravel" | "wet" | "water";
type NoiseColour = "white" | "pink" | "brown";

const AMBIENCE_SRC = {
  wind: "/audio/ambience/wind.mp3",
  windCalm: "/audio/ambience/wind_calm.mp3",
  rain: "/audio/ambience/rain.mp3",
  stream: "/audio/ambience/stream.mp3",
  birds: "/audio/ambience/birds.mp3",
};

const FOOTSTEP_SURFACE_FOLDER: Record<FootstepSurface, string> = {
  moss: "grass",
  gravel: "gravel",
  wet: "mud",
  water: "water",
};
const FOOTSTEP_VARIATIONS = 6;

/** A soundscape built from real field recordings for weather and footsteps, layered
 * with a little procedural synthesis (foley accents, chimes) for moments the library
 * doesn't cover. */
class ForestAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambience: GainNode | null = null;
  private ambienceFilter: BiquadFilterNode | null = null;
  private wind: Layer | null = null;
  private windCalm: Layer | null = null;
  private water: Layer | null = null;
  private rain: Layer | null = null;
  private birds: Layer | null = null;
  private aurora: Layer | null = null;
  private muted = false;
  private volume = 0.45;
  private weather: WeatherKind = "clear";
  private waterNearness = 0;
  private shelter = 0;
  private warmth = 0;
  private daylight = 1;
  private birdActivity = 1;
  private bubbleTimer: number | null = null;
  private bufferCache = new Map<string, Promise<AudioBuffer | null>>();
  private footstepBuffers: Partial<Record<FootstepSurface, AudioBuffer[]>> = {};
  private ambienceLoaded = false;

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

    master.gain.setTargetAtTime(this.muted ? 0 : this.volume, context.currentTime, 0.22);
    this.scheduleBubble();
    this.setupAurora();
    void this.loadAmbienceBeds();
    void this.loadFootstepBuffers();
  }

  /**
   * Nothing recorded fits "the sound of the aurora" — it doesn't have one.
   * A slow, detuned open chord under a shimmering filter sweep is the honest
   * synthesized stand-in, built the same way the rest of this file's
   * procedural accents are.
   */
  private setupAurora() {
    const context = this.context;
    const ambience = this.ambience;
    if (!context || !ambience) return;
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1400;
    filter.Q.value = 0.4;
    const gain = context.createGain();
    gain.gain.value = 0;
    filter.connect(gain);
    gain.connect(ambience);

    for (const [index, frequency] of [196, 246.94, 293.66].entries()) {
      const osc = context.createOscillator();
      osc.type = "sine";
      osc.frequency.value = frequency;
      const detune = context.createOscillator();
      detune.type = "sine";
      detune.frequency.value = frequency * 1.003;
      const oscGain = context.createGain();
      oscGain.gain.value = 0.3;
      osc.connect(oscGain);
      detune.connect(oscGain);
      oscGain.connect(filter);
      osc.start();
      detune.start();
      // a slow, independent wander per note so the chord never feels static
      const wander = context.createOscillator();
      wander.type = "sine";
      wander.frequency.value = 0.02 + index * 0.007;
      const wanderGain = context.createGain();
      wanderGain.gain.value = 1.5;
      wander.connect(wanderGain);
      wanderGain.connect(osc.detune);
      wander.start();
    }

    const lfo = context.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.035;
    const lfoGain = context.createGain();
    lfoGain.gain.value = 900;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    this.aurora = { gain, filter, target: 0 };
  }

  private async loadBuffer(url: string): Promise<AudioBuffer | null> {
    const context = this.context;
    if (!context) return null;
    let pending = this.bufferCache.get(url);
    if (!pending) {
      pending = fetch(url)
        .then((response) => response.arrayBuffer())
        .then((data) => context.decodeAudioData(data))
        .catch(() => null);
      this.bufferCache.set(url, pending);
    }
    return pending;
  }

  private async loadAmbienceBeds() {
    const context = this.context;
    if (!context) return;
    const [wind, windCalm, rain, stream, birds] = await Promise.all([
      this.loadBuffer(AMBIENCE_SRC.wind),
      this.loadBuffer(AMBIENCE_SRC.windCalm),
      this.loadBuffer(AMBIENCE_SRC.rain),
      this.loadBuffer(AMBIENCE_SRC.stream),
      this.loadBuffer(AMBIENCE_SRC.birds),
    ]);
    if (this.context !== context) return; // torn down while loading
    if (wind) this.wind = this.makeSampleLayer(wind, "lowpass", 12000, 0);
    if (windCalm) this.windCalm = this.makeSampleLayer(windCalm, "lowpass", 900, 0);
    if (rain) this.rain = this.makeSampleLayer(rain, "lowpass", 12000, 0);
    if (stream) this.water = this.makeSampleLayer(stream, "lowpass", 430, 0);
    if (birds) this.birds = this.makeSampleLayer(birds, "lowpass", 12000, 0);
    this.ambienceLoaded = true;
    this.applyWeather(1.2);
    this.applyWaterNearness(1.2);
    this.applyAmbient(1.2);
  }

  private async loadFootstepBuffers() {
    const context = this.context;
    if (!context) return;
    for (const [surface, folder] of Object.entries(FOOTSTEP_SURFACE_FOLDER) as [FootstepSurface, string][]) {
      const buffers = await Promise.all(
        Array.from({ length: FOOTSTEP_VARIATIONS }, (_, index) =>
          this.loadBuffer(`/audio/footsteps/${folder}/${String(index + 1).padStart(2, "0")}.wav`),
        ),
      );
      if (this.context !== context) return;
      const loaded = buffers.filter((buffer): buffer is AudioBuffer => buffer !== null);
      if (loaded.length) this.footstepBuffers[surface] = loaded;
    }
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

  private makeSampleLayer(
    buffer: AudioBuffer,
    filterType: BiquadFilterType,
    frequency: number,
    gainValue: number,
    q = 0.4,
  ): Layer | null {
    const context = this.context;
    const ambience = this.ambience;
    if (!context || !ambience) return null;
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

  private ramp(layer: Layer | null, value: number, time = 1.4) {
    if (!this.context || !layer) return;
    layer.target = value;
    layer.gain.gain.setTargetAtTime(value, this.context.currentTime, time);
  }

  private applyWeather(time = 1.4) {
    const indoors = 1 - this.shelter * 0.74;
    // a hushed, muffled bed while misty; the fuller forest wind otherwise
    this.ramp(this.wind, this.weather === "mist" || this.weather === "rain" ? 0 : 0.05 * indoors, time);
    this.ramp(this.windCalm, this.weather === "mist" ? 0.055 * indoors : 0, this.weather === "mist" ? 2.8 : 1.8);
    this.ramp(this.rain, this.weather === "rain" ? 0.075 * indoors : 0, time);
    this.ramp(this.aurora, this.weather === "aurora" ? 0.05 * indoors : 0, this.weather === "aurora" ? 3.5 : 2.2);
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
    const rainFullness = this.weather === "rain" ? 1.3 : 1;
    const indoors = 1 - this.shelter * 0.8;
    this.ramp(this.water, closeness * 0.09 * indoors * rainFullness, time);
    if (this.context && this.water) {
      this.water.filter.frequency.setTargetAtTime(430 + (2400 - 430) * closeness, this.context.currentTime, time);
    }
  }

  /** How bright the day is (0 night, 1 midday) and how active the birds are this season. */
  setAmbient(daylight: number, birdActivity: number) {
    const nextDaylight = Math.min(1, Math.max(0, daylight));
    const nextActivity = Math.min(1, Math.max(0, birdActivity));
    if (Math.abs(nextDaylight - this.daylight) < 0.015 && Math.abs(nextActivity - this.birdActivity) < 0.02) return;
    this.daylight = nextDaylight;
    this.birdActivity = nextActivity;
    this.applyAmbient();
  }

  private applyAmbient(time = 2.2) {
    const indoors = 1 - this.shelter;
    // birdsong settles in by mid-morning and fades before dusk, only when weather is calm —
    // sun brings the forest fully alive, clear air is a touch quieter and more still
    const calm = this.weather === "sun" ? 1.3 : this.weather === "clear" ? 0.8 : this.weather === "mist" ? 0.4 : 0.1;
    const level = Math.max(0, this.daylight - 0.15) * this.birdActivity * calm * indoors * 0.05;
    this.ramp(this.birds, level, time);
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
    this.applyAmbient();
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

  private playFootstepSample(buffer: AudioBuffer, volume: number) {
    const context = this.context;
    const master = this.master;
    if (!context || !master || this.muted) return;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = 0.94 + Math.random() * 0.14;
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(master);
    source.start();
  }

  /** Falls back to a synthesized thud if the real sample library hasn't loaded yet. */
  private footstepSynth(surface: FootstepSurface, strength: number) {
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

  footstep(surface: FootstepSurface, pace = 0.5) {
    const strength = 0.8 + Math.min(1, Math.max(0, pace)) * 0.35;
    const variations = this.footstepBuffers[surface];
    if (variations?.length) {
      const buffer = variations[Math.floor(Math.random() * variations.length)];
      if (buffer) {
        this.playFootstepSample(buffer, 0.32 * strength);
        return;
      }
    }
    this.footstepSynth(surface, strength);
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

  dig() {
    this.noiseBurst("brown", 360, 0.38, 0.018, "lowpass");
    this.noiseBurst("pink", 1150, 0.22, 0.008);
    this.softTone(88, 0.2, 0.009);
  }

  /** A call meant to carry — a short rising howl. */
  howl() {
    this.duckAmbience(0.55, 1.4);
    const context = this.context;
    const master = this.master;
    if (!context || !master || this.muted) return;
    const start = context.currentTime;
    const oscillator = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    oscillator.type = "sawtooth";
    filter.type = "lowpass";
    filter.frequency.value = 1100;
    filter.Q.value = 0.6;
    oscillator.frequency.setValueAtTime(220, start);
    oscillator.frequency.linearRampToValueAtTime(340, start + 0.35);
    oscillator.frequency.exponentialRampToValueAtTime(210, start + 1.1);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.05, start + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.15);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    oscillator.start(start);
    oscillator.stop(start + 1.2);
    this.noiseBurst("pink", 1400, 0.3, 0.006, "highpass");
  }

  /** A brief hush, ears turned toward something far off. */
  listen() {
    this.duckAmbience(0.5, 1.6);
    this.noiseBurst("pink", 2600, 0.5, 0.004, "highpass");
    this.softTone(700, 0.4, 0.006, "sine");
    this.softTone(1050, 0.35, 0.004, "sine", 0.12);
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
