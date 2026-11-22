import type { QuestEventKind } from '../shared/quest.js';
import type { QuestTheme } from '../shared/quest-levels.js';

type Note = number | null;

interface Tune {
  bpm: number;
  root: number;
  lead: Note[];
  bass: Note[];
  wave: OscillatorType;
  hat: boolean;
}

const TUNES: Record<QuestTheme, Tune> = {
  meadow: { bpm: 132, root: 60, wave: 'square', hat: true, lead: [0, 4, 7, 12, 7, 4, 0, null, 2, 5, 9, 14, 9, 5, 2, null, 4, 7, 12, 16, 12, 7, 4, null, 5, 9, 12, 7, 4, 2, 0, null], bass: [0, null, 7, null, -5, null, 2, null, 0, null, 7, null, 5, null, 2, null] },
  hills: { bpm: 138, root: 62, wave: 'square', hat: true, lead: [0, 7, 12, 7, 4, 7, 12, 16, 14, 12, 7, 4, 2, 4, 7, null, 9, 12, 16, 12, 9, 7, 4, 2, 0, 4, 7, 12, 7, 4, 0, null], bass: [0, 0, 7, 7, -3, -3, 4, 4, 2, 2, 9, 9, 5, 5, 0, 0] },
  cave: { bpm: 108, root: 57, wave: 'triangle', hat: false, lead: [0, null, 3, null, 7, null, 10, null, 12, null, 10, null, 7, null, 3, null, 5, null, 8, null, 12, null, 15, null, 12, null, 8, null, 5, null, 3, null], bass: [0, null, null, 0, -5, null, null, -5, -3, null, null, -3, -7, null, null, -7] },
  sky: { bpm: 126, root: 65, wave: 'triangle', hat: true, lead: [0, 4, 7, 11, 12, 11, 7, 4, 5, 9, 12, 16, 17, 16, 12, 9, 7, 11, 14, 19, 17, 14, 11, 7, 4, 7, 12, 16, 12, 7, 4, null], bass: [0, null, 7, null, 5, null, 12, null, 2, null, 9, null, 7, null, 4, null] },
  desert: { bpm: 120, root: 59, wave: 'sawtooth', hat: true, lead: [0, 1, 4, 5, 7, 8, 11, 12, 11, 8, 7, 5, 4, 1, 0, null, 7, 8, 11, 12, 14, 15, 18, 19, 18, 15, 14, 12, 11, 8, 7, null], bass: [0, 0, null, 0, -5, -5, null, -5, 1, 1, null, 1, -4, -4, null, -4] },
  snow: { bpm: 116, root: 64, wave: 'triangle', hat: true, lead: [0, 4, 7, 12, 14, 12, 7, 4, 2, 5, 9, 14, 16, 14, 9, 5, 4, 7, 11, 16, 17, 16, 11, 7, 5, 9, 12, 7, 4, 2, 0, null], bass: [0, null, 4, null, 7, null, 4, null, -3, null, 2, null, 5, null, 2, null] },
  candy: { bpm: 144, root: 67, wave: 'square', hat: true, lead: [0, 4, 7, 4, 12, 7, 4, 7, 9, 12, 16, 12, 9, 12, 16, 19, 17, 16, 12, 9, 7, 4, 7, 12, 14, 12, 9, 7, 4, 2, 0, null], bass: [0, 7, 0, 7, 5, 12, 5, 12, 2, 9, 2, 9, 7, 14, 7, 14] },
  sea: { bpm: 100, root: 58, wave: 'sine', hat: false, lead: [0, null, 5, null, 9, null, 12, null, 14, null, 12, null, 9, null, 5, null, 7, null, 12, null, 16, null, 19, null, 16, null, 12, null, 7, null, 5, null], bass: [0, null, null, null, -5, null, null, null, -3, null, null, null, -7, null, null, null] },
  night: { bpm: 112, root: 56, wave: 'triangle', hat: false, lead: [0, 3, 7, 10, 12, 10, 7, 3, 5, 8, 12, 15, 17, 15, 12, 8, 7, 10, 14, 17, 19, 17, 14, 10, 8, 12, 15, 10, 7, 3, 0, null], bass: [0, null, 3, null, -4, null, 0, null, -2, null, 1, null, -5, null, -2, null] },
  lava: { bpm: 140, root: 55, wave: 'sawtooth', hat: true, lead: [0, 0, 7, 0, 10, 0, 7, 0, 12, 12, 10, 7, 5, 3, 0, null, 0, 0, 8, 0, 12, 0, 8, 0, 15, 15, 12, 10, 8, 7, 5, null], bass: [0, 0, 0, 0, -5, -5, -5, -5, -3, -3, -3, -3, -7, -7, -7, -7] },
  rainbow: { bpm: 150, root: 69, wave: 'square', hat: true, lead: [0, 4, 7, 12, 16, 19, 16, 12, 14, 17, 21, 24, 21, 17, 14, 12, 11, 14, 19, 23, 19, 14, 11, 7, 9, 12, 16, 12, 7, 4, 0, null], bass: [0, 7, 12, 7, 5, 12, 17, 12, 2, 9, 14, 9, 7, 14, 19, 14] },
  castle: { bpm: 128, root: 53, wave: 'sawtooth', hat: true, lead: [0, 0, 12, 0, 10, 0, 7, 0, 8, 8, 20, 8, 7, 8, 5, null, 0, 0, 12, 0, 15, 0, 12, 0, 17, 15, 12, 10, 8, 7, 5, null], bass: [0, 0, -5, -5, -3, -3, -7, -7, 0, 0, -5, -5, -2, -2, -7, -7] },
};

const SFX: Partial<Record<QuestEventKind, { freq: number; to: number; dur: number; wave: OscillatorType; gain: number; sweep?: 'up' | 'down' }>> = {
  jump: { freq: 380, to: 720, dur: 0.16, wave: 'square', gain: 0.16, sweep: 'up' },
  coin: { freq: 988, to: 1319, dur: 0.13, wave: 'square', gain: 0.15, sweep: 'up' },
  stomp: { freq: 240, to: 90, dur: 0.14, wave: 'square', gain: 0.2, sweep: 'down' },
  bump: { freq: 160, to: 110, dur: 0.08, wave: 'triangle', gain: 0.16, sweep: 'down' },
  break: { freq: 520, to: 120, dur: 0.2, wave: 'sawtooth', gain: 0.16, sweep: 'down' },
  power: { freq: 523, to: 1046, dur: 0.34, wave: 'square', gain: 0.17, sweep: 'up' },
  heal: { freq: 660, to: 990, dur: 0.24, wave: 'sine', gain: 0.18, sweep: 'up' },
  star: { freq: 784, to: 1568, dur: 0.4, wave: 'square', gain: 0.16, sweep: 'up' },
  hurt: { freq: 300, to: 90, dur: 0.3, wave: 'sawtooth', gain: 0.2, sweep: 'down' },
  spring: { freq: 300, to: 1200, dur: 0.26, wave: 'sine', gain: 0.2, sweep: 'up' },
  shoot: { freq: 900, to: 400, dur: 0.1, wave: 'sawtooth', gain: 0.12, sweep: 'down' },
  checkpoint: { freq: 660, to: 1320, dur: 0.3, wave: 'triangle', gain: 0.18, sweep: 'up' },
  kick: { freq: 420, to: 180, dur: 0.14, wave: 'square', gain: 0.17, sweep: 'down' },
  land: { freq: 150, to: 90, dur: 0.07, wave: 'triangle', gain: 0.1, sweep: 'down' },
  boss: { freq: 180, to: 60, dur: 0.36, wave: 'sawtooth', gain: 0.24, sweep: 'down' },
  gate: { freq: 300, to: 1200, dur: 0.6, wave: 'square', gain: 0.2, sweep: 'up' },
  fall: { freq: 500, to: 80, dur: 0.4, wave: 'triangle', gain: 0.16, sweep: 'down' },
  bubble: { freq: 700, to: 300, dur: 0.3, wave: 'sine', gain: 0.16, sweep: 'down' },
  revive: { freq: 400, to: 1000, dur: 0.36, wave: 'sine', gain: 0.2, sweep: 'up' },
  partner: { freq: 500, to: 1400, dur: 0.24, wave: 'square', gain: 0.18, sweep: 'up' },
  link: { freq: 1200, to: 1600, dur: 0.1, wave: 'sine', gain: 0.1, sweep: 'up' },
  dash: { freq: 700, to: 220, dur: 0.18, wave: 'sawtooth', gain: 0.16, sweep: 'down' },
  guard: { freq: 300, to: 900, dur: 0.32, wave: 'triangle', gain: 0.2, sweep: 'up' },
  guardBreak: { freq: 1100, to: 500, dur: 0.16, wave: 'square', gain: 0.16, sweep: 'down' },
  win: { freq: 523, to: 1568, dur: 0.7, wave: 'square', gain: 0.2, sweep: 'up' },
};

function midiToFreq(note: number) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

export class QuestAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private timer: number | null = null;
  private tune: Tune | null = null;
  private step = 0;
  private nextTime = 0;
  private muted = false;
  private lastPlayed = new Map<string, number>();

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
    this.musicGain.gain.value = 0.34;
    this.musicGain.connect(this.master);
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.55, this.context.currentTime, 0.03);
    }
  }

  play(kind: QuestEventKind) {
    if (!this.context || !this.master || this.muted) return;
    const spec = SFX[kind];
    if (!spec) return;
    const now = this.context.currentTime;
    const last = this.lastPlayed.get(kind) ?? 0;
    if (now - last < 0.045) return;
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
    if (kind === 'break' || kind === 'stomp' || kind === 'boss') this.noise(spec.dur * 0.8, spec.gain * 0.5);
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
    filter.frequency.value = 1400;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
  }

  startMusic(theme: QuestTheme) {
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
      if (lead !== null) this.voice(midiToFreq(this.tune.root + lead), this.nextTime, beat * 0.86, this.tune.wave, 0.16);
      if (bass !== null) this.voice(midiToFreq(this.tune.root - 24 + bass), this.nextTime, beat * 1.5, 'triangle', 0.2);
      if (this.tune.hat && this.step % 2 === 1) this.hat(this.nextTime);
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
    const length = Math.floor(this.context.sampleRate * 0.04);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const filter = this.context.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    const gain = this.context.createGain();
    gain.gain.value = 0.05;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    source.start(time);
  }

  dispose() {
    this.stopMusic();
    void this.context?.close();
    this.context = null;
    this.master = null;
    this.musicGain = null;
  }
}