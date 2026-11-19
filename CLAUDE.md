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
If Python doesn't answer the interrupt, the worker is busy outside Python (a
Chromebook uploading a big game's pictures to the GPU): it gets `KILL_MS`, 15 s,
before it's stopped — at 1.5 s, Stack Shack and Zoomtown Cup were killed on
Chromebooks with nothing looping. A game held for a Python check question is never
stopped (`watchdog`, pure and tested). **The renderer is WebGL only** (`preference:
["webgl"]`): Pixi fell back to WebGPU when its WebGL check failed on a Mac, and
GameIDE's drawing breaks there ("reading 'location'").
SharedArrayBuffer needs **COOP `same-origin` + COEP `credentialless`** on
every page. `vite.config.ts` sends them in dev and preview; **the Flask
server must send them too**, or the interrupt silently degrades to killing
the worker with no line number. `?nointerrupt` forces that fallback, for
testing.

**Safari runs the worker's script twice if anything imports it.** Pixi's
worker extensions are imported at the top of gameWorker.ts for that reason:
left to Pixi, the bundler made Pixi's import of them a chunk importing the
worker's own file, and every published game was a black screen on an
iPhone, Chrome being fine. `e2e/build.editor.spec.ts` fails on a chunk that
imports the worker; `published.spec.ts` plays a game in WebKit (`npx
playwright install webkit` once — it skips without it, saying so). An
engine failure in the player is shown, never a silent black screen.

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

## Drawing sprites

- The sprite editor's paint tools (`editor/sprites/SpriteEditor.tsx`) draw on
  `pix`, the frame's RGBA bytes; `paintOps.ts` is the pure part (pencil,
  line, fill, colours; tested without a canvas). The canvas shows `pix`; there
  is no `<img>` of the frame any more (tests read `sprite-pixels`).
- **A stroke is saved as it ends**: a new asset for that frame (assets never
  change, put_asset), the mask refitted, one undo step each (`group:
  paint:<id>`). Saves are chained, so a quick second stroke can't land first.
- `shownId` is the picture `pix` holds. A frame whose id differs (Undo,
  another frame) is loaded afresh; the one just saved isn't, or a stroke drawn
  while it saved would vanish. A paint tool does nothing until the shown frame
  has loaded, or it would paint the last frame's pixels over this one.
- An OffscreenCanvas that never had a context throws on `convertToBlob`
  (`blankPicture` takes one first).
- **Frame-list changes go through `changeFrames(edit)`**, which puts down a
  lifted piece, waits for saves, and edits `framesRef` (the newest list, with
  `recent` for pictures not yet in `assets`). A button working from the
  render's `sprite.frames` lost a stroke still saving.
- A selection being moved is `float` (lifted off `pix`, drawn over it by
  `show`), put down by `anchor` — on Enter, another tool, another frame, a
  frame button, or closing the tab.
- Copy/paste is a page-wide variable, never the system clipboard: a picture
  there, pasted, makes a new sprite. A picture pasted while a paint tool is
  chosen is taken by the sprite editor's capturing listener first;
  EditorPage's skips a paste already `defaultPrevented`.
- Tests read the canvas only once `data-loaded="1"`: just after choosing a
  frame it still shows the last one's pixels.

## The Gemini art library

- `scripts/make_gemini_library.py` makes `public/library/gemini/<game>/` and
  `src/library/geminiPacks.ts` (generated: run the script, don't edit) from
  `showcase/<game>/art/`. Rerun it when a game's art changes.
- **Every Gemini pack credits Gemini** (the teacher's ask): `credit` on the
  pack, shown on its card and page, and its License.txt. library.test.ts and
  a sabotage case hold it.

## Find the pictures

- Import's fourth way to cut (`store/findPictures.ts`, pure; the importer
  draws). Background from the corners, `keyOut` with a soft band and the
  colour taken back out of edges (no rim), islands touching corners, joined
  while closer than `join`, specks and leftovers dropped, `readingOrder` by
  each row's middle line. Frames are the biggest drawing's size, placed by
  `placeIn` (bottom or middle).
- `defaultJoin` was tuned on the showcase games' raw Gemini sheets: 1% of
  the picture joined two poses; a 300th found every drawing. Try any change
  on those sheets (`showcase/*/raw/`).

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
- **Camera orders in a new room's Create wait** (`_camera_order`) and go with the frame's commands, applied after `setRoom`: sent straight to the engine, they were wiped a moment later with no error. A new camera function must go through it.
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
- `codeMode.tsx` holds the rules for all the modes (`canUse`, `switchTo`,
  `confirmToPython`).

## Sounds, gamepads, save files, fonts

- **Sound plays on the page** (`editor/sound.ts`), never in the worker (no
  audio there). Python appends orders to `_sound_orders`; they leave with
  the frame's commands and reach `GameHost` as a "sounds" message. The host
  decodes every sound before the game starts and hands Python names and
  lengths only; `sound_playing` is computed in Python from those.
- **The mouse wheel** (2026-11-18, for Highmoor's zoom): the page adds up the canvas's wheel
  scrolling into notches (`WHEEL_STEP` pixels each, so a trackpad's stream counts too; the page
  doesn't scroll under the game), sends them as a "wheel" input, and the step hands Python the
  notches since the last one in `G.WHEEL`: `mouse_wheel()`, up positive, cleared each step.
- **Gamepads** live in `G` (PAD_* in layout.ts, read by Python by those
  indices). `GameHost` polls `navigator.getGamepads()` every animation
  frame while running and sends a "pads" input when they change; InputState
  latches pressed/released like keys.
- **Save data** is localStorage `gameide-save:<id>` — the project id in the
  editor, `play:<slug>` for a published game. Handed in as `def.save`, sent
  out whole as "save" when it changes, stamped with when (`gameide-save-at:`).
- **A published game's save is kept in the player's account too** when they're
  signed in (2026-11-16, the teacher's ask: play at home, and keep progress
  through updates): `gamestore.GameSave`, `publishing.get_save/put_save`,
  `player/cloudSave.ts`. Before a game starts, `settle` plays the newer of the
  browser's copy and the account's; `CloudSaver` sends new saves up at most every
  4 s and as the page hides. Saving isn't activity (`_counts_as_activity`).
  Unpublishing deletes them. Publishing again keeps the slug, so an update keeps
  every save: **update a showcase game with My Games' Update (a .zip over the same
  game, the old one kept in History), never by importing it as a new game**.
  A showcase build names each file by a fingerprint of its bytes (`Project.asset` in
  showcase/build.py, 2026-11-18), so an unchanged picture keeps its id and an Update sends only
  what's new. The ids used to come from a seeded sequence that any picture added early in a
  build shifted: an id could come back meaning a different picture, which the server refuses.
  A version already published by itself can be put in place of the old one:
  Publish → "A new version of …" (`replace`, `publishing._merge`): it takes the
  old link, and each player keeps their best score and newer save.
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
- **Inspired by microStudio, never a copy of it** (the user's words: "I love
  that engine, I don't want to make it look exactly like it"). My Games is
  GameIDE's own cartridge shelf — picture on the label, actions along the
  bottom, New game as the first slot — and a game with no "icon" sprite
  gets a pixel badge made from its id (`store/gameBadge.ts`), not one
  shared gamepad. The home page's hero is a little level: pixel grid,
  ground tiles, a row of badges. Check new pages against that rule.

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

On a heavily loaded machine (load average over about 8) older browser tests with
fixed waits fail at random: run `npx playwright test --workers=2`, and a failure
that moves between tests between runs is load, not a bug.

**Every check must have been watched to fail.** `scripts/sabotage.py`
holds one deliberate bug per guarded behaviour, applies each, confirms the
named test fails, and restores. Add a case whenever you add a check; a case
that prints MISS is a test that lets the bug through. A sabotage must still
compile (strict TypeScript refuses unused names), and a case can run a
Playwright test (`E2E`), one of the server's checks (`PY`), or Greymire's
playtest after rebuilding that game from the broken source (`GM`) instead of
Vitest. Its usual traps, all hit already: the
bug lands where the check can't see it (an error on an event's last line
hides an off-by-one), the test never produced the condition it names, a
test setting left changed by an earlier check (a lowered cap) hides the
next one's failure, or stale Python bytecode runs the previous sabotage's
code (the harness turns bytecode caching off for that reason), or a
mistyped case name ran nothing and still reported success (the harness now
refuses unknown names).

**The showcase games' runners** (`GM`, `MM`, `FB`, `GF`, `BB`, `HC`, `KT`, `TD`, `SM`, `RP`, `CLIMB`, `UND`, `SIEGE`, `SAND`, `FLAGS`, `LEMON`, `COOK`, `SANDW`, `MIX`, `FARM`, `KING` — not `CL`, which is classes.py) rebuild
that game from the sabotaged source before its playtest and again after. A
build that **refuses** (Greenside's course checks, Ridgeline Rally's stage
checks) leaves the old `out/project.json`, and the test passes on it: a
sabotage of something the build checks must break the game without breaking
the build. Three of the games' playtests play through the keys with a bot
written in Python inside the test: football (a whole game and a whole
season, reloaded from its `save_set`), Moonshot (a Derby and a game) and
Ridgeline Rally (a whole stage). Each game draws from the same numbers it
plays by — football's teams are `LEAGUE` (other teams are the Comets
repainted, `repaint` in its build), Moonshot's ballpark is painted from its
rules' camera and fence, Ridgeline Rally's cars from `VEHICLES` — so change
those numbers in the rules file only.

Server tests are plain scripts, as in PyIDE: `backend/tests/test_server.py`
prints ok/FAIL per check and exits non-zero. Browser tests use Playwright in
two projects: `editor` (the build alone) and `account` (served by Flask with
the dev sign-in and a throwaway SQLite database). Both run in Chromium; one test
in `account` launches WebKit itself, for iPhones.

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
- **The tests' SQLite enforces foreign keys** (`PRAGMA foreign_keys=ON` in
  app.py), as Render's Postgres does. Without it, deleting an assignment
  passed every test and was a 500 on the site. A delete must clear every
  row that points at what it deletes, explicitly, by query — SQLAlchemy
  can't order deletes between tables it has no relationship() for.
- **The isolation headers go on every response** (`_headers`); without them
  the endless-loop interrupt silently loses its line numbers.
- **Cached files must not `Vary: Cookie`** (`CachedFilesSession`, 2026-11-17). Flask adds
  it to everything that reads the session, i.e. every request, and a student's cookie
  changes as they play, so the browser downloaded a game's pictures again on every
  return: the school went over its Render bandwidth. Responses marked `public` or
  `immutable` lose it; give a new cacheable route one of those or it won't be reused.
- **A class opening a game at once** (2026-11-18: the site went down with 502s while classes
  played and a teacher uploaded a game): a published game's files are kept in memory once and
  shared by every player (`publishing.SHARED_FILES`, 64 MB, least recently used out first,
  keyed by the publication and when it was published), after the usual who-may-play check;
  `Published.data` and `thumbnail` are deferred (every file request looks the row up); the
  game is sent as it's stored, not decoded and encoded again per player. The editor uploads
  2 files at a time (`UPLOADS_AT_ONCE`) and its background retries back off after a failure
  (`retryWait`, 30 s doubling to 5 min). `backend/tools/class_load.py` times a class.

## Classes

`backend/classes.py` (a blueprint) and `editor/ClassPages.tsx`,
`editor/AssignmentBits.tsx`. **PyIDE's classes, on PyIDE's shared tables**
(`Course`, `Enrollment`, `ClassItem`, `Assignment`, `Submission`,
`ClassroomLink`, `ClassroomPost`), every row `app = "gameide"` — no join
codes. What those tables can't hold is in gamestore.py: `AssignmentGame`
(the starter, a project the teacher owns, kept off their My Games; the due
date), `AssignmentWork` (each student's copy, found again by assignment and
student), `Comment`.

- **Each editor sees only its own classes** (`Course.app`). Never list,
  open or post to another editor's class.
- **Reading is wider than writing.** `classes.can_read`: a project's owner,
  or the teacher of the assignment it is work for — not any teacher of the
  student. Every write still goes through `_own_project`. The teacher's
  view is the real editor on a `ViewStore` (`store/viewStore.ts`), which
  never saves; useProject neither autosaves it nor reads a close-time
  backup for it, or a teacher's try-out could be shown in place of the
  student's game.
- **A turn-in is a frozen `GameVersion`** (kind "turned-in"; "graded" when a
  score froze work never turned in), and `Submission.snippet_slug` is
  `"v<id>"` — the shared column PyIDE points at a share snapshot. Only "auto"
  versions are pruned, and assets are never deleted, so a turned-in version
  always opens with its pictures.
- **The week's calendar** (`editor/ClassCalendar.tsx`, `calendarWeek.ts`;
  `save_calendar` in classes.py) is PyIDE's: the same shared
  `classes.calendar` column, the block of text the teacher pasted
  (`Monday:` … `Tuesday:` …), stored as typed. `calendarWeek.ts` is a port
  of PyIDE's `static/calendar.js` and must read a week exactly as it does —
  `calendarWeek.test.ts` compares the two whenever `~/pyide` is checked out.
  A day's name with no colon after it ("Friday quiz") is a to-do, not a day;
  a dated day is Today only on its date. *Also post to* reaches only the
  teacher's own classes here, and one that isn't refuses the whole save.
- **Turned-in work is never lost**: an assignment anything was turned in to
  can only be archived; deleting a class archives its assignments; students'
  games are theirs.
- Google Classroom is PyIDE's code, with the three doors to Google
  (`_google_post/_get/_api`) replaced in the tests. The connection is per
  app; GameIDE's `/classroom/callback` must be on the OAuth client's list.

## Notes, questions and tests

`backend/notes.py` (routes), `grades.py` (what a grade is), `quiz.py` (PyIDE's,
copied unchanged), `checks.py`; `src/notes/`, `src/checks/`. An assignment's
notes are `notes.md` in `Assignment.files`, shown in the editor's Notes tab.

- **The key is taken out at every exit.** The one exit to a student is
  `classes.project_assignment` (`notes.student_notes`). A new route that
  hands notes to a student must redact too and needs a leak check in
  test_server.py — a missed exit leaks the answers with no visible sign.
- **Two readers, one format**: `quiz.ts`/`quiz.py` and `checks.ts`/`checks.py`
  must read a block the same; `src/notes/parse-cases.json` is checked by
  both. Change one, change both, and add a case.
- **Checks run in a browser, never on the server.** Project checks read the
  project; game checks play it through a `GameRunner` (`checks/hostRunner.ts`):
  the editor's own game pane for Check my work, a hidden GameHost for the
  teacher's Check all. `GameHost.press` holds keys for them.
- **Only the teacher's Check all counts** (kind "verified"); a student's own
  check (kind "self") is feedback and pays SELF_TEST_XP once per real test.
  Points are summed from the notes' own lines, never what a page sends.
- **Every grade goes through `grades.total`**: score + questions + checked
  tests — results, the student's class page, quests and Classroom's Sync.
- Code in notes is `user-select: none` (the teacher's decision: no copying
  tutorial code). Don't add a Copy button.

## Game feel

`engine/effects.ts` (state: particles, weather, lighting, screen effect,
hit-pause), `engine/render/feel.ts` (drawing them; the shaders), and the
"game feel" section of runtime.py (checks the student's request in words,
sends orders as `fx`/`lights` with the step's commands; tweens, dialogue
and fades are plain Python drawn with ordinary draw commands).

- **Per-particle work stays in the engine**, never Python.
- **In `endStep` the room changes before effect orders apply**: the new
  room's Create events' orders come in the same step. Reversed, they were
  wiped (a sabotage case holds it).
- **Our shaders are high precision** (`program()` in feel.ts): a uniform at
  two precisions fails to link and the effect silently isn't drawn.
- New per-instance fields go AFTER the alarms in layout.ts (TINT..OUTLINE_COLOR),
  so nothing before them moves.
- Names Python checks against (effects, weather, screen effects, blend
  modes) come from the engine through `layoutForPython`, never retyped.
- **`draw_floor` and `floor_point` are one projection written twice**:
  `FLOOR_FRAGMENT` (GLSL, feel.ts) goes screen → floor, `floor_point`
  (runtime.py) goes floor → screen. "the floor is drawn where floor_point says"
  pins them together by reading pixels back; change one and change both. The
  floor mesh sits at the camera without its shake (`worldDraw.view`), so it
  shakes with the room rather than staying put under what stands on it.

## Cutscenes

`scene_*` in runtime.py (the "cutscenes" section), `python/scene.test.ts`; each call lines up a step, run in `_step_scene` first thing in `_frame`, statements rather than a list so blocks and sheets get them free.

- The game holds still with the ordinary pause. A paused engine moves and animates nothing, so the runner moves and animates what it moves itself.
- **A skip must leave the game where a watched scene would**: every step's end state is applied, in order. A new step needs its case in `scene_skip` too.
- Steps with an end state and no time go in `_SCENE_INSTANT`; a fade, tint or animation is a change (`_scene_change_start`: `tick` each step, `end` when done or skipped). `scene_create` makes its instance at once, hidden until its turn, because later lines need to name it; an `on_draw` of its own still draws while hidden, since `visible` doesn't stop `on_draw`.
- Overlays are sized by `_screen_size()`, never `view_width`: the GUI layer doesn't zoom, and a fade once covered only the window's corner.
- **Scene mode** (`mode: "scene"`, `src/scenes/`) is a fourth way to write an object event, by cards; like a sheet it writes its Python into `code`, one line a step, and `scene.ts` is pure. Every value is kept as the Python that goes in the call, whatever box shows it. A new `scene_` function needs a place in `SCENE_GROUPS` (scene.test.ts fails until it has one) and its box comes from `boxOf`. Not for per-step events (`REPEATING_EVENTS`): each run would line the scene up again. A step with a problem writes `pass` and goes red, so one unfinished card doesn't stop the game starting.
- A room change ends a scene (`_goto`). `scene_camera` parks what the camera follows on the engine, and it's restored as the scene ends.

## Tutorials

`src/tutorials/` and `backend/tutorials.py`; built-in ones are
`frontend/public/tutorials/*.md` + `index.json` (served by Flask's
`/tutorials/` route and by any static host). A tutorial is notes with a
header; steps are `---` slides; ` ```check ` blocks gate Next (strict); a
`highlight:` line spotlights a `data-tutorial` target.

- **Progress is in the game** (`Project.tutorial`), not a table: it saves
  offline/signed out, and My Games / the library / the results read it.
- **Keys**: `builtin:<name>`, `t:<slug>` (a teacher's), `a:<slug>` (an
  assignment made from one — its notes are the tutorial, and its checks
  count in `grades.tests_of`).
- **Keep `TARGETS` (tutorial.ts) true**: tutorials.test.ts fails on a target
  no longer in the editor, and on any built-in tutorial with an unreadable
  check, a spotlight on nothing, or a missing starter. Removing or renaming a
  `data-tutorial` attribute breaks spotlights silently otherwise.
- Starting games for tutorials are `TUTORIAL_STARTERS` in templates.ts
  (kept off Create New Game: they're half a game on purpose).
- **Art and Tiles** lessons hand students real files: `public/tutorials/art/`
  (made by `scripts/make_tutorial_art.py` from Kenney's CC0 packs). A link
  to one there downloads it (NotesPane adds `download`). A lesson that opens
  a dialog (the importer) must give every instruction for it on one step:
  the dialog covers the tutorial pane.
- **"Now you can make…" tutorials** (`make-*.md`) build a whole game from
  `starter: empty`, with `level: Now You Can Make` and `after:` the lesson
  whose skills it needs (its key, e.g. `el3-strike`) or a shelf's name. The
  Learn page puts a band right after that lesson, splitting its shelf there,
  never a shelf of its own: spaced through the lessons, the teacher's ask
  (at shelves' ends they all bunched up after the last one).
  They are original games in a genre, never a copy of a named game (the
  teacher asked for "frogger, pong, zelda": they're Busy Road and the like).
  Each is walked step by step in `makes.test.ts`, its code taken from its
  own markdown: add a new one there, or its checks are never run.
- **No Copy button on tutorial code**, ever (the teacher's decision).
  tutorials.test.ts fails on "copy" anywhere in a built-in; the sprite
  editor's buttons in bold (**Copy**, **Copy frame**) are the one exception.
- **Draw Your Own** (`draw-*.md`, starters `draw-1`/`draw-2` whose code is
  `DRAW_MOVE`/`DRAW_ANIMATE` in templates.ts, the lessons' own words) is
  walked by `e2e/draw.editor.spec.ts`. Its picture checks ("has a drawing on
  every frame", "frames are all different") need the game's pictures:
  `runTests(…, pictures)`, from `ProjectContext` in the panes.
- **A check states only what its own step asks students to type** (the
  teacher's rule, and a must). Students read the check block and type what
  it mentions: a check naming code the step never asked for had them typing
  unnecessary code. So no `uses` word, event or name that isn't in the
  step's own instructions or code; no Python-expression checks (`after 2
  seconds, instance_number(...)`) built from helpers the step doesn't use —
  say it in the check language instead; and **no step re-checks earlier
  steps**, the last one included: no end-of-tutorial check of everything.
  `game runs N seconds without errors` is always welcome.
- **Built-in tutorials ask questions** (```quiz, self-marking, practice
  unless assigned): about one every 3–4 steps, never on the intro step.
  test_server.py fails on a built-in without them or with a question that
  has no key. Code inside a question is fenced `py` (the quiz itself fenced
  with four backticks), never `python`: the lesson tests read every
  `python` block as code the student types.
- **The Learn page (#/tutorials) is public**: built-ins (less those an admin
  hid, `HiddenBuiltin`) and tutorials set to Everyone (`site`, admins only).
  It only follows tutorials: no Assign to, copy or download. A teacher's own
  are "Only me", in their library. **A class gets a tutorial from New
  assignment's "A tutorial"** (the teacher's ask, 2026-11-16: the old way, Try
  it, New assignment from that game, then Link to…, still works): any built-in
  or their own, **as it is, only its points changed**. The page sets them
  (`notes/points.ts`: "Worth" shares out evenly, or each one by hand), makes
  the starting game just long enough for the server to copy it, and sends the
  text; `classes.tutorial_row` refuses one that differs in more than points
  (`without_points`) and links a row with exactly that text, or a new one named
  "<title> (N points)". points.test.ts holds every built-in to coming back word
  for word, and to being worth exactly what was asked by checks.py and quiz.py. **The
  library lists every built-in as it ships**; editing or linking one makes
  the teacher's version, a row of its own named "<title> (copy)" beside it
  (`origin` builtin:<name>; old ones renamed once by `tutorials.migrate`). An assigned
  game claims step XP under `a:<slug>`, never the teacher's private
  `t:<slug>` its starter was made from.

## The Python check

`backend/pycheck.py`, `src/player/PythonCheck.tsx`, `src/pycheck/` (the teacher's
page, #/python-check). A **showcase** game (`Published.showcase`, a tick when a
teacher publishes) is play only and stops for a question; the teacher asked for
it so that school staff would allow playing at all. Tutorials and students' own
games are untouched.

- **Guests play too** (the teacher's choice, 2026-11-07): not signed in, a
  player's place in the check (`pycheck.GuestState`: due time, strikes, lockout,
  the question waiting) is kept in their session cookie, signed so it can't be
  altered, only cleared (which starts their clock afresh). Their questions are the
  publishing teacher's bank; no XP, no report rows. Every route goes through
  `_state`/`_keep`, which pick the row or the cookie.
- **Publish refuses a game whose files aren't all on the server** (409, saying how
  many): it used to copy what had arrived and silently leave out the rest.

- **The server runs no uploaded code, ever.** A ```python predict block is run by
  the teacher's own browser (`pycheck/bank.ts`, a worker that can be stopped) and
  arrives as a ```quiz predict block; `read_bank` refuses one still unconverted.
  A server-side subprocess was tried and rightly blocked. Don't bring it back.
- **The server decides everything that matters**: when one's due (`CheckState`,
  per person across all games, so reloading or changing game doesn't reset it),
  whether it's right, whether they may play. The key never leaves (`quiz.redact`).
  A student with browser tools could still unfreeze their own page; the report
  shows who played without answering. Say so if asked whether it's cheat-proof.
- **Question sets** (the teacher's ask, 2026-11-17: a set for each class): every
  save of a set is a new `CheckBank` row with its `set_key`; the newest row is the
  set. `CheckSettings.active_set` is the one students get (`active_bank`; never
  chosen: the one saved last). A save with no set goes into the set in use, as a
  save always did; a new set only with `newSet`. The page's dropdown shows any set
  to edit; "Give my students this set" switches. A removed set's rows stay
  (`removed`), as answers point at them; the set in use can't be removed.
- A bank is what the teacher wrote (`source`, what the edit box shows, so predict
  answers are worked out afresh) and what it became (`markdown`, `questions`).
  Any problem refuses the whole file. `explain:` is taken out here, not in
  `quiz.py`, which is PyIDE's and copied unchanged.
- Timing and penalty are per teacher (`CheckSettings`); a student follows their
  bank's teacher. Teachers play as practice: nothing recorded, no lockout, no XP.
- XP is `check:<qid>`, once per question ever. Partly right isn't right here.
- The game is held by `GameHost.holdForQuestion`: sound plays on the page, so
  freezing the worker alone left the music playing.
- **Only playing counts toward the next question** (the teacher's choice,
  2026-11-08): the clock is `play_left`, seconds of play, not a time of day. The
  page counts a second while `GameHost.playing()` (running, on show, not held, a
  key/click/touch/pad in the last `IDLE_MS`, 30 s; pressing Play and answering
  count) and sends them every few seconds to `/check/tick`, which never credits
  more than has really passed. Sitting on a menu or walking away brings no question.
- **A question waits for a fair moment** (the teacher's ask: never mid-jump). A
  game says when with `question_ok(…)` each step (out as `question_ok` with the
  frame's commands, only on a change); PythonCheck fetches the question, then
  `GameHost.whenQuestionOk(fairWait)`, then holds. The server says how long at
  most (`pycheck.FAIR_WAIT`, 2 minutes: a race should finish; the tests set 15 s),
  so no game can put questions off; a game that never calls it is always ready.
  `question_waiting()` lets a game say one's coming. Which questions, and when
  they're due, are the server's as before.

## High scores

`high_score(n)` in a game; `player/Scoreboard.tsx`; the `HighScore` table and the routes in publishing.py. A published game whose code calls it shows the school's top twenty beside the stage (left 1-10, right your best and 11-20); full screen is the stage alone, so they go with the page. A game that never calls it has no boards.

- **Same email domain. Students by first name; teachers and admins by last name** (the teacher's wish), on their school's board too. A personal address (`PERSONAL_DOMAINS`, gmail.com and the like) has no school: everyone on Gmail would otherwise be each other's classmates. A new route handing out scores needs a leak check in test_server.py.
- The score comes from the student's browser, like XP's run claim, so it can be faked with browser tools. It touches no grade.
- **How a game's scores rank is `settings.scoreboard`** (`lowest`, `unit`; set in Game settings or by a showcase build), and the server reads it from the published game, never from the page, or one student could turn a board upside down. Unit `time` is seconds, kept as hundredths.
- Every showcase game reports (`src/showcase/scores.test.ts`). Thornwood and Greymire can't be built without their art, so `showcase/patch_zip.py` puts new code into a zip that already has the pictures, writing `-patched` files beside it. **Their runners can't test a sabotage here; a build that lacks art also overwrites `out/` with stand-ins for the games that allow that (mystery, football, baseball). Check `~/Downloads` before rebuilding those.**
- It goes Python → `_commands` "score" → worker → `GameHost.events.score` → at most one POST per 2 s, because a game may call it every step.

## Multiplayer rooms

`backend/multiplayer.py`, `player/net.ts` + `NetLobby.tsx`, the `net_` section of runtime.py. A published game whose code uses `net_` gets a lobby instead of Play: make a room (a 4-letter code) or join one by its code; or play alone. **Rooms aren't tied to classes** (the teacher's decision, 2026-11-08: GameIDE is their formative assessment across all their classes): anyone signed in, any email, makes and joins any room of that game. Signing in is still needed, for the names.

- **Live rooms: one process, WebSockets** (2026-11-08). With `GAMEIDE_ONE_PROCESS=1` (the Start Command: `--workers 1 --threads 64`), rooms live in memory (`multiplayer.Live`) and a page holds a WebSocket (`/api/net/ws`, flask-sock): its updates go at most every 50 ms and it's sent the others whenever the room changes, at most every `LIVE_TICK`; each player's entry is encoded once per change, not per page. The database keeps codes, numbers and tokens, and gets each player's state and "last seen" every `WRITE_EVERY` (joins, the cap and reloads read those), and after a restart a page is let back in from it. Measured locally: 20 players at 20 updates a second, about 30 ms from one to the others and 3–5% of a core (`backend/tools/rooms_load.py`).
- **Polling is the fallback** (a network that blocks WebSockets, `?nows`, or several processes, where the socket says `fallback`): `/api/net/sync` every `SYNC_MS`, one request at a time, served from memory when live, from Postgres (`gameide_net_*`) otherwise. Both ways meet in the same live room. A sync, like a socket, is token **and** session: a copied token does nothing.
- **Into the game: one call a frame still.** The worker keeps what arrived (`PythonGame.netArrive`) and hands it to the next `_frame(net)`; messages last one step. Out: `net_send`/`net_shout`/`net_away` go with the frame's commands as `net`, and `GameHost.events.net` passes them to the session.
- **Away hides you and deafens you** (the teacher's rule: nothing affects a player answering a question): `holdForQuestion` → `events.held` → `NetSession.hold`; a hidden tab; `net_away()`. The server leaves away players out and moves their `after` past what they missed, and the page drops messages while held.
- Names are `_board_name` (students by first name), never an email. A new route handing out players needs a leak check.
- Syncing isn't activity (`_counts_as_activity`), or playing would pay XP's working time.
- Outside a room (the editor, exports) every `net_` function quietly does nothing.
- **Smoothing is the engine's**: each `net_players()` player has `draw_x`/`draw_y` (`_net_smooth_step`, once a step in `_frame`): carried on at the `vx`/`vy`/`ay` they send for up to `NET_PREDICT_STEPS`, gliding onto each new word. Games draw others there (Snowcap's Ghost does), so every multiplayer game is fluid without its own code.
- **`net_tell(number, msg)` is private**: the server keeps who it's for (`to` in a live message, `to_number` in `gameide_net_messages`) and hands it to that player only (`_for`), so a secret role can't be read from anyone else's traffic. `net_host()` is the game in charge (`_host`: the lowest number here and not away), sent with every frame, so every game agrees who deals and counts.
- **A room holds 20, unless the game asks** (`settings.netPlayers`, read by `multiplayer.room_size` from the published snapshot, never the page; 2 to `BIGGEST_ROOM`, 25). Only Undertow asks (25, the teacher's choice 2026-11-09): every other game stays at 20.
- **"Find me a match"** (`multiplayer.match`, the lobby's `net-match`, shown when a game's rooms hold two): into the oldest room still marked `matching` with exactly one player present, else a new marked room. A room loses the mark when full; matching pairs even in games whose rooms hold more.
- **Undertow is the pattern for a game with secrets** (`showcase/undertow/game/_3room.py`, `_4play.py`, Director): the host's game is the referee. Public state goes out as `g` in the host's `net_send`; roles go by `net_tell`; every action (freeze, report, vote, jobs done) is a private word to the host, which checks it against where players really are, because a changed game in a browser can send anything. A new host carries on from its copy of `g` (the newest `v`) and learns roles from the players. `undertow.test.ts`'s `Room` steps several real games side by side as the server would: test a room game there, not one game at a time.
- **A dropped WebSocket comes back by itself** (`NetSession`): the page polls at once, then tries a new socket after 5 s, doubling to 30 s (60 s if the server said it can't). A Render restart doesn't leave a room choppy until a reload.

## XP

A student's Classes page has their classes in a column on the left of the XP card (`.class-home`), first on a phone: under it, the one button they came for was at the bottom.

`backend/rewards.py` (a blueprint), `src/xp/`. **PyIDE's XP joined, not
copied**: one total per person across all four editors.

- **`backend/xp.py` is the fourth byte-identical copy** of PyIDE's, like
  accounts.py. Change it in PyIDE first and copy it to WebIDE, FlaskIDE and
  here. The rows are shared tables (`xp_awards`, `shop_items`,
  `shop_requests`, `student_photos`, `class_events`); every award GameIDE
  makes has `app = "gameide"`.
- **The unique `(user_id, source)` is what stops paying twice.** `xp.award`
  commits on its own; call it after what it pays for is committed. Sources
  here: `run:<minute>`, `bonus:<assignment>`, `grant:<random>`,
  `event:<event>:<user>` (Undo deletes exactly those — the only deletion).
- **The server can't see a game run.** EditorPage claims one 5 s after Play
  with no error (`RUN_COUNTS_MS`; an error, Stop or Play cancels it),
  sending a hash of the code (`xp/runXp.ts`, never the code). The server
  pays only after `RUN_EVERY_SECONDS` of working time (`session["busy"]`,
  counted in `_sign_out_idle_student`, never for a GET to /api/) and for
  changed code, so a faked claim earns what a real one would.
- Only students earn. Nothing here touches a grade; tokens are spent only
  by one conditional UPDATE (approve, Use a token).
- Avatars are PyIDE's pictures in `public/avatars/` (a server check fails
  on a picture without its id or an id without its picture) or an approved
  photo; `xp/avatar.tsx` is GameIDE's version of PyIDE's avatar.js.
  Leaderboards show `xp.board_name` only, never an email.

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

## Showcase games: names the engine already uses

An instance variable named like one of the engine's own properties is the
engine's (the list is `_props` in runtime.py: speed, direction, gravity, friction,
glow, spin, outline, bounce, weight…). `self.speed` on a troop made the engine
walk it every step, even while it stood fighting, right past the tower; `glow`
on a fish wanted a colour. Call a game's own numbers something else (`pace`, `lit`).

## Tabletop Siege

`showcase/siege/`: a 1v1 lane battle (the teacher's pick, an original game in the
genre), now a **snowball fort war** across a frozen creek (2026-11-10: the teacher
replaced the first setting, a kid's desk; its pictures are in `raw/desk/`, the
snow ones in `raw/snow/`). Objects and cards are named for the snow setting
(SnowKid, Snowman, Owl, Penguin, Yeti, SnowWall, Snowball, IcePatch; rooms
Title and Field). Every number is in `game/_1rules.py`; the troops are objects (Unit
and its kinds; Building, Tower, Keep, Wall), `_2battle.py` is what they share. The
computer (`Cpu`) plays side 1 alone. In a room (`netPlayers` 2), the host's game
runs the battle and sends `snapshot()` each step; the other game runs no battle
and shows **puppets** of the same objects (`self.puppet`: every step that
simulates returns at once), mirrored so each player is blue on the left
(`_3duel.py`, `Link`). The other player's cards go to the host privately and go
through `play_card`, like the host's own. An opponent away (a question) holds the
match (`halt`, `stopped()`); gone `GONE_STEPS`, the one still here wins. Pictures
are the teacher's (`cut_sheets.py` → `art/`); `draw_troop` chooses a frame from
where a troop is (moving or not, `swing` after a blow), so puppets animate too.
Its board is wins against players only (`Hud`). **Coins, levels and the shop** are `_4cards.py` (2026-11-10): all kept in
the save. A card's level reaches what it makes through `upgrade(o, level)` in `Deploy`, so
a new card's objects need no level code of their own, only `self.power` for a spell's
effect. In a room the levels go with the deck (Title's `net_send`) and the host reads them
through `real_levels`, never trusting a number it didn't check.

## Pour Decisions

`showcase/sand/`: a sand-sorting puzzle (the teacher's ask, 2026-11-10), every
picture drawn by its build. Levels are `game/_1levels.py`, one letter a layer,
written by `make_levels.py`; **`solve.py` re-solves every level as it builds** and
refuses one that can't be finished or whose `par` isn't the fewest pours, and
refuses if the game's pouring rule (`_2sand.py`) and the checker's disagree.
A refused build leaves the old `out/`, so `sand.test.ts`'s "is today's source"
fails when it happens (that's how a sabotage of those is caught). A pour moves the
sand at once (`pour_from`); the `Pour` object only shows it moving (`drain`,
`pending`, `shown_layers`), so undo and the win never wait on an animation.

## Style

Comments explain *why*, especially where the reason is a bug that already
happened. Say so in a comment when something fails silently — a stale view,
a misspelt event name, a draw call outside `on_draw` — because silent
failure is what students can't debug.

## The tutorial library (2026-10-29)

`backend/library.py` is **the same file as PyIDE's, WebIDE's and FlaskIDE's**
(like `accounts.py`): a teacher's tutorials, kept once (`library_items`) and
linked to any number of assignments (`Assignment.tutorial_id`), written
through into each linked assignment's `notes.md` on every save. **It is the
only place a tutorial's text is edited** (the teacher's call): the assignment
page shows a read-only Tutorial box (`TutorialBox`, TeacherNotes.tsx), the
old `#/tutorials/edit` page and `/api/assignments/<slug>/notes` are gone, and
`/api/tutorials` only reads. Its page is React's (`#/library`, LibraryPage.tsx;
`/teacher/tutorials` redirects there); its editor is PresMaker on the web
(`backend/templates/presmaker.html` and `frontend/public/static/`, MADE by
`tools/sync_presmaker.sh` from `~/presMaker/web` with PyIDE's notes.js — never
edit them here). The `gameide` adapter in that page draws ```check blocks and
`highlight:` lines in words, and its + Tests writes ```check lines (unchecked
there: only checks.ts reads GameIDE's words, so the Tutorial box flags the
ones it can't read).

**Built-ins are in every teacher's library.** One not yet used is listed from
`index.json`; using it (Assign, Edit, Link) makes the teacher's own row
(`origin = "builtin:<name>"`, `library.builtin_row`), and every assignment
made from it links to that row, so changing it changes theirs and never the
built-in. Notes that are a built-in word for word (assignments from before the
library) are linked to that row by the import (app.py's `known` hook). Teachers'
tutorials from `gameide_tutorials` were moved into `library_items` with their
slugs (`tutorials.migrate`), so `t:<slug>` still finds them; visibility
(private / classes / site) lives on the library row.

## Snowfort Flags

`showcase/flags/`: capture the flag as a snowball fight (the teacher's ask, 2026-11-12),
in a park bigger than the screen (`_2map.py`: Red's half as letters, Blue's its mirror;
the build refuses a park with unreachable floor). Every number is in `game/_1rules.py`;
`_3match.py` decides every hit, pickup and capture; computer kids (`_4bots.py`) act only
through the same `throw()` and walking as a player. **Bots fill the teams** to 4 a side
(the teacher's choice, unlike Undertow): with more than 8 players there are none.
In a room (`_7room.py`, `Remote`) the host's game is the referee as in Undertow: it runs
the match and every bot and sends `g`; a player's own throw flies at once as a copy and
the host throws the real one from where it thinks they are; the host's copy of a player
follows them at no more than `CATCH_UP` × walking pace, so a faked position gets nowhere.
A snowball only hits low (near either end of its arc). Art is the teacher's Gemini
sheets (`raw/`), cut by `cut_sheets.py` into `art/`; without it the build draws stand-ins.
Bots that have nowhere to walk think every step, so anything counted per think must be
counted from the match clock (`wait_from`): a 20 s wait was once over in one.
**The bots' aim was eased 2026-11-19** (the teacher: "the computer players never miss"; over
whole matches 37% of their throws knocked someone down, all at middling range): more wobble
growing with distance (`BOT_AIM_ERROR`, `BOT_AIM_AT`), less lead (`BOT_LEAD`), and `BOT_CARELESS`
throws aimed at where you are. Now about 20%. The test samples their aim from one seed: whole
matches aren't repeatable enough to test (18% one run, 25% the next).

## Squeeze

`showcase/lemon/`: a lemonade stand over a summer with no last day (the teacher's ask, 2026-11-12;
one player, the teacher's Gemini art in `raw/`, cut by `cut_sheets.py` into `art/`).
Every number is in `game/_1rules.py`, and **money is whole cents** so the evening's
ledger adds up exactly. `_2summer.py` is the whole economy (buying, spoiling, melting,
who stops and buys, what they think), pure enough for the tests' sensible and silly bots
to play a summer. The weather comes from the summer's seed, so reloading can't buy a
better day. Python check questions only on the title, morning and evening screens.
The school board gets the money every evening (the teacher's choice: only at the
summer's end, it stayed empty for weeks); it keeps each player's best.
**Upgraded 2026-11-18** (the teacher's ask): no last day (each `MONTH` of 30 days has its own
heat wave, rainy spell and parade; `day_plan` makes any day from the seed and the day alone,
so it goes on for ever), no most to buy (`BUY_MOST`; holding - or + repeats, `held_step`), and
the **second stand** is managed: a helper sells at another place you own (the Second room:
open or not, where, its price, cups to send), stocked from your shelf at your recipe as the
stand opens (`send_second`); its day is worked out in one go as yours ends (`run_second`, the
day's own random numbers) and what's left comes back. The old Second stand's faster pouring is
the Helper upgrade now; `bring_up_to_date` gives it to summers that bought the old one, and
carries on a summer that ended on day 30.

## Order Up!

`showcase/cooking/`: a time-management cooking game (the teacher's ask, 2026-11-12: in
the genre of Cooking Fever, so an ORIGINAL one: own name, restaurants, people, look).
Two restaurants of 10 days, Bun Run Burgers then Lantern Noodles. Every number is in
`game/_1rules.py`; `_2kitchen.py` is the rules (cooking windows, what goes on a plate,
serving, tips, combos, stars); every press goes through one `tap()`, so mouse, touch,
keys and the tests' bots all play the same way, and every drag through one `drop()`
that does what tapping the two things in turn would. A press is a tap or a drag only
when it's let go (`pointer()`, run by Kitchen, never by each Spot). A tap on a drink on
the shelf picks it up: it used to bin it, and the pop never reached the customer. Stars are fractions of the most a day
could make. Python check questions only between days. Art: the teacher's Gemini sheets
(`raw/`, `PROMPTS.md`) cut by `cut_sheets.py` into `art/`; Gemini drew four customer frames
as the wrong person, so `SAME_PERSON` there stands another of theirs in. Difficulty was
eased at the teacher's ask (2026-11-12): patience, how long food keeps, the first two
star goals and the late crowds; the third star was kept where it was, so nothing got harder.

## Stack Shack

`showcase/sandwich/`: a sandwich maker (the teacher's ask, 2026-11-16, from screenshots of
an old iPad one; an original game in that genre). No score but the board: the tallest
sandwich eaten, in layers. Pick a bread and cut it, tap or drag layers on, draw sauces by
dragging a bottle over the top, top it, add a side and a drink, then eat it bite by bite;
secret recipes (`RECIPES`, each a `test` over `summary()`) go in a book, which unlocks the
silly fillings. Every number is in `game/_1rules.py`; `_2stack.py` is the whole of the
rules (where a layer lands, `falls_from`: every layer must have the middle of the weight on
it over itself, with less room under a heavier pile, so tall stacks get hard). A Faller
only shows a layer falling; `land()` applies the rules. **Python check questions only in
the recipe book** (the teacher's choice): every other screen says `question_ok(False)`.
Art is the teacher's Gemini sheets (`raw/`, cut by `cut_sheets.py` into `art/`). Gemini drew
every filling and slice from above, not from the side: the build squashes each into a
`slab` (SQUASH, with a side as deep as the layer is thick), so the pile is seen from a
little above, and cuts a frame per bite (`bitten`), so a sandwich is eaten by drawing every
layer at the same frame. Fillings are drawn a little wider than the bread (FILL_W) so they
show at the sides.

## Mix Lab

`showcase/alchemy/`: a combining game (the teacher's ask, 2026-11-16: in the genre of
Little Alchemy, so an ORIGINAL one: own name, own list, own look). Start with Water, Fire,
Earth and Air; 144 things, every one and every recipe in `game/_1rules.py` (`THINGS`,
`RECIPES`, both orders of a pair work); `_2mix.py` is the rules (mixing, hints, `steps_to`
for How?, the 20 achievements). alchemy.test.ts checks everything can be made from the four
and no pair makes two things, and a bot finds all 144 through `tap()` earning every award.
What you find shows up living in the little world along the top (`WORLD`, drawn by World).
Drag one thing onto another, or tap two in turn (cards in the collection, pieces on the
bench) — the same `mix()`. Hints go in RECIPES' order, so list a recipe after the ones its
ingredients come from. Questions any time except mid-drag. Board: things found.
Art: the teacher's Gemini icon sheets, which came back inside a wooden frame (`magenta_box`)
on magenta lighter in the middle, so `key_magenta` keys by how magenta a pixel is, only
outside the outlines, and cuts by the 6 × 3 grid. Picture 1 came back as 18 adventure things
instead of the workbench: cut as `extra_*` for the art library; the bench is still the
build's. Both new games are art library packs (`make_gemini_library.py sandwich alchemy`).

## Cloverbrook

`showcase/farm/`: a farm that grows into a town (the teacher's ask, 2026-11-16: in the genre
of Township, an ORIGINAL one; "a big game with a lot of expansion"), built in phases, each
stopped for review: 1 the farm (done 2026-11-17), 2 animals and factories (done 2026-11-17,
with Gemini's pictures 6-10), 3 the town (done 2026-11-17, Gemini's 11-14),
4 the valley (built 2026-11-18, Gemini's 15-18), 5 awards, events and seasons (built 2026-11-18, Gemini's 19). **Time is real** (the teacher's choice): crops grow
on the real clock (`now()` = `time.time()` + `global_vars.time_shift`, which the tests move
on), so the save keeps when each field was planted and things grow while the game's closed.
**Isometric**: Gemini drew diamonds though asked for top-down, and the teacher chose to match
(2026-11-17). `_3screen.tile_xy`/`tile_at` are the map's arithmetic (farm.test.ts checks every
tile round trips); a thing's depth is minus its screen y, and every picture's origin is the
middle of the ground diamond it stands on (`standing` in the build). The grass and road are
one baked picture (`make_ground`), not a sprite per tile. Every number is `_1rules.py`; the
farm's rules are `_2farm.py` (one dict, `global_vars.farm`, saved whole). Buttons draw at
-1000000, in front of the Farm's own bar and windows (-100000): behind them they were hidden.
Phase 2: animal homes (`HOMES`, three animals each: feed one, it makes its good on the clock)
and factories (`FACTORIES`, one job at a time, a queue of `FACTORY_QUEUE`, finished jobs wait in
it to be collected), one of each, bought in the Build window and placed 2 × 2 (`placing` names
what's being placed). `load_farm` brings an older save up to date (`setdefault`): a new phase's
fields must start empty there too. Orders ask for goods only once the farm can make them
(`orderable`). A home's or factory's window redraws each second (its clocks), keeping the keys'
place. Board: the player's level. Art: the teacher's Gemini sheets (`raw/`, dull magenta keyed by
distance; the crops sheet cut by rows because the ripe wheat touches the corn). Phase 2's sheets came back
with surprises `cut_sheets.phase_2` handles: picture 6 repeated sheet 3's board, truck and stands
under the homes (the sheep pen touches a stand: `apart`), picture 10 drew strawberries twice (the
third row is used), and the animals have magenta shadows (`shadow` makes them dark).
Phase 3, the town (`_2town.py`): houses (`HOUSES`, as many as you like, each of a kind dearer)
bring people only while the town has room (`BASE_ROOM` + each community building's, `lived_in`:
a whole house fits or stands empty), and only a lived-in house's rent clock runs (`town_tick`).
Roads are the player's (`roads`) plus the rules' `ROAD`; townspeople (`Person`) walk them and wait
at the farm stand as visitors (orders of one thing, `serve`). **Move things** picks up anything
the player built or bought (`thing_at`: a `(list, index)` ref) and puts it down keeping the tile it
was held by; Things and Fields read where they are from the farm each step, so a move moves them.
The Build window has tabs (`SHOP_TABS`). The keys' cursor zigzags left and right
(`cursor_step`): diagonal steps only reached half the tiles. Picture 13 drew each townsperson facing both ways:
`PEOPLE_FRAMES` in cut_sheets.py picks a column for each frame and flips the right-facing ones.
Phase 4, the valley (`_2land.py`, `_2train.py`): the map grew to 30 × 30, the farm being the
top `HOME` × `HOME`; the rest is `LAND`, plots bought by tapping them (`buy_land`), and land not
bought is in `taken` (`locked_tiles`), so nothing is ever placed there. What grows wild is
`wilds()`, made from `WILD_SEED`, the same for everyone and never saved; only `cleared` is. The
farm's own DECOR clears the same way (the pond doesn't). Tools and materials are the `kit`, which
takes no barn room; they come from the train (wagons loaded from the barn), the mine, and
`lucky` finds after a harvest or collection (seeded by `drops`, so a reload can't reroll). The
dock and the mine are `SITES`: a home and a factory that come with their plot, read through
`home_info`/`mill_info`, never moved. **Wild trees and rocks are `Prop`s, objects with no events**:
the engine draws their sprite and no Python runs for them, because a couple of hundred Things
with a step and a draw each would cost every frame. A cleared Prop goes the step after the tap.
The train is a `Car` per car, each at its own depth, placed from the clock (`train_engine`), so
a reload shows it where it would be. Gemini drew the train going down-left, not down-right as asked, so
`cut_sheets.phase_4` flips the station, the cars and the track; flipped, the station's own track is
along its front row, which is why the railway is that row (`RAIL_GY`).
Phase 5 (`_2awards.py`): what the farm does is counted by `tally`, called in the rules where
it happens (never in a window), into `stats`; `ACHIEVEMENTS` are three tiers of a stat each,
collected in the Awards window (the trophy). Land and houses are read from the farm itself
(`progress`), so an older save counts them. The week's event (`EVENTS`) starts on the real
clock's Monday, chosen among the events the farm can do then (`can_count`) and kept all week.
The season is the real calendar's (`season_now`): orders for what's in season pay
`SEASON_PAY` more, the world takes its tint, and winter snows (the engine's weather); autumn's
leaves are particles from the Farm, now and then. The barn window is up to four columns (`barn_grid`): every
kind of thing at once ran off the bottom of the screen, and so did the Build window with the
factories on the Farm tab.

## Highmoor

`showcase/kingdom/`: a medieval kingdom to build and raid from (the teacher's ask, 2026-11-18: in
the genre of the base-building raid games, an ORIGINAL one; "bigger than Cloverbrook", "many
buildings and levels and upgrades"; art "less cartoony, more realistic", PROMPTS.md). Seven
phases, each stopped for review: 1 the kingdom, 2 the army and a campaign against computer
villages, 3 raiding classmates (same school, first names; a defender loses a share of stored
gold and food, never buildings, then has a shield), 4 champions and spells, 5 traps and deeper
upgrades, 6 alliances, 7 leagues, events and achievements. Time is real, as in Cloverbrook.
Every number is `_1rules.py`: each building's levels are lists (`cost`, `time`, `keep`, `hp`
and what it does), all one length; `count` is how many each keep level allows. `_2realm.py`
is the rules (builders' jobs on the clock, `finish_jobs`; mines filling, `waiting`/`collect`;
storage, `capacity`; walls; trees and rocks growing back from the seed). Isometric with
Cloverbrook's arithmetic on smaller tiles (64 × 32; the keep is 4 × 4, a wall 1 × 1). **Walls,
trees and rocks are Props** (no events), kept in step by the Realm: a kingdom has hundreds.
A building's picture is one of three a kind (`tier`: levels 1-3, 4-6, 7 on). Board: renown level.
**Zoom** (the teacher's ask): `ZOOMS`, starting a little out; - and + buttons, Q and E. The bar and
windows don't zoom, so a world point on the screen is `to_screen` (× the zoom), and `zoom()` is
read from the engine (`view_width`), never the Realm's setting: scaled by that on the title, the
pointer missed the Play button. **Type is Lilita One** (SIL OFL, `fonts/`, its licence in the zip's
README): the teacher asked for You Blockhead, then for a Clash-of-Clans-like font, but those are
paid or free for personal use only, which a published game can't carry. `TEXT_SCALE` enlarges
every word (Lilita runs small). The mouse wheel zooms about the pointer (`set_zoom(z, at)`).
**The sea** round the island is the Water object: two seamless 512-pixel tiles (the build's
`water_tiles`) drifting different ways, and foam lines lapping along the shore; the first, dark
with dotted glints, "looked like floating in space".
**Phase 2, the army** (`_2army.py`, `_2campaign.py`, `_2battle.py`): troops queue in the
barracks and train on the real clock (each barracks built works at the queue), waiting in the
camps' room. **A battle is pure rules** (`_2battle.py`, no drawing): a layout of buildings, as
a kingdom keeps them, so a computer village (`village_layout`, made from its number) and in
phase 3 a classmate's kingdom fight the same way. Troops follow a flow field to their goal
(`flow`: Dijkstra over the tiles, walls costing `WALL_DETOUR` more, kept until a wall falls);
defenses shoot shots that fly. The Battlefield only shows it: buildings and troops are Props
(no events), moved each step from the battle; `tick` runs every other step. Loot comes out of a
building as it's damaged. `finish_raid` applies a battle to the kingdom once.
**Phase 3, raiding classmates** (the teacher's ask: kids attack each other's bases; buildings
knocked down stand again afterwards, the teacher's choice; trophies move): the engine's
`raid_` functions (runtime.py; page side `player/raids.ts`, server `backend/raids.py`, tables
`RaidBase` and `Raid`). **The server decides the fair parts**: who is matched (same email
domain as the boards, nearest in trophies, not shielded, not being raided), the loot on offer
(`LOOT_SHARE` of what the kingdom shared), the trophies at stake (`stakes`), the shield, and it
checks a result against its offer. The battle is played in the raider's browser, so stars can
be faked with browser tools: it touches no grade. A defender's game takes a raid's loss off its
own save once (`raids_applied`) and tells the server (`raid_seen`). A battle records its
deploys (`replay`), and replaying them at the same moments gives the same battle (no randomness
in `_2battle.py`: keep it that way). Looking round before the first troop is free (the clock
starts then); Next costs a search. Names are first names: a new raid route needs a leak check.
**Phase 4, champions and spells** (`_2magic.py` at home, the battle script in battle): a
champion's level is their altar's, their wounds heal on the real clock (`champ_hp`); spells
are brewed in the mage tower for gold. In battle a champion is a unit carrying its own
`stats` (`troop_stats`), its ability once (`ability`); spells are `cast` anywhere, Lightning at
once, the others as `zones`. Every action goes in the replay as a code `battle_act` reads back
(a troop's kind, "warlord_5_900", "rage_3", "cry"); a replay step is due within half a tick of
its time (they're kept to thousandths: matched exactly, a step landed a tick late and the
replay drifted).
**Phase 5, traps and the forge**: traps are buildings at home but not in battle (`new_battle`
puts them in `b["traps"]`: no cells, no stars, nobody goes for them); `traps_tick` sets one off
once when a troop comes within `TRAP_TRIGGER`. They re-arm (a raid leaves buildings standing).
The forge researches troops' levels (`_2forge.py`): a leveled troop carries its own `stats`
(`troop_at`), and its replay step is "footman_3".
**Phase 6, alliances** (`backend/alliances.py`, the engine's `ally_` functions, `_2allies.py`):
same school only (an alliance is its founder's school's), first names only, and **no typed
words ever**: an alliance's name is two word numbers and a banner number, a message a phrase
number (`ALLY_FIRST`, `ALLY_SECOND`, `BANNERS`, `PHRASES`), so there's nothing to moderate. Troops
are asked for (the alliance hall's room) and given (the server checks they fit, at most
`GIVE_MOST` each); gifts go into the army once (`gifts_taken`). Raids never match allies. A notice
to the server (a raid seen, gifts taken) goes once (`told`): sent every step until the next news,
it was a request a second.

