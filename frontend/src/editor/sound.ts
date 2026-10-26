/**
 * Plays a game's sounds, on the page. The game itself runs in a worker,
 * where browsers give no audio, so Python sends orders ("play coin", "stop
 * music") with each frame's commands and this plays them with Web Audio.
 *
 * Before a game starts, every sound is decoded here (once per file, kept
 * between plays) and its length goes to Python, which answers
 * sound_playing() from that without asking the page.
 *
 * Browsers only let a page make sound after the person has clicked or
 * pressed something on it. Play is such a click, so the audio context is
 * made then; until it is running, orders are quietly dropped rather than
 * queued to burst out together later.
 */
import type { SoundDef, SoundOrder } from "../engine/game";

export class SoundPlayer {
  private ctx: AudioContext | null = null;
  private decoded = new WeakMap<Blob, AudioBuffer>();
  private buffers = new Map<string, { buffer: AudioBuffer; volume: number }>();
  private playing = new Map<string, Set<AudioBufferSourceNode>>();
  private music: AudioBufferSourceNode | null = null;
  /** Every order carried out, for the tests ("play coin", "music theme"…). */
  readonly log: string[] = [];
  /** How many sounds really started through Web Audio (decoded, context running) — for the tests. */
  started = 0;

  private context(): AudioContext {
    this.ctx ??= new AudioContext();
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /**
   * Decodes the game's sounds and returns them as the worker needs them:
   * names, volumes and lengths, without the files. A file that can't be
   * decoded is kept with length 0, and `warn` says so; the game still runs.
   */
  async prepare(sounds: SoundDef[], warn: (text: string) => void): Promise<SoundDef[]> {
    this.buffers.clear();
    const ctx = this.context();
    const out: SoundDef[] = [];
    for (const s of sounds) {
      let buffer = s.sound ? this.decoded.get(s.sound) : undefined;
      if (!buffer && s.sound) {
        try {
          buffer = await ctx.decodeAudioData(await s.sound.arrayBuffer());
          this.decoded.set(s.sound, buffer);
        } catch {
          warn(`The sound ${s.name} couldn't be read as audio (MP3, OGG or WAV), so it plays as silence.\n`);
        }
      }
      if (buffer) this.buffers.set(s.name, { buffer, volume: s.volume ?? 1 });
      out.push({ name: s.name, duration: buffer?.duration ?? 0, volume: s.volume ?? 1 });
    }
    return out;
  }

  run(orders: SoundOrder[]) {
    for (const o of orders) {
      this.log.push(o.slice(0, 2).join(" "));
      switch (o[0]) {
        case "play":
          this.start(o[1], !!o[2], o[3], false);
          break;
        case "music":
          this.stopMusic();
          this.music = this.start(o[1], !!o[2], o[3], true);
          break;
        case "stop":
          for (const n of this.playing.get(o[1]) ?? []) n.stop();
          this.playing.delete(o[1]);
          break;
        case "stop_all":
          this.stopSounds();
          break;
        case "music_stop":
          this.stopMusic();
          break;
      }
    }
  }

  private start(name: string, loop: boolean, volume: number, music: boolean): AudioBufferSourceNode | null {
    const s = this.buffers.get(name);
    const ctx = this.ctx;
    if (!s || !ctx || ctx.state !== "running") return null;
    const node = ctx.createBufferSource();
    node.buffer = s.buffer;
    node.loop = loop;
    const gain = ctx.createGain();
    gain.gain.value = s.volume * volume;
    node.connect(gain).connect(ctx.destination);
    node.start();
    this.started++;
    if (!music) {
      const set = this.playing.get(name) ?? new Set();
      set.add(node);
      this.playing.set(name, set);
      node.onended = () => set.delete(node);
    }
    return node;
  }

  private stopSounds() {
    for (const set of this.playing.values()) for (const n of set) n.stop();
    this.playing.clear();
  }

  private stopMusic() {
    this.music?.stop();
    this.music = null;
  }

  /** The game stopped: silence, sounds and music alike. */
  stopAll() {
    this.stopSounds();
    this.stopMusic();
  }
}
