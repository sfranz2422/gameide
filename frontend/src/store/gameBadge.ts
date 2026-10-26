/**
 * The picture on My Games for a game with no sprite named "icon": a small
 * pixel creature made from the game's id — mirrored left to right, as most
 * sprites are, in a colour of its own. The same id always makes the same
 * badge, so a game keeps its face; two games almost never share one, so a
 * shelf of untitled games can still be told apart at a glance (the single
 * gamepad every card used to carry said nothing about which game it was).
 */

export interface Badge {
  /** BADGE_SIZE rows of BADGE_SIZE cells: 0 empty, 1 body, 2 highlight. */
  cells: number[][];
  /** Body and highlight colours, and the background behind them. */
  body: string;
  light: string;
  back: string;
}

export const BADGE_SIZE = 7;

/** FNV-1a: a small, stable hash; Math.random would change the badge every visit. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A small seeded generator (mulberry32), so each cell draws from the id and not from the clock. */
function random(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gameBadge(id: string): Badge {
  const rnd = random(hash(id));
  const half = Math.ceil(BADGE_SIZE / 2);
  const cells: number[][] = [];
  for (let y = 0; y < BADGE_SIZE; y++) {
    const left: number[] = [];
    for (let x = 0; x < half; x++) {
      // Fuller towards the middle, so it reads as one creature and not as noise.
      const centre = 1 - Math.abs(x - (half - 1)) / half;
      const on = rnd() < 0.35 + 0.35 * centre;
      left.push(on ? (rnd() < 0.18 ? 2 : 1) : 0);
    }
    const right = left.slice(0, BADGE_SIZE - half).reverse();
    cells.push([...left, ...right]);
  }
  // Never blank: an id whose draws all came up empty still gets a body.
  if (!cells.some((r) => r.some((c) => c))) cells[3]![3] = 1;
  const hue = hash(id + "hue") % 360;
  return { cells, body: `hsl(${hue}, 60%, 58%)`, light: `hsl(${hue}, 85%, 82%)`, back: `hsl(${hue}, 30%, 22%)` };
}
