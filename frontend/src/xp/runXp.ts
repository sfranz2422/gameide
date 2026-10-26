/**
 * A game ran without an error: tell the server, which may pay XP for it
 * (backend/rewards.py, xp_run). The server decides everything — whether the
 * student has worked long enough since the last run that paid, whether the
 * code changed — and mostly answers "not yet", which shows nothing.
 *
 * All this sends is a hash of the game's code, never the code: the server
 * needs to know the code CHANGED, not what it says, and a POST full of
 * code is exactly what Render's firewall blocks. Fire and forget: a run
 * never waits on this or fails because of it.
 */
import { api } from "../store/api";
import type { Project } from "../store/project";

/** FNV-1a from a given start; twice, below, for 64 bits. Not security — the time limit is. */
function fnv(text: string, seed: number): string {
  let h = seed >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * The game's code, and only its code: every event's, every script's, every
 * instance's creation code — so moving a sprite's origin or
 * renaming the game isn't "changed code", and changing a line anywhere is.
 */
export function codeHash(p: Project): string {
  const parts: string[] = [];
  for (const o of p.objects) for (const e of o.events) parts.push(`${o.id}:${e.id}:${e.code}`);
  for (const s of p.scripts) parts.push(`s:${s.id}:${s.code}`);
  for (const r of p.rooms) for (const i of r.instances) if (i.code) parts.push(`i:${i.id}:${i.code}`);
  const text = parts.join("\n");
  return fnv(text, 2166136261) + fnv(text, 0x9747b28c);
}

/** What the page shows when XP arrives (xp/XpToasts.tsx listens). */
export function announceXp(xp: number, reason: string) {
  window.dispatchEvent(new CustomEvent("gameide-xp", { detail: { xp, reason } }));
}

export async function claimRun(p: Project): Promise<void> {
  try {
    const r = await api<{ awarded: number }>("/api/xp/run", { json: { code: codeHash(p) } });
    if (r.awarded) announceXp(r.awarded, "Your game ran");
  } catch {
    /* a run's XP is all that is lost */
  }
}
