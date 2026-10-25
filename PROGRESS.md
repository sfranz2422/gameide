# Progress

## Phase 1 — Runtime + Python bridge ✅ (2026-10-25, waiting for review)

### Done

- **Game loop** (`engine/loop.ts`): fixed 60 steps a second whatever the
  monitor's refresh rate, drawing once per animation frame, and catching up
  at most 4 steps before it slows down rather than freezing the tab.
- **Instances and shared state** (`engine/layout.ts`, `python/runtime.py`):
  every instance's built-in properties live in one array of doubles that
  Python allocates and JavaScript views directly in the WebAssembly heap.
  `self.x += 4` and the engine's motion code touch the same number, and
  nothing is copied across the bridge per frame.
- **Motion** applied by the engine after Step: `hspeed`, `vspeed`, `speed`,
  `direction` (kept in step with each other both ways), `gravity`,
  `gravity_direction`, `friction`, and animation (`image_index`,
  `image_speed`).
- **Collisions** (`engine/spatialHash.ts`, `engine/engine.ts`): a spatial
  hash with 64 px cells. `place_meeting`, `place_free`, `instance_place`,
  `collision_point`, `instance_nearest` and `move_and_collide` all run in the
  engine. A query made during a Step event sees moves made earlier in that
  same step: property setters queue the instance in a shared "dirty" list,
  and the engine drains it before every query. Collision events, parent
  inheritance (a child fires its parent's collision event unless it has its
  own), and GameMaker's "solid puts you back" rule all work.
- **Events**: Create, Destroy, Clean Up, Begin Step, Step, End Step, Draw,
  Collision, Keyboard down/pressed/released (per key and `any`), mouse on an
  instance and global mouse, Alarm 0–11, Room Start/End, Game Start,
  Animation End, Outside Room and Intersect Boundary. They run in
  GameMaker's order within a step.
- **The one Python call per frame**: JavaScript calls `_frame()` once. Python
  runs the events up to Step, calls back into the engine once for motion and
  collision detection, then runs Collision, End Step and Draw, and returns
  a small JSON string of commands (usually `None`). The only other crossings
  are the collision queries a student's code makes, and those pass numbers
  only.
- **Input**: keys by physical position (WASD works on any layout), presses
  latched so a tap between two steps is never lost, everything released when
  the window loses focus, and keys only reach the game while its canvas has
  focus, so typing in the editor later will not move the player.
- **Rooms**: `room_goto`, `room_restart`, `game_restart`, persistent
  instances, `global_vars`, `room_width`, `room_height`.
- **Drawing**: `draw_self`, `draw_sprite`, `draw_text`, `draw_rect`,
  `draw_set_color` in Draw events, rendered with PixiJS v8 at the
  instance's depth.
- **Errors reach the student in words**: Object → event → line, with only
  the student's own lines in the traceback; syntax errors stop the game
  loading; misspelt event names (`on_stepp`), collision events aimed at an
  object that doesn't exist, drawing outside `on_draw`, and unknown object,
  sprite or key names all get a warning or error with "Did you mean …?".
- **Destroyed instances stay readable**: code that keeps a reference to a
  destroyed enemy reads where it really was, not the values of whatever new
  instance reused its slot.
- **API catalog** (`catalog/api.ts`): every function, variable and instance
  property with its parameters and a beginner description. A test checks it
  against the runtime both ways, so it can't drift.
- **Demos**: Collect the coins (a maze, arrow keys, `move_and_collide`, a
  collision event, an animated coin, a HUD in a Draw event, R to restart)
  and a stress test (300 balls with Python Step and Collision events; Space
  adds 100, Backspace removes 100). The toolbar shows FPS, the instance
  count and the milliseconds spent in Python and in the engine. The debug
  overlay toggle draws every collision mask.
- **Pyodide** is served from the app's own origin, out of `node_modules`,
  not from a CDN, and stays loaded between runs.
- `data-tutorial` attributes are on the toolbar, Play, Stop, the debug
  toggle, the game pane, the canvas and the console.

### Measured

| | node (Vitest) | headless Chromium |
|---|---|---|
| 300 instances with a Step event | 0.4 ms / step | 0.9 ms Python + 0.2 ms engine, steady 60 fps |
| Collect the coins (178 instances) | — | 0.2 ms / step, 60 fps |
| Second Play after Stop | — | 0.3 s |

### Tests

```
cd frontend
npm test          # Vitest: 40 checks, including 25 that run real Pyodide
npm run e2e       # Playwright: builds, serves, plays both demos in Chromium
npm run typecheck
python3 scripts/sabotage.py   # the house rule, see below
```

Every check has been watched to fail. `scripts/sabotage.py` holds 37 small
deliberate bugs, one per guarded behaviour. It applies each one, runs the
test that should catch it, confirms that test fails, and restores the
source. Two checks were too weak at first: friction reversing, and
`instance_nearest` answering the asker. Both were tightened until they
failed. The browser test was falsified by hand (keys never reaching the
game).

### Known issues and gaps

1. **An infinite loop in a student's event freezes the tab.** Pyodide runs
   on the page's main thread, because the frame call has to be synchronous
   with drawing. The fix needs a decision in Phase 2. The options are a step
   budget enforced with `sys.settrace`, which costs speed on every line, or
   moving Python into a worker with a `SharedArrayBuffer`, which needs
   cross-origin-isolation headers from the server and changes the bridge.
2. **Collision masks ignore `image_angle`.** A rotated sprite collides as
   its unrotated box. Rotated and circle masks come with Phase 4's mask
   editor.
3. **Error line numbers count lines of the object's whole class.** Phase 2
   maps them to the line within the event the student typed.
4. **Only Chromium is tested automatically.** Firefox and Edge are not yet
   in the Playwright config (each is another browser download).
5. **`move_and_collide`** does not slide along slopes, and an instance that
   starts inside a wall can't move out of it.
6. **Outside Room and Intersect Boundary fire once** when the instance
   crosses, not on every step it stays outside. This is deliberate, so a
   bullet's `destroy()` isn't called sixty times.
7. **Within one depth**, `draw_self()` is drawn under that depth's
   `draw_text`/`draw_rect`, whatever order they were called in.
8. The production bundle is 570 kB (PixiJS is most of it). Splitting the
   editor from the player can wait until the editor exists.
9. Camera, sound and `tile_at` are in the spec's API but belong to Phases 5,
   9 and 6. They are not in the catalog until they exist.

### Changes from the spec

- **The backend will be Flask + SQLAlchemy + Authlib, not Django**, sharing
  PyIDE's `accounts.py`, database and Google client, so one sign-in and one
  XP total cover all four apps (decided 2026-10-25). Phase 3 follows that.

### Decisions needed before later phases

- **Phase 2: the infinite-loop guard** (known issue 1). My recommendation is
  the worker with `SharedArrayBuffer`. It also keeps the editor responsive
  while a game runs. Render can send the two headers it needs.
- **Phase 3: where uploaded images and sounds live.** The choice is a Render
  disk or S3-compatible storage such as Cloudflare R2. A Render disk is
  simplest, but ties the service to one instance and isn't backed up. R2
  has free egress and a free tier of 10 GB. The spec asks me to propose and
  then ask; this is the proposal.

## Next: Phase 2 — Project model + object editor (Python only)

Project data format, IndexedDB save/load, resource tree, object editor with
events and a code editor, Play from the project, console, and error mapping.
