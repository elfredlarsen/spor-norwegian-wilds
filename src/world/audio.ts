type Layer = { gain: GainNode; target: number };

/**
 * Small procedural soundscape: wind through pines, the stream, and rain.
 * Everything is synthesised, so there are no assets to download and the
 * experience also works offline.
 */
class ForestAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private wind: Layer | null = null;
  private water: Layer | null = null;
  private rain: Layer | null = null;
  private muted = false;
  private volume = 0.45;

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
    master.gain.value = this.muted ? 0 : this.volume;
    master.connect(context.destination);
    this.context = context;
    this.master = master;
    this.wind = this.makeNoiseLayer(420, 0.075);
    this.water = this.makeNoiseLayer(1200, 0.02);
    this.rain = this.makeNoiseLayer(2600, 0);
  }

  private makeNoiseLayer(frequency: number, gainValue: number): Layer | null {
    const context = this.context;
    const master = this.master;
    if (!context || !master) return null;
    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (0.65 + Math.sin(index * 0.0007) * 0.35);
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = frequency;
    filter.Q.value = 0.7;
    const gain = context.createGain();
    gain.gain.value = gainValue;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
    return { gain, target: gainValue };
  }

  private ramp(layer: Layer | null, value: number, time = 1.4) {
    if (!this.context || !layer) return;
    layer.target = value;
    layer.gain.gain.setTargetAtTime(value, this.context.currentTime, time);
  }

  setVolume(value: number) {
    this.volume = value;
    if (this.context && this.master && !this.muted) {
      this.master.gain.setTargetAtTime(value, this.context.currentTime, 0.1);
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.context && this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : this.volume, this.context.currentTime, 0.1);
    }
  }

  setWeather(kind: "clear" | "rain" | "mist" | "sun") {
    this.ramp(this.rain, kind === "rain" ? 0.05 : 0);
    this.ramp(this.wind, kind === "mist" ? 0.03 : kind === "sun" ? 0.045 : 0.075);
  }

  /** Nearness to the stream, 0..1. */
  setWaterNearness(value: number) {
    if (!this.water) return;
    const target = 0.012 + value * 0.05;
    if (Math.abs(target - this.water.target) < 0.004) return;
    this.ramp(this.water, target, 0.5);
  }

  footstep(inWater: boolean) {
    const context = this.context;
    const master = this.master;
    if (!context || !master || this.muted) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(inWater ? 190 : 85, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(inWater ? 120 : 48, context.currentTime + 0.08);
    gain.gain.setValueAtTime(inWater ? 0.018 : 0.024, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0008, context.currentTime + 0.1);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.12);
  }

  chime(frequency: number) {
    const context = this.context;
    const master = this.master;
    if (!context || !master || this.muted) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.035, context.currentTime + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 1.6);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start();
    oscillator.stop(context.currentTime + 1.7);
  }

  private softTone(frequency: number, duration: number, volume = 0.018) {
    const context = this.context;
    const master = this.master;
    if (!context || !master || this.muted) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.72, context.currentTime + duration);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume, context.currentTime + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start();
    oscillator.stop(context.currentTime + duration + 0.04);
  }

  flutter() {
    this.softTone(560, 0.16, 0.009);
    window.setTimeout(() => this.softTone(720, 0.12, 0.007), 70);
  }

  splash() {
    this.softTone(240, 0.22, 0.016);
  }

  sip() {
    this.softTone(330, 0.45, 0.012);
    window.setTimeout(() => this.softTone(410, 0.38, 0.009), 220);
  }

  dig() {
    this.softTone(105, 0.18, 0.014);
    window.setTimeout(() => this.softTone(82, 0.2, 0.011), 150);
  }
}

export const audio = new ForestAudio();
