class ForestAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private wind: GainNode | null = null;
  private water: GainNode | null = null;
  private muted = false;
  private volume = 0.45;

  init() {
    if (this.context) {
      void this.context.resume();
      return;
    }
    const context = new AudioContext();
    const master = context.createGain();
    master.gain.value = this.muted ? 0 : this.volume;
    master.connect(context.destination);
    this.context = context;
    this.master = master;
    this.wind = this.makeNoiseLayer(420, 0.08);
    this.water = this.makeNoiseLayer(1200, 0.035);
  }

  private makeNoiseLayer(frequency: number, gainValue: number) {
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
    return gain;
  }

  setVolume(value: number) {
    this.volume = value;
    if (this.context && this.master && !this.muted) {
      this.master.gain.setTargetAtTime(value, this.context.currentTime, 0.08);
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.context && this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : this.volume, this.context.currentTime, 0.08);
    }
  }

  calmWind(calm: boolean) {
    if (!this.context || !this.wind) return;
    this.wind.gain.setTargetAtTime(calm ? 0.018 : 0.08, this.context.currentTime, 0.8);
  }

  footstep() {
    const context = this.context;
    const master = this.master;
    if (!context || !master || this.muted) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(85, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(48, context.currentTime + 0.08);
    gain.gain.setValueAtTime(0.025, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.09);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.1);
  }
}

export const forestAudio = new ForestAudio();