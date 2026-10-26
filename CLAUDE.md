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
`src/editor/` (the React UI), `src/blocks/` (code blocks),
`src/eventsheets/` (event sheets). `backend/` is the Flask server.

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

## Sprites and masks

- A mask is a box, a circle or exact pixels (`engine/sprites.ts`). All of
  them turn with `image_angle` and scale with the instance, using the
  **renderer's own transform** (Pixi rotation = -image_angle), inverted in
  `containsPoint`. "a rotated mask is where the sprite is drawn" pins the
  two together; change one and that test must change with it.
- Exact-pixel masks are not stored: the game's worker reads them from the
  pictures as a game starts (`python/spritePrep.ts`). They are never sent to
  Python (`bridge.ts` strips `images` and `pixelMasks` from its copy).
- "auto" masks are a box the editor refits whenever frames change
  (`store/spriteOps.ts`); a mask the student drew stays.
- `image_speed` multiplies the sprite's `fps`. A sprite with no `fps` (made
  before Phase 4) animates one frame per step, so old games are unchanged.
- Object URLs for pictures are made inside the effect that revokes them
  (`useFrameUrls`), never in a useMemo: React runs effect cleanups twice in
  development and revoked pictures still on screen.

## Rooms and the camera

- The room editor's geometry is in `editor/rooms/roomOps.ts` (pure, tested);
  `RoomEditor.tsx` is the canvas and panels. A drag previews and saves once
  on release; a save per pointer move would clone the project 60×/s.
- `snap` allows 1e-6 of noise: zoom arithmetic turns a click on a line into
  95.99999, and a plain floor moved the instance a whole row.
- The camera lives in the engine (`Engine.camera`, `updateCamera` at the end
  of every step). Shake is `offX/offY`: it moves the picture only, never
  `view_x`, the mouse or collisions. Python's `view_*` are published at the
  start of a step, so they are where the camera was at the end of the last.
- `on_draw_gui` draws in screen pixels on a layer the camera doesn't move.
- Room instance overrides (scale, angle) apply before Create; creation code
  runs after it, compiled as `def _creation(self)` under `<instance r:i>`,
  so its line numbers are one more than the student's (codegen subtracts).
- Schema version 2 (`upgradeTo2` in project.ts) added layers, grid, camera
  and instance overrides. A new field needs the same: a version bump and an
  upgrade that leaves old projects looking exactly as they did.

## Tiles

- Tilesets are a resource (`TilesetResource`); tiles are numbered across
  then down. A tile layer keeps a sparse `"column,row" → tile` map in the
  project; codegen turns it into a dense grid for the engine
  (`TileLayerDef.cells`), dropping (not deleting) tiles past the room edge.
- In the engine, a query's target `t` is: ≥ 0 an object type, -1 anything
  solid (instances and tiles), ≤ -2 tile layer -2 - t. Answers use the same
  code (`tileCode`), and Python turns a tile code into the layer's name —
  so `move_and_collide` returns `["Ground"]` when the floor stops it.
- Hidden tile layers still collide (invisible walls). Live tiles are copied
  from the definition every time the room starts, so `tile_set` changes
  don't survive a restart.
- `move_and_collide` steps to the next whole pixel before stepping whole
  pixels: from 402.6 it used to stop at 415.6, hovering over a floor at 416.
- Painting goes through `editor/tiles/tileOps.ts` (pure, tested), autotiling
  too: a cell's piece is `set.tiles[mask]`, mask = up 1 + right 2 + down 4 +
  left 8 for neighbours in the same set; painting or erasing re-picks the
  cell and its four neighbours.
- A tileset's grid changing (picture, size, offset, spacing) goes through
  `remapTileset`, which keeps painted tiles, solid flags and autotile slots
  on the same picture tile.
- The game draws tiles in 16 × 16 chunks near the view (`placeTiles`); the
  room editor draws only on-screen cells.

## Undo

- One history per open project (`editor/history.ts`, held by
  `useProjectState`), not per tab. `mutate(recipe, { label, group,
  history })`: changes with the same label within 1 s, or with the same
  explicit `group` (a drag), are one step. **An unlabelled change is always
  a step of its own** — give a typed box a label, or every keystroke is a
  step; give different changes different labels, or they merge (adding an
  event and ticking Solid once merged, and undoing the tick deleted the event).
- **Code edits pass `history: "skip"`** (their editor has its own undo), and
  an undo restores a snapshot with *current* code (`keepCode`) — an event's
  `mode` and `blocks` count as code. A new place that edits code must skip
  history too, or undo gains invisible steps.
- `mutate` builds on `latest`, not a state updater: StrictMode runs updaters
  twice, which recorded every change twice.
- Decoded pictures are closed only after their replacements are showing
  (`useBitmaps`, `useTilesetImage`); closing them in an effect's cleanup let
  the canvas draw a closed picture, which throws, and crashed the editor.

## Code blocks

- `src/blocks/`. Events, scripts and creation code can be blocks
  (`mode: "blocks"`, kind event/script/creation). Each keeps Blockly's JSON
  in `blocks` and **writes its Python into `code` on every change**, so the
  game, error mapping, export and tutorial checks only ever read `code`.
  The switching rules live once, in `editor/codeMode.tsx`: no Python yet
  (comments don't count) switches freely, blocks → Python is one way
  (Convert), Python never becomes blocks.
- A blocks script is function definitions only (Blockly's procedures);
  `python.ts` drops the `global` lines Blockly adds. Its palette leaves out
  blocks that need `self`. Calls (`gm_call_*`) list every script's
  functions, read from their *code* (`scriptFunctions`), so typed and
  blocks scripts alike; a call's slots are saved in extraState and fitted
  to the function by `refreshCalls` after loading — never while loading,
  which made a call to a function that lost a parameter fail to load.
- Blocks are made from the catalog (`catalogBlocks.ts`: one per function,
  plus a statement version when `alsoStatement`), so a catalog entry needs
  no block work. Hand-made ones: properties, my/global variables, self,
  other, destroy, alarms, the event hat. Each block's look and Python sit
  together in one `define`.
- `blocks.test.ts` runs every palette block's Python through real Python
  (compiles, right number of arguments). Generated Python must read like a
  person's: 4 spaces, double quotes, `-= 4`, f-strings for joined text,
  default arguments left out, no `x = None` lines, unused imports dropped.
- Only blocks under the hat are code; loose ones are greyed and skipped.
- Name pickers keep an unknown name (Blockly's dropdown silently swaps it
  for the first option). Renaming walks blocks too (`renameInBlocks`), and
  an open workspace reloads when its blocks change from outside.
- Blockly (~220 KB gzipped) loads only when a Blocks tab opens; nothing
  outside `BlocksEditor.tsx` and `python.ts`/`catalogBlocks.ts`/`toolbox.ts`
  may import it (`blockState.ts` is the Blockly-free part). Its media are
  served from `/blockly-media/` (dev: vite.config.ts; prod: app.py).
- `blockly/core` has no words: `setLocale(En)` must run before a standard
  block is made, or it throws. A theme colour Blockly can't read (one with
  alpha) throws too, and the workspace never appears.

## Event sheets

- `src/eventsheets/`. A sheet is one method's body (`mode: "sheet"`, rows in
  `sheet`), for events and creation code — not scripts. Like blocks it
  writes its Python into `code`; `sheet.ts` (pure: tests and tutorial checks
  read it) compiles it with a line map of row/condition/action ids.
- Its subject is `self`. Other instances only through a "for each" row that
  names them — no GDevelop-style hidden picking.
- Boxes are typed Python, checked with Lezer (`checkExpr`, `checkLine`), not
  Pyodide, which isn't on the page. Trigger once is `self.once(key, cond)`
  in runtime.py.
- Conditions/actions come from the catalog by `returns` ("True or False" /
  "nothing" or `alsoStatement`), so new catalog functions appear by themselves.
- A sheet has its own undo (SheetEditor), each box its own typing undo; the
  global Ctrl+Z skips `.sheet-editor`. Edits change a structuredClone of the
  sheet, found again by id — never the row objects on screen.
- Rows move by HTML drag and drop from a grip only (a draggable row would
  fight text selection in its boxes); `moveRow`/`canDrop` in sheet.ts do the
  move, and the drag carries its own type so a dragged picture or text is
  never taken for a row.
- `codeMode.tsx` holds the rules for all three modes (`canUse`, `switchTo`,
  `confirmToPython`).

## Sounds, gamepads, save files, fonts

- **Sound plays on the page** (`editor/sound.ts`), never in the worker (no
  audio there). Python appends orders to `_sound_orders`; they leave with
  the frame's commands and reach `GameHost` as a "sounds" message. The host
  decodes every sound before the game starts and hands Python names and
  lengths only; `sound_playing` is computed in Python from those.
- **Gamepads** live in `G` (PAD_* in layout.ts, read by Python by those
  indices). `GameHost` polls `navigator.getGamepads()` every animation
  frame while running and sends a "pads" input when they change; InputState
  latches pressed/released like keys.
- **Save data** is localStorage `gameide-save:<id>` — the project id in the
  editor; a published game's own id later. Handed in as `def.save`, sent
  out whole as "save" when it changes.
- **Fonts** load in the worker (`gameWorker.loadFonts`) as
  `gameide-font-<index>`; text commands carry the font index and size.
- Uploads: `store/assetTypes.ts` and `gamestore.sniff_asset` must agree
  (bytes, not names; per-kind limits). `assetIds()` is the one list of a
  project's files — save, load and zip all use it.
- Every catalog category must be in `CATEGORIES` (docs), the blocks
  toolbox and `PICKER_ORDER` (sheets); catalog.test.ts checks.

## Exporting and publishing

- `play.html` + `src/player/` is the one player: exported games (their own
  folder: `game/index.json`, `game/project.json`, `game/assets/`) and
  published ones (`/play/<id>`, from `/api/play/<id>`). It builds the game
  from the project with codegen.ts, as the editor does.
- The build uses `base: "./"` so an export works in any folder; Flask's
  `/play/<id>` adds `<base href="/">`. Find our own files from
  `document.baseURI`, never `location` or an absolute path.
- `player-files.json` (written by the build) lists what an export copies.
- Publishing is `backend/publishing.py` (a blueprint) on `gamestore`'s
  Published tables. `_viewable` is the one rule for who may play; every
  route that hands out a published game or its files must call it.
- Published games are snapshots (JSON + copied assets): never read the live
  project for a player.
- Export → Steam (`store/steamKit.ts`) is a build kit: web/ (the HTML5
  files) + an Electron main.js serving them on app:// with COOP/COEP, a
  build.js for @electron/packager, pinned versions. Its real run is opt-in:
  `RUN_STEAM_KIT=1 [RUN_STEAM_BUILD=1] npx playwright test steam`.
- No service worker: the game's worker loads Python past it (checked in
  Chromium and Chrome), so it couldn't make games offline.

## Look

- The dark theme is microStudio's: hue 200 throughout, tokens at the top of
  app.css (`--panel-2` hsl(200,30%,30%) for bars and selection, `--go` green
  for actions), per-kind colours on `[data-tutorial="folder-…"]`, fonts
  from @fontsource (bundled, not Google: school filters). Match new UI to
  those tokens rather than adding colours.

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
Playwright test (`E2E`) or one of the server's checks (`PY`) instead of
Vitest. Its usual traps, all hit already: the
bug lands where the check can't see it (an error on an event's last line
hides an off-by-one), the test never produced the condition it names, a
test setting left changed by an earlier check (a lowered cap) hides the
next one's failure, or stale Python bytecode runs the previous sabotage's
code (the harness turns bytecode caching off for that reason), or a
mistyped case name ran nothing and still reported success (the harness now
refuses unknown names).

Server tests are plain scripts, as in PyIDE: `backend/tests/test_server.py`
prints ok/FAIL per check and exits non-zero. Browser tests use Playwright in
two projects: `editor` (the build alone) and `account` (served by Flask with
the dev sign-in and a throwaway SQLite database).

Waiting for a save in a test: wait for "Saving…" **then** "Saved". "Saved"
alone is already showing before an edit, and passes before the save starts.

## Backend — Flask, sharing PyIDE's database

`backend/app.py` is **Flask + SQLAlchemy + Authlib sharing PyIDE's
`accounts.py`, database and Google client** — not Django as the spec says —
so one sign-in and one XP total cover PyIDE, WebIDE, FlaskIDE and this. It
also serves the built editor (`frontend/dist`). Deployed by `render.yaml`
(the dashboard wins where they differ, as with PyIDE).

- **`backend/accounts.py` is a fourth byte-identical copy** of PyIDE's.
  Never edit it here first; change it in PyIDE and copy to all four.
- **GameIDE's tables are not in accounts.py.** They are in
  `backend/gamestore.py`, declared on `accounts.Base`, so `create_all`
  makes them only in this app and the other three never see them. Every
  name starts `gameide_`. New columns still need an `ALTER TABLE` path
  (create_all never adds columns) — put it in gamestore.py, not
  accounts.py's LATER_COLUMNS, unless the column is on a shared table.
- **Pictures are bytes in Postgres** (`gameide_assets`), as PyIDE's
  `images` are: Render's disk is wiped on deploy. The user wants everything
  on Render. Limits are in gamestore.py and every one answers in words.
- **Every JSON body is packed** as `{"_packed": base64}` (`store/api.ts` ↔
  `PackedRequest`), because Render's firewall refuses bodies that look like
  attacks and a project is code. Go through `api()` for every request.
- Sign-in, `TEACHER_EMAILS`, `ALLOWED_EMAIL_DOMAINS` and the two-hour idle
  sign-out for students are PyIDE's (signing in only adds abilities; GET
  /api/ is never activity). `/dev/login` exists only with
  `GAMEIDE_DEV_LOGIN=1` **and** no `DATABASE_URL`.
- **The isolation headers go on every response** (`_headers`); without them
  the endless-loop interrupt silently loses its line numbers.

## Saving, signed in

`store/cloudStore.ts`: every save goes to a per-user IndexedDB cache first
(marked dirty), then to the server; the mark clears only when the server
accepts it. Offline or signed out, work stays in the browser and is sent on
`online`, every 30 s, and on next open. Each save carries the server
version it was based on; a stale one makes the server keep the replaced
version in History before accepting (`save_project`).

- **The base version belongs to the tab, not the browser** (`bases`). Two
  tabs share one cache; using the cache's base let tab two overwrite tab
  one with nothing kept. Caught by a test, fixed, pinned.
- Sync-state changes go through `updateMeta` (one at a time per project),
  or a picture added mid-save can drop off the upload list. **No test
  covers that race** — it needs a fake IndexedDB the repo doesn't have.

## Style

Comments explain *why*, especially where the reason is a bug that already
happened. Say so in a comment when something fails silently — a stale view,
a misspelt event name, a draw call outside `on_draw` — because silent
failure is what students can't debug.
