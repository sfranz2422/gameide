/**
 * A tutorial: markdown with a header, then one step per slide —
 *
 *   ---
 *   title: Collect the Coins
 *   level: Getting Started
 *   time: 20 min
 *   starter: coins-start
 *   description: Pick up coins and keep score.
 *   after: Game Elements 1: The Basics      (only on the shelf "Now You Can Make")
 *   ---
 *   # Coins that disappear
 *   Open **Player** …
 *   highlight: folder-objects
 *   ```check
 *   Player has event collision with Coin
 *   ```
 *   ---
 *   ## Keep score
 *   …
 *
 * Steps are cut at `---` lines exactly as notes are cut into slides
 * (notes/quiz.ts, slides), so a tutorial assigned to a class is an
 * assignment whose notes are the tutorial and nothing about it differs.
 * `highlight:` names a `data-tutorial` target in the editor, spotlit while
 * the step is open. ```check blocks are the step's checks, in the check
 * language (checks/checks.ts); with them, Next stays locked until they pass
 * — strict, the teacher's decision — unless the header says `locked: no`.
 * Code in a step can't be selected (no copying, also the teacher's).
 */
import { allTests, readCheck, type TestLine } from "../checks/checks";
import { pieces, slides } from "../notes/quiz";

export interface TutorialMeta {
  title: string;
  level: string;
  time: string;
  starter: string;
  description: string;
  /** Next waits for each step's checks (true unless the header says `locked: no`). */
  locked: boolean;
  /**
   * A "Now You Can Make" tutorial (a whole game, from nothing) names the
   * shelf whose lessons it uses: the Learn page shows it just after that shelf.
   */
  after: string;
}

export interface Step {
  /** What the step says, without its highlight line. Its checks are still in it, as ```check blocks. */
  md: string;
  checks: TestLine[];
  highlight: string | null;
  /** The first heading, for the list of steps. */
  title: string;
}

export interface Tutorial {
  meta: TutorialMeta;
  steps: Step[];
}

/** The levels the library is shelved by, in order (the spec's). */
/**
 * The shelves, in order. Python Basics comes first: every game lesson is
 * written in Python, so a student starts with the language and then the
 * editor (2026-10-27, the teacher's call).
 */
/**
 * Not a shelf of its own: each of these whole-game tutorials sits after the
 * shelf it names in `after:`, as "Now you can make…" (the teacher's plan,
 * 2026-10-30). One whose shelf isn't there goes at the end.
 */
export const MAKE_LEVEL = "Now You Can Make";

export const LEVELS = ["Python Basics", "Getting Started", "Art and Tiles", "Game Elements 1: The Basics", "Game Elements 2: Adding to the Fun", "Game Elements 3: Advanced Techniques", "Starter Projects", "Top-Down", "Shooters", "Advanced Python"];

const HEADER = /^\s*---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/;
const HIGHLIGHT = /^highlight\s*:\s*([\w-]+)\s*$/i;

/** Whether some notes are a tutorial: they start with a header that has a title. */
export function isTutorial(md: string): boolean {
  const m = HEADER.exec(String(md ?? "").replace(/\r\n?/g, "\n"));
  return !!m && /^title\s*:/im.test(m[1]!);
}

export function splitHeader(md: string): { meta: TutorialMeta; body: string } {
  const text = String(md ?? "").replace(/\r\n?/g, "\n");
  const m = HEADER.exec(text);
  const fields: Record<string, string> = {};
  if (m)
    for (const line of m[1]!.split("\n")) {
      const f = /^([a-z]+)\s*:\s*(.*)$/i.exec(line.trim());
      if (f) fields[f[1]!.toLowerCase()] = f[2]!.trim();
    }
  return {
    meta: {
      title: fields.title || "Untitled tutorial",
      // Not LEVELS[0]: a tutorial that names no shelf is a game lesson, not Python Basics.
      level: fields.level || "Getting Started",
      time: fields.time || "",
      starter: fields.starter || "empty",
      description: fields.description || "",
      locked: !/^(no|false|off)$/i.test(fields.locked ?? ""),
      after: fields.after || "",
    },
    body: m ? text.slice(m[0].length) : text,
  };
}

/** A block written back as a fence that nothing inside it can close. */
function fenced(lang: string, body: string): string {
  const longest = Math.max(0, ...[...body.matchAll(/^ {0,3}(`{3,})/gm)].map((m) => m[1]!.length));
  const mark = "`".repeat(Math.max(3, longest + 1));
  return mark + lang + "\n" + body + "\n" + mark;
}

/**
 * A step's (or a notes slide's) `highlight:` line taken out: the markdown
 * without it, and the first target named. Lines inside code are left alone.
 */
export function takeHighlight(md: string): { md: string; highlight: string | null } {
  let highlight: string | null = null;
  const kept = pieces(md, ["check", "tests"])
    .map((p) => {
      // Fenced again longer than any fence inside: a question that shows
      // code (````quiz around ```py) was cut off at its code's first fence.
      if (p.type === "quiz") return fenced("quiz", p.body);
      if (p.type === "cards") return fenced("cards", p.body);
      if (p.type === "tests") return fenced(p.kind, p.body);
      // Inside a code block, a line is code — `highlight: x` there is an example, kept.
      let fence: string | null = null;
      return p.text
        .split("\n")
        .filter((ln) => {
          const f = /^ {0,3}(`{3,}|~{3,})/.exec(ln);
          if (f) {
            if (fence === null) fence = f[1]!;
            else if (f[1]![0] === fence[0] && f[1]!.length >= fence.length) fence = null;
            return true;
          }
          if (fence !== null) return true;
          const h = HIGHLIGHT.exec(ln.trim());
          if (h && !highlight) highlight = h[1]!;
          return !h;
        })
        .join("\n");
    })
    .join("\n");
  return { md: kept, highlight };
}

/** Spotlight names in notes GameIDE can't point at (the notes editor warns). */
export function unknownHighlights(md: string): string[] {
  const out: string[] = [];
  for (const slide of slides(md).length ? slides(md) : [md]) {
    const h = takeHighlight(slide).highlight;
    if (h && !TARGETS.some((tg) => (tg.endsWith("*") ? h.startsWith(tg.slice(0, -1)) : tg === h))) out.push(h);
  }
  return out;
}

export function parseTutorial(md: string): Tutorial {
  const { meta, body } = splitHeader(md);
  const cut = slides(body);
  const raw = cut.length ? cut : body.trim() ? [body.trim()] : [];
  const steps = raw.map((s) => {
    const { md, highlight } = takeHighlight(s);
    const title = /^#{1,3}\s+(.+)$/m.exec(s)?.[1]?.trim() ?? "";
    return { md, checks: allTests(s, "check"), highlight, title };
  });
  return { meta, steps };
}

/** Problems a tutorial's author should know about: checks GameIDE can't read, spotlights on nothing. */
export function tutorialProblems(t: Tutorial, targets: readonly string[]): string[] {
  const out: string[] = [];
  if (!t.steps.length) out.push("It has no steps yet.");
  t.steps.forEach((s, i) => {
    for (const c of s.checks) if (readCheck(c.label).kind === "unknown") out.push(`Step ${i + 1}: GameIDE can't read the check "${c.label}".`);
    if (s.highlight && !targets.some((tg) => (tg.endsWith("*") ? s.highlight!.startsWith(tg.slice(0, -1)) : tg === s.highlight)))
      out.push(`Step ${i + 1}: there's nothing called "${s.highlight}" to highlight.`);
  });
  return out;
}

/**
 * What a step can spotlight: the editor's `data-tutorial` names. A `*` is
 * a family (resource-player, add-objects…). Kept here so an author is told
 * about a typo; tutorials.test.ts checks every one is still in the editor.
 */
export const TARGETS = [
  "resource-tree", "folder-sprites", "folder-objects", "folder-rooms", "folder-scripts", "folder-sounds", "folder-fonts", "folder-tilesets",
  "add-*", "resource-*", "object-*", "room-tab-*",
  "object-editor", "object-sprite", "object-properties", "object-parent", "object-depth", "event-list", "add-event", "code-editor",
  "tab-blocks", "tab-sheet", "blocks-workspace", "blocks-python", "event-sheet", "sheet-python", "generated-class",
  "sprite-editor", "sprite-origin-tool", "sprite-mask", "sprite-mask-tool", "room-editor", "room-canvas", "room-layers", "room-camera",
  "tileset-editor", "tileset-solid", "tileset-picture", "tileset-cut", "import-picture", "tile-palette", "room-tools", "add-tile-layer", "room-size", "open-library", "autotile-sets", "autotile-brushes", "sound-editor", "font-editor",
  "play", "stop", "game-pane", "game-canvas", "fullscreen", "debug-toggle", "console", "docs", "docs-tab", "notes-tab",
  "project-name", "publish", "game-settings", "editor-tabs",
] as const;
