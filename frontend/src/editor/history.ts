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
 * Code is not part of it, typed or made with blocks. Code has its own undo,
 * inside its editor, and an undo here must never touch it: restoring an
 * older snapshot keeps every event's, script's and creation code's current
 * text, and an event's blocks (`keepCode`). Without
 * that, undoing a sprite change would quietly throw away ten minutes of
 * typing done since.
 */
import type { BlocksState } from "../blocks/blockState";
import type { Project } from "../store/project";

/** Anything with code in it: an event, a script, a room instance's creation code. Ids are unique across all. */
type CodeHolder = { id: string; code: string; mode?: "python" | "blocks"; blocks?: BlocksState };

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
  // Events, scripts and creation code. Their blocks are code too, and so
  // is whether they are blocks at all: undoing a sprite change must not
  // turn blocks back into Python, or Python (after Convert) back into blocks.
  const holders = (p: Project): CodeHolder[] => [
    ...p.objects.flatMap((o) => o.events),
    ...p.scripts,
    ...p.rooms.flatMap((r) => r.instances),
  ];
  const now = new Map(holders(current).map((h) => [h.id, h]));
  for (const h of holders(out)) {
    const n = now.get(h.id);
    if (!n) continue;
    h.code = n.code;
    if (n.mode) h.mode = n.mode;
    else delete h.mode;
    if (n.blocks) h.blocks = structuredClone(n.blocks);
    else delete h.blocks;
  }
  return out;
}

export class History {
  past: Step[] = [];
  future: Step[] = [];
  private group: string | null = null;
  private at = 0;

  /** A change is about to replace `before`. */
  record(before: Project, opts: RecordOptions = {}, now = Date.now()) {
    // A change with no label is a step of its own: two unlabelled changes
    // can't be told apart, and grouping them merged adding an event with
    // the tick made a moment later, so undoing the tick deleted the event.
    const group = opts.group ?? (opts.label !== undefined ? `auto:${opts.label}` : null);
    const same = group !== null && this.group === group && (opts.group !== undefined || now - this.at < GROUP_MS);
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
