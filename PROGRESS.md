# Progress

## Phase 3 — Backend core ✅ (2026-10-25, waiting for review)

### Done

- **The server** is `backend/app.py`, Flask sharing PyIDE's database, Google client and `accounts.py` (a fourth identical copy). Nothing in PyIDE, WebIDE or FlaskIDE had to change.
  - GameIDE's own tables, `gameide_projects`, `gameide_assets` and `gameide_versions`, live in `backend/gamestore.py`. They are created only by this app.
- **Signing in** works exactly as in PyIDE: Google only, the account chooser every time, `TEACHER_EMAILS` for teachers, `ALLOWED_EMAIL_DOMAINS` for who may sign in. Students are signed out after two idle hours; polls don't count as activity.
  - Signing in only adds abilities. Signed out, or with no Google settings at all, the editor keeps projects in the browser as before.
- **Projects in your account:** autosave goes to the server through an offline cache.
  - The top bar says Saved / Saving… / "Offline — saved in this browser" / "Signed out — saved in this browser · Sign in" / Not saved! (with the reason).
  - Work made offline goes up by itself when the connection comes back.
- **Two tabs or two computers** editing one game can't destroy each other's work. The server keeps the version being replaced in History, and the console says so.
- **Pictures** are stored as bytes in Postgres. Only real PNG, JPEG, GIF or WebP files are accepted, judged by their contents. They can't be overwritten once stored.
- **History:**
  - versions are kept automatically about every ten minutes of work, and whenever you press **Save a version** (with an optional name);
  - **Go back to this** restores one, and first keeps what you had, so going back can be undone;
  - versions saved by hand are never pruned; automatic ones keep the newest 40.
- **Size limits**, each with a sentence that names the number: 2 MB of project JSON, 2 MB per picture, 40 MB of pictures per game, 200 MB per person, 300 games per person.
- **Games made before signing in** appear under "In this browser only" with **Move to my account**, so signing in never makes earlier work vanish.
- **Project .zip export and import**, signed in or not. Export is in the editor's top bar; Import is on the front page. An import always becomes a new game and never overwrites one.
- **Render's firewall:** every JSON body is sent base64-packed from the start (FlaskIDE's fix, built in). A test checks the code never appears in a request body.
- **Deployment:** `render.yaml` describes the service. Render's build image has Node, so one build command builds the editor and installs the server.
  - Flask serves the editor with the isolation headers on every response, hashed bundles cached for a year, Pyodide for a day, and the page itself never cached.

### Tests

```
cd frontend
npm test                                                  # Vitest: 57
npm run e2e                                               # Playwright: 11 editor + 7 account tests
../backend/.venv/bin/python ../backend/tests/test_server.py   # 50 server checks
python3 scripts/sabotage.py                               # 82 deliberate bugs, all caught
```

The account tests run the real build served by Flask, with a sign-in that needs no Google and a throwaway database. They cover:
- work opening on a second computer with nothing cached;
- going offline and coming back;
- History, including undoing a restore;
- moving browser games into the account;
- a picture reaching the server;
- two tabs editing one game;
- someone else's project URL being refused.

What the tests and sabotage run found:
- **A real bug: two tabs in the same browser could silently overwrite each other.** They shared the cache's record of which version they were based on, so the server saw no conflict and kept no copy. Each tab now speaks only for what it loaded. This is pinned by a test.
- A race where a picture added during a save could drop off the upload list. I fixed it by inspection; no test covers it (see known issues).
- Three test-side traps:
  - a test checked "Saved" before the save had started;
  - an earlier check left the snapshot cap lowered, which hid a later failure;
  - stale Python bytecode made one sabotage run the previous one's code.

  `CLAUDE.md` now records all three.

### Setting it up on Render (your steps)

1. **New → Web Service** from the `gameide` repo. Use `render.yaml`'s build and start commands, or **New → Blueprint** to read them from the file. Pick the plan in the dashboard.
2. **Environment variables:**
   - `DATABASE_URL`: PyIDE's database **Internal** URL (pyide-db → Connect).
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_EMAIL_DOMAINS` and `TEACHER_EMAILS`: the same values as PyIDE.
   - `SECRET_KEY`: generated.
3. **Google Cloud Console → the OAuth client → Authorized redirect URIs:** add `https://<the GameIDE address>/auth/callback`. The exact string is printed in the service's logs on the first sign-in attempt.
4. The first boot creates the three `gameide_*` tables in the shared database. This only adds tables; nothing existing changes.

### Known issues and gaps

1. **The race fix in `updateMeta` has no test.** Testing it needs a fake IndexedDB the repo doesn't have (it would be one small dev dependency, `fake-indexeddb`; say if you want it).
2. **Teachers approved by an admin** (the spec) is `TEACHER_EMAILS`, as in PyIDE: changing who teaches is a deploy setting. There's no in-app approval queue.
3. Teachers can't see students' projects yet. That arrives with classrooms in Phase 10, and the server refuses anyone but the owner for now.
4. **Deleting is soft:** a deleted game is hidden, not erased, so it can be recovered by hand. There's no Trash page yet. Pictures are kept as long as their game exists, even if no sprite uses them any more.
5. History needs signing in. Signed out, the History button offers sign-in.
6. **`accounts.py` now has four copies.** PyIDE's, WebIDE's and FlaskIDE's `CLAUDE.md` still say three, so a future change there might not be copied here. That's a one-line edit in each repo, not made yet; say if you want it.

### Exports (agreed 2026-10-25)

| Export | When |
|---|---|
| Project .zip import/export | ✅ done in this phase |
| HTML5 .zip, installable web app, Windows/macOS/Linux (Electron shell, unsigned on macOS) | Phase 9 |
| Android APK | dropped |

## Next: Phase 4 — Sprites

Import pictures (PNG/JPG/GIF, file picker and drag-and-drop), the sprite sheet slicer, origin, collision masks (box or circle), and animation, all saved through the server.

---

## Phase 2 — Project model + object editor (Python only) ✅ (2026-10-25, reviewed)

### Done

- **The editor's layout** follows microStudio and adds a few things:
  - a resource tree with every folder visible at once, instead of switching sections from an icon rail;
  - tabs for open resources;
  - the game above Console and Docs on the right;
  - a draggable handle between every pair of panes, with sizes remembered;
  - dark by default, with a light/dark toggle.
- **The project format** (`store/project.ts`) is plain JSON with a schema version.
  - Resources refer to each other by id, so renaming an object never breaks its room instances, its children or the collision events aimed at it.
  - Images are stored apart from the JSON, so a keystroke doesn't rewrite every picture.
- **Saving** goes through a `ProjectStore` interface; `LocalStore` keeps projects in IndexedDB.
  - Autosave runs 0.6 s after the last change, with Saved / Saving… / Not saved! in the top bar.
  - An edit made in the instant before the tab closes is not lost. The page writes a copy to localStorage as it closes, and the next load prefers it.
- **The front page** lists your games and starts new ones from templates: an empty game, Collect the coins, and the stress test.
- **The resource tree** has Sprites, Objects, Rooms and Scripts. Tilesets and Sounds are shown greyed out as "soon".
  - You can create, rename (double-click or F2), duplicate, delete and drag to reorder.
  - Deleting says what else goes with it ("This also removes: 15 instances in Maze, Player's collision event with it").
  - Renaming an object offers to update `"Coin"` wherever it appears in quotes in your code.
  - Names are checked: an object must be a Python name, can't be a Python keyword, and must be unique ignoring case, because collision events are lower case.
- **The object editor** has the sprite, parent (loops refused), depth, visible, solid and persistent settings.
  - The events list has an Add Event menu covering every event type.
  - Each event's code is shown under its real `def on_step(self):` line.
  - The tabs are Python, Blocks and Event Sheet. Blocks and Event Sheet are greyed out until their phases.
  - A read-only **Python class** view shows exactly the class the events make.
- **The code editor** is CodeMirror 6, chosen over Monaco because it is lighter on Chromebooks.
  - Python highlighting and per-event undo history.
  - Autocomplete from the API catalog, with parameters filled in as placeholders.
  - Inside quotes it suggests what that parameter wants: object names in `place_meeting(x, y, "`, keys in `keyboard_check("`, sprites, rooms and colours.
  - Hovering a function shows what it does.
- **The Docs pane** is the catalog, searchable. Clicking an entry types it at the cursor.
- **Errors are mapped** to Object → Event → line *within the event* (codegen.ts keeps a line map). Clicking one opens the object, selects the event and highlights the line.
- **The game runs in a Web Worker** together with Pyodide and the PixiJS renderer (on an OffscreenCanvas), so the editor never freezes.
  - A **watchdog** notices a game that has stopped answering for 2 s. It interrupts Python, and the student is told the exact line: "Player → Step, line 2: …is there a loop that never ends?"
  - The interrupt needs SharedArrayBuffer, so the page is cross-origin isolated (COOP `same-origin` + COEP `credentialless`).
  - Without that, the worker is replaced and the student is told it stopped responding, without a line.
- **The sprite editor** (preview, animation, origin by click or presets) uses a starter library of ten painted sprites. Importing your own art is Phase 4.
- **The room editor** is a settings form and an instance list for now; Phase 5 replaces it with drag and drop.
- **Scripts** (shared Python, run in order before the objects) and **Game settings** (name, steps per second).
- `data-tutorial` attributes are on the tree, every folder's + button, each resource, the object settings, the event list, Add Event, the code editor, the Python-class toggle, Play, Stop, Debug, the console and Docs.

### Measured (headless Chromium)

| | |
|---|---|
| Stress test, 300 instances | 60 fps |
| Second Play after Stop | 0.1–0.4 s |
| `while True:` caught and reported | about 2.8 s after Play |

### Tests

```
cd frontend
npm test                      # Vitest: 53 checks (the bridge, codegen and error mapping in real Pyodide)
npm run e2e                   # Playwright: 9 editor tests in Chromium
npm run typecheck
python3 scripts/sabotage.py   # 57 deliberate bugs; every one is caught
```

The browser tests:
- build a game from an empty project;
- follow an error back to its line, then type the fix;
- stop an endless loop, both with shared memory and without it;
- reload after saving, and reload in the instant after typing;
- rename with quoted references;
- check autocomplete inside quotes;
- run the 300-instance test and time the second Play.

Several checks were too weak until the sabotage run proved it, and were fixed:
- The error-mapping test put its error on the event's last line, where an off-by-one is hidden.
- The tab test didn't mix tabs and spaces in a way Python rejects.
- The `pass`-mapping test didn't test the mapping at all.
- Some sabotages broke the build instead of the behaviour. The harness now explains that a sabotage must still compile.

Bugs the tests found and fixed: a keystroke made just before closing the tab was lost; after clicking an error, each keystroke threw the cursor back to the error line; a stale interrupt could stop the next healthy game; the dev server reloaded the page on the first Play.

### Known issues and gaps

1. **Safari** doesn't support COEP `credentialless`, so it gets the fallback: an endless loop is still stopped, but without its line. Only Chromium is in the automated tests; Firefox and Edge haven't been tried.
2. **The deployed server must send the two isolation headers** (`vite.config.ts` has them for dev and preview). Without them, the interrupt quietly becomes the fallback.
3. A multi-line string inside an event (`"""…"""`) gets its continuation lines indented by the generator, which changes the string's text.
4. Renaming updates only the name in quotes. A name used another way (a variable that happens to match) is left alone on purpose.
5. Zip import/export of projects is in Phase 9 with HTML5 export, although the spec's storage section says it is "always available". Say if you want it sooner.
6. Play runs in the pane only. Playing in a new tab comes with publishing in Phase 9.
7. Phase 1's gaps remain: rotated collision masks and `move_and_collide` on slopes.

### Decisions needed before Phase 3 (resolved: everything on Render, pictures in Postgres)

- **Where uploaded images and sounds live:** a Render disk, or S3-compatible storage such as Cloudflare R2. I recommend R2: it's backed up, isn't tied to one server, and has a 10 GB free tier with no download fees.
- The Flask server will need to send `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: credentialless` on the GameIDE pages. Google sign-in uses redirects (as PyIDE does), so COOP doesn't break it, but anything that opens a popup to another site would need checking.

---

## Phase 1 — Runtime + Python bridge ✅ (2026-10-25, reviewed)

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

