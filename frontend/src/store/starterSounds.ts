/**
 * Starter sounds, as starter sprites are: a few classic game noises a
 * student can add with one click, made here as WAV files rather than shipped
 * — the sfxr way: square waves, sweeps and noise, each a handful of lines.
 *
 * Pure functions (no Web Audio), so they run in the tests too.
 */

const RATE = 22050;

type Wave = "square" | "sine" | "noise";

/** One tone: a wave from one pitch to another, fading out. */
function tone(seconds: number, from: number, to: number, wave: Wave, volume = 0.3): Float32Array {
  const n = Math.round(seconds * RATE);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    phase += (from + (to - from) * t) / RATE;
    const v = wave === "square" ? (phase % 1 < 0.5 ? 1 : -1) : wave === "sine" ? Math.sin(phase * 2 * Math.PI) : Math.random() * 2 - 1;
    // A quick fade in (no click) and a fade out.
    out[i] = v * volume * Math.min(1, i / 40) * (1 - t) ** 1.5;
  }
  return out;
}

function join(...parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) out.set(p, (at += p.length) - p.length);
  return out;
}

/** Noise through a filter that closes as it plays: a boom, not a hiss. */
function boom(seconds: number): Float32Array {
  const raw = tone(seconds, 0, 0, "noise", 0.6);
  let y = 0;
  for (let i = 0; i < raw.length; i++) {
    const k = 0.25 * (1 - i / raw.length) + 0.02;
    y += k * (raw[i]! - y);
    raw[i] = y;
  }
  return raw;
}

export const STARTER_SOUNDS: { key: string; describe: string; make: () => Float32Array }[] = [
  { key: "coin", describe: "Pick something up", make: () => join(tone(0.07, 988, 988, "square"), tone(0.3, 1319, 1319, "square")) },
  { key: "jump", describe: "A rising boing", make: () => tone(0.22, 300, 750, "square", 0.25) },
  { key: "hit", describe: "A short crunch", make: () => join(tone(0.04, 220, 110, "square"), tone(0.12, 0, 0, "noise", 0.35)) },
  { key: "explosion", describe: "Boom", make: () => boom(0.7) },
  { key: "powerup", describe: "Up a level", make: () => join(...[523, 659, 784, 1047].map((f) => tone(0.09, f, f, "square", 0.22))) },
  { key: "laser", describe: "Pew", make: () => tone(0.18, 1400, 220, "square", 0.22) },
];

/** 16-bit mono PCM WAV bytes. */
export function wav(samples: Float32Array, rate = RATE): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const v = new DataView(bytes.buffer);
  const text = (at: number, s: string) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  text(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  v.setUint32(16, 16, true); // fmt chunk size
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); // bytes per second
  v.setUint16(32, 2, true); // bytes per sample
  v.setUint16(34, 16, true); // bits
  text(36, "data");
  v.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, s)) * 32767), true));
  return bytes;
}

export const starterSoundBlob = (key: string) => {
  const s = STARTER_SOUNDS.find((x) => x.key === key)!;
  return new Blob([wav(s.make()) as BlobPart], { type: "audio/wav" });
};
