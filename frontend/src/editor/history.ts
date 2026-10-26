/**
 * Undo and redo for the whole project — sprites, objects, tilesets, rooms,
 * the resource tree — kept for as long as the project is open, whichever
 * tab the change was made in.
 *
 * Each change keeps the project as it was before (cheap: every change
 * already makes a new copy, and the old one is never touched again). Changes
 * close together are one step: a whole painted stroke (an explicit group),
 * or a burst of edits with the same label within GROUP_MS — typing "1280"
 * into a width box is one undo, not four.
 *
 * Code is not part of it. Code has its own undo, inside its editor, and an
 * undo here must never touch it: restoring an older snapshot keeps every
 * event's, script's and creation code's current text (`keepCode`). Without
 * that, undoing a sprite change would quietly throw away ten minutes of
 * typing done since.
 */
import type { Project } from "../store/project";

export const GROUP_MS = 1000;
export const MAX_STEPS = 200;

export interface Step {
  project: Project;
  label: string;
}

export interface RecordOptions {
  /** Changes with the same group are one step, however far apart (a drag). */
  group?: string;
  /** What the step did, for the button's tooltip: "paint tiles". */
  label?: string;
}

/** `snapshot`, with all code as it is in `current` wherever the same thing still exists. */
export function keepCode(snapshot: Project, current: Project): Project {
  const out = structuredClone(snapshot);
  const events = new Map<string, string>();
  for (const o of current.objects) for (const e of o.events) events.set(e.id, e.code);
  for (const o of out.objects) for (const e of o.events) if (events.has(e.id)) e.code = events.get(e.id)!;
  const scripts = new Map(current.scripts.map((s) => [s.id, s.code]));
  for (const s of out.scripts) if (scripts.has(s.id)) s.code = scripts.get(s.id)!;
  const creation = new Map<string, string>();
  for (const r of current.rooms) for (const i of r.instances) creation.set(i.id, i.code);
  for (const r of out.rooms) for (const i of r.instances) if (creation.has(i.id)) i.code = creation.get(i.id)!;
  return out;
}

export class History {
  past: Step[] = [];
  future: Step[] = [];
  private group: string | null = null;
  private at = 0;

  /** A change is about to replace `before`. */
  record(before: Project, opts: RecordOptions = {}, now = Date.now()) {
    const group = opts.group ?? `auto:${opts.label ?? ""}`;
    const same = this.group === group && (opts.group !== undefined || now - this.at < GROUP_MS);
    if (!same) {
      this.past.push({ project: before, label: opts.label ?? "" });
      if (this.past.length > MAX_STEPS) this.past.shift();
    }
    this.future = [];
    this.group = group;
    this.at = now;
  }

  /** The next change starts a new step, even with the same label (a drag ended). */
  endGroup() {
    this.group = null;
  }

  undo(current: Project): Project | null {
    const step = this.past.pop();
    if (!step) return null;
    this.future.push({ project: current, label: step.label });
    this.group = null;
    return keepCode(step.project, current);
  }

  redo(current: Project): Project | null {
    const step = this.future.pop();
    if (!step) return null;
    this.past.push({ project: current, label: step.label });
    this.group = null;
    return keepCode(step.project, current);
  }
}
