# GameIDE

A GameMaker-style game IDE scripted in Python, for intro programming
classes. Built in phases from the spec (a copy is on the teacher's Desktop as
SPEC.md); **stop for review at the end of every phase**, after running the
tests and updating PROGRESS.md.

## Layout

`frontend/` is Vite + React + strict TypeScript. `src/engine/` (no Pixi, no
Pyodide; runs headless in node), `src/engine/render/` (PixiJS), `src/python/`
(the bridge and `runtime.py`), `src/catalog/` (the API catalog),
`src/demos/`, `src/editor/`. `blocks/`, `eventsheets/`, `store/` wait for
their phases. `backend/` arrives in Phase 3.

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
that prints MISS is a test that lets the bug through.

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
