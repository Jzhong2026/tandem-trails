import type { RaceEventKind } from '../shared/race.js';
import type { RaceTheme } from '../shared/race-tracks.js';

type Note = number | null;

interface Tune {
  bpm: number;
  root: number;
  lead: Note[];
  bass: Note[];
  wave: OscillatorType;
}

const TUNES: Record<RaceTheme, Tune> = {
  day: { bpm: 150, root: 62, wave: 'square', lead: [0, 7, 12, 7, 4, 7, 12, 16, 14, 12, 7, 4, 2, 4, 7, null, 0, 7, 12, 7, 5, 9, 12, 17, 16, 12, 9, 5, 4, 2, 0, null], bass: [0, 0, 7, 7, 5, 5, 2, 2, 0, 0, 7, 7, 4, 4, 5, 5] },
  sunset: { bpm: 140, root: 60, wave: 'sawtooth', lead: [0, 3, 7, 10, 12, 10, 7, 3, 5, 8, 12, 15, 17, 15, 12, 8, 7, 10, 14, 17, 19, 17, 14, 10, 8, 7, 3, 0, null, null, 0, null], bass: [0, null, 3, null, -4, null, 0, null, -2, null, 1, null, -5, null, -2, null] },
  night: { bpm: 160, root: 57, wave: 'square', lead: [0, 0, 12, 0, 10, 0, 7, 0, 8, 8, 20, 8, 7, 8, 5, null, 0, 0, 12, 0, 15, 0, 12, 0, 17, 15, 12, 10, 8, 7, 5, null], bass: [0, 0, 0, 0, -5, -5, -5, -5, -3, -3, -3, -3, -7, -7, -7, -7] },
};

const SFX: Record<RaceEventKind, { freq: number; to: number; dur: number; wave: OscillatorType; gain: number }> = {
  count: { freq: 440, to: 440, dur: 0.14, wave: 'square', gain: 0.18 },
  go: { freq: 660, to: 1320, dur: 0.4, wave: 'square', gain: 0.22 },
  lane: { freq: 520, to: 760, dur: 0.08, wave: 'triangle', gain: 0.12 },
  hit: { freq: 220, to: 70, dur: 0.28, wave: 'sawtooth', gain: 0.24 },
  station: { freq: 523, to: 1046, dur: 0.34, wave: 'triangle', gain: 0.2 },
  correct: { freq: 784, to: 1568, dur: 0.22, wave: 'square', gain: 0.18 },
  wrong: { freq: 300, to: 150, dur: 0.26, wave: 'sawtooth', gain: 0.16 },
  exit: { freq: 440, to: 880, dur: 0.26, wave: 'triangle', gain: 0.18 },
  eliminated: { freq: 400, to: 60, dur: 0.6, wave: 'sawtooth', gain: 0.24 },
  finish: { freq: 523, to: 1568, dur: 0.7, wave: 'square', gain: 0.22 },
  lowfuel: { freq: 880, to: 440, dur: 0.3, wave: 'square', gain: 0.14 },
};

function midiToFreq(note: number) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

export class RaceAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private timer: number | null = null;
  private tune: Tune | null = null;
  private step = 0;
  private nextTime = 0;
  private muted = false;
  private lastPlayed = new Map<string, number>();
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;

  get isMuted() { return this.muted; }

  unlock() {
    if (this.context) {
      if (this.context.state === 'suspended') void this.context.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.context = new Ctor();
    this.master = this.context.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    this.master.connect(this.context.destination);
    this.musicGain = this.context.createGain();
    this.musicGain.gain.value = 0.3;
    this.musicGain.connect(this.master);
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.55, this.context.currentTime, 0.03);
    }
  }

  play(kind: RaceEventKind) {
    if (!this.context || !this.master || this.muted) return;
    const spec = SFX[kind];
    if (!spec) return;
    const now = this.context.currentTime;
    const last = this.lastPlayed.get(kind) ?? 0;
    if (now - last < 0.04) return;
    this.lastPlayed.set(kind, now);
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = spec.wave;
    osc.frequency.setValueAtTime(spec.freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, spec.to), now + spec.dur);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(spec.gain, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + spec.dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + spec.dur + 0.02);
    if (kind === 'hit' || kind === 'eliminated') this.noise(spec.dur * 0.7, spec.gain * 0.5);
    if (kind === 'finish') this.noise(0.5, 0.12);
  }

  private noise(duration: number, gainValue: number) {
    if (!this.context || !this.master) return;
    const length = Math.floor(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const gain = this.context.createGain();
    gain.gain.value = gainValue;
    const filter = this.context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1200;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
  }

  startEngine() {
    this.unlock();
    if (!this.context || !this.master || this.engineOsc) return;
    this.engineOsc = this.context.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 62;
    this.engineFilter = this.context.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 320;
    this.engineGain = this.context.createGain();
    this.engineGain.gain.value = 0.05;
    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  setEngineIntensity(ratio: number) {
    if (!this.context || !this.engineOsc || !this.engineGain || !this.engineFilter) return;
    const now = this.context.currentTime;
    this.engineOsc.frequency.setTargetAtTime(58 + ratio * 70, now, 0.1);
    this.engineFilter.frequency.setTargetAtTime(280 + ratio * 500, now, 0.1);
    this.engineGain.gain.setTargetAtTime(0.035 + ratio * 0.04, now, 0.12);
  }

  stopEngine() {
    if (this.engineOsc) {
      try { this.engineOsc.stop(); } catch { /* already stopped */ }
      this.engineOsc.disconnect();
      this.engineOsc = null;
    }
    this.engineGain?.disconnect();
    this.engineGain = null;
    this.engineFilter?.disconnect();
    this.engineFilter = null;
  }

  startMusic(theme: RaceTheme) {
    this.unlock();
    if (!this.context) return;
    this.tune = TUNES[theme];
    this.step = 0;
    this.nextTime = this.context.currentTime + 0.08;
    if (this.timer !== null) return;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  stopMusic() {
    if (this.timer !== null) { window.clearInterval(this.timer); this.timer = null; }
    this.tune = null;
  }

  private schedule() {
    if (!this.context || !this.musicGain || !this.tune) return;
    const beat = 60 / this.tune.bpm / 2;
    while (this.nextTime < this.context.currentTime + 0.14) {
      const index = this.step % this.tune.lead.length;
      const lead = this.tune.lead[index];
      const bass = this.tune.bass[this.step % this.tune.bass.length];
      if (lead !== null) this.voice(midiToFreq(this.tune.root + lead), this.nextTime, beat * 0.82, this.tune.wave, 0.14);
      if (bass !== null) this.voice(midiToFreq(this.tune.root - 24 + bass), this.nextTime, beat * 1.4, 'triangle', 0.2);
      if (this.step % 2 === 1) this.hat(this.nextTime);
      this.nextTime += beat;
      this.step++;
    }
  }

  private voice(freq: number, time: number, duration: number, wave: OscillatorType, gainValue: number) {
    if (!this.context || !this.musicGain) return;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(gainValue, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  private hat(time: number) {
    if (!this.context || !this.musicGain) return;
    const length = Math.floor(this.context.sampleRate * 0.03);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const filter = this.context.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    const gain = this.context.createGain();
    gain.gain.value = 0.04;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    source.start(time);
  }

  dispose() {
    this.stopMusic();
    this.stopEngine();
    void this.context?.close();
    this.context = null;
    this.master = null;
    this.musicGain = null;
  }
}