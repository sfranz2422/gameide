# GameIDE

A GameMaker-style game IDE scripted in Python, for intro programming
classes. Built in phases from the spec (a copy is on the teacher's Desktop as
SPEC.md); **stop for review at the end of every phase**, after running the
tests and updating PROGRESS.md.

## Layout

`frontend/` is Vite + React + strict TypeScript. `src/engine/` (no Pixi, no
Pyodide; runs headless in node), `src/engine/render/` (PixiJS), `src/python/`
(the bridge, `runtime.py`, the game worker, `codegen.ts`), `src/catalog/`
(the API catalog), `src/store/` (the project format, IndexedDB, templates),
`src/editor/` (the React UI). `blocks/`, `eventsheets/` wait for their
phases. `backend/` arrives in Phase 3.

## The game runs in a worker

`python/gameWorker.ts` holds Pyodide, the engine, the renderer (on an
OffscreenCanvas) and the loop. The page (`editor/gameHost.ts`) only sends
input and a canvas, and gets stats, output and errors back. The page's
**watchdog** interrupts Python through a SharedArrayBuffer when the worker
goes quiet for 2 s, so an endless loop is reported at its line.
SharedArrayBuffer needs **COOP `same-origin` + COEP `credentialless`** on
every page. `vite.config.ts` sends them in dev and preview; **the Flask
server must send them too**, or the interrupt silently degrades to killing
the worker with no line number. `?nointerrupt` forces that fallback, for
testing.

## Projects and code generation

- The project is plain JSON (`store/project.ts`), resources linked by id.
  Tutorial checks will read it directly, so keep it free of derived data.
- `mutate(recipe)` recipes must not create ids: React may run them twice.
  Make new things first, then push them in.
- Each event is a method body; `codegen.ts` builds the classes (parents
  first, every object gets one) and a line map, so errors land on the
  student's own line. One body line must stay one generated line.
- Autosave also writes a localStorage backup as the page hides, because an
  IndexedDB write started while a tab closes may never finish.

## The bridge — read before touching runtime.py or engine.ts

- Instance state is **one Float64Array shared by both sides**: Python
  allocates it (`array('d')`) and JS views the same WebAssembly memory. The
  field layout lives only in `engine/layout.ts` and is handed to Python at
  load. Never type an index into runtime.py.
- **Views go stale silently.** Any Python allocation can grow the WASM heap,
  which detaches every view (length 0, reads as zero, writes vanish).
  `Engine.fresh()` re-takes them; every entry point from Python must call
  it. A new shared array needs adding to `_arrays()`, `acquire()` and
  `SharedViews` together.
- **One call from JS per frame** (`_frame`), one call back (`motion`), plus
  the collision queries students make, which pass numbers only. Don't add
  per-instance crossings; anything per-pixel or per-pair belongs in the
  engine, never in Python.
- **Property setters that change a collision box** (x, y, scale, sprite)
  must queue the slot in the dirty list, or a query later in the same step
  tests against stale positions. Pinned by a test.
- Destroyed instances become "ghosts" at frame end (`_ghost`), so a kept
  reference reads its last values, not the next owner of its slot.

## Tests

```
cd frontend && npm test && npm run e2e && npm run typecheck
```

**Every check must have been watched to fail.** `scripts/sabotage.py`
holds one deliberate bug per guarded behaviour, applies each, confirms the
named test fails, and restores. Add a case whenever you add a check; a case
that prints MISS is a test that lets the bug through. A sabotage must still
compile (strict TypeScript refuses unused names), and a case can run a
Playwright test instead of Vitest. Its usual traps, all hit already: the
bug lands where the check can't see it (an error on an event's last line
hides an off-by-one), or the test never produced the condition it names.

## Backend (Phase 3) — decided, not in the spec

**Flask + SQLAlchemy + Authlib, sharing PyIDE's `accounts.py`, database and
Google client** — not Django as the spec says — so one sign-in and one XP
total cover PyIDE, WebIDE, FlaskIDE and this. `accounts.py` then becomes a
fourth byte-identical copy; GameIDE's own tables are prefixed `gameide_`.
The PyIDE CLAUDE.md's rules about `accounts.py`, `LATER_COLUMNS`, two
gunicorn workers and `TEACHER_EMAILS` all apply here too.

## Style

Comments explain *why*, especially where the reason is a bug that already
happened. Say so in a comment when something fails silently — a stale view,
a misspelt event name, a draw call outside `on_draw` — because silent
failure is what students can't debug.
