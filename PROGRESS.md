# Progress

## Phase 8 — Event sheets ✅ (2026-10-26, waiting for review)

As agreed: per-event sheets, explicit for-each instead of GDevelop's hidden picking, typed Python boxes, and sheets for creation code but not scripts.

### Done

- **An Event Sheet tab for every event**, and for creation code (in the same dialog as its blocks). The sheet is one method's body, so its subject is `self`; objects, inheritance, collision events with `other`, alarms and scripts all stay as they are.
- **Rows of conditions → actions.** Conditions are on the left, actions on the right, as in GDevelop.
  - A row with no conditions just runs its actions.
  - A row's conditions are all needed (`and`), or click **all (and)** to make any one enough (`or`).
  - **not** turns a condition around.
  - From a row's ⋯ menu: **sub-events** (nested `if`s), **Else** after a row (with conditions it's `elif`), **For each** inside, comments, move up/down, delete.
- **For each Enemy as e** is how a sheet works on other instances. The rows under it say `e.x`, `e.hspeed`, `destroy e`: the loop students will write in Python, in the open.
- **Pickers come from the catalog:**
  - Every function that answers True or False is a condition.
  - Every function called for what it does is an action.
  - Your scripts' functions are listed too.
  - Plus **Compare two values**, **Python condition**, **Set or change a value** (`=`, `+=`, `-=`), **Destroy an instance** (`other` to start with in a collision event), **Python line**, and **Trigger once**.
- **Trigger once** is GDevelop's favourite: true the first step the rest of the row is true, then not again until it has been false. It compiles to `self.once("…", condition)`, a small new method on every instance, documented with the other properties.
- **Every box is a small Python editor:**
  - It has the editor's highlighting and autocomplete. Inside the quotes of a name parameter, it suggests the project's objects, sprites, rooms, layers, keys or colours.
  - It's checked as you type (no Pyodide needed on the page): a red outline and a tooltip say "This isn't a Python value." A line box refuses `if`/`for`/`while`, since rows do those.
  - An Else with no row above it, or a for-each with a bad name, is flagged on the row.
- **The Python beside the sheet** is what a person would write: `if keyboard_check("right") and not place_free(self.x + 4, self.y):`, brackets only where `and`/`or` need them, `camera_shake()` while its arguments are the defaults, `pass` only where Python needs it.
- **Errors land on the row:** clicking a game error outlines the action (or row) that made the line, and marks the line in the Python.
- **Undo:**
  - Each box has its own typing undo.
  - Ctrl+Z anywhere else on the sheet (or ↶ ↷ in its toolbar) undoes the last change to the sheet. Typing in one box is one step.
  - The project's undo leaves sheets alone, as it does code and blocks.
- **The same rules as blocks:** empty code switches freely between Python, Blocks and Event Sheet. A sheet converts to Python once, after a warning. Python never becomes a sheet, and blocks and sheets don't turn into each other.
- **Renaming** an object or sprite changes it in a sheet's boxes and for-each rows.
- **Calls to your script functions follow them.** If a function gains or loses a parameter, its calls on a sheet get a box (starting at 0) or lose one when the sheet is next opened, as call blocks do.

The project format is now **version 7**: events and creation code can be sheets. Older projects load unchanged. Sheets are plain JSON (`eventsheets/sheet.ts`), easy for tutorial step checks to read.

### Tests

```
cd frontend
npm test                      # Vitest: 174
npm run e2e                   # Playwright: 48 editor tests + 7 account tests
../backend/.venv/bin/python ../backend/tests/test_server.py   # 53 server checks
python3 scripts/sabotage.py   # 242 deliberate bugs
```

New this phase:
- `src/eventsheets/sheet.test.ts`: the exact Python for and/or/not, no-condition rows, sub-events, else/elif, for-each, comments and Trigger once; the line map; the checks on what's typed; every catalog condition and action compiling in real Python with the arguments its boxes start with; Trigger once firing once and again after resetting, in a real game; renaming.
- `e2e/sheets.spec.ts`: building a sheet with the pickers and playing it with the keyboard; name suggestions inside quotes; nesting, else, for-each and comments; a bad box marked; the Python/Sheet rules and Convert; an error outlining its action; Ctrl+Z on and off the sheet; creation code as a sheet, renamed.

### Known issues and gaps

- **Scripts can't be sheets**, as agreed. A script is function definitions, which aren't conditions → actions.
- **No drag-and-drop of rows.** They move with Move up/down in the row menu; sub-events are added from it rather than dragged under a row.
- A for-each row's object is a dropdown of objects only, not tile layers (those aren't instances).

---

## Phase 7 — Code blocks ✅ (2026-10-26, reviewed)

### After review: blocks everywhere code lives

You were happy with the known gaps except one: only object events had blocks. Now:

- **Scripts can be blocks.** A blocks script is functions: **Make a function** gives Blockly's `def` block, with parameters and `return`. The Python beside it is ordinary, PEP 8 spaced:

  ```python
  import random


  def roll():
      r = random.randint(1, 6)
      return r
  ```

  There's no `self` in a script, so blocks that need one are left out of its palette, and inputs that start as `self` elsewhere start empty.
- **A Functions category in every palette** has a call block for each function your scripts define, whether typed in Python or made with blocks. There's one slot per parameter. If a function gains or loses a parameter, its call blocks follow when next opened and keep what was plugged into slots that still exist.
- **Creation code can be blocks.** The room editor's side panel is too narrow to build in, so blocks open in a large dialog, and the panel shows the Python they make.
- The rules are the same in all three places: no Python yet (nothing, or only comments) switches freely; blocks convert to Python once, after a warning; Python never becomes blocks.

**Found along the way:**
- **Renaming an object never reached creation code**, typed or not. It does now, and the rename prompt counts uses there too.
- **A call to a function that had lost a parameter stopped its blocks loading at all.** The call was reshaped while it was still loading. Now it loads as saved and is updated afterwards.

The project format is now **version 6**: scripts and creation code can be blocks. Older projects load unchanged.

### Done

- **A Blocks tab for every event.** Drag blocks under the event's hat (`def on_step(self):`). The Python they make shows beside them, read-only, and changes as they do. On a narrow window it shows under them instead.
- **The palette is made from the API catalog.** Every function and variable the runtime has is a block, in its catalog category, with its description as the tooltip. Adding a function to the catalog makes its block, with no other work. A test checks every catalog entry has its block and that each block's Python runs in real Python.
- **Categories in Scratch's colours:** Motion, Instances, Collision, Input, Variables, Logic, Loops, Math, Text, Drawing, Rooms, Camera and Debug. Sound arrives with sounds in Phase 9, from the catalog like the rest. The blocks have Scratch's shapes (Blockly's "zelos" renderer).
- **The Python reads like a person wrote it**, since students learn from it:
  - `self.x -= 4`, not `self.x += -4`;
  - `f"Score: {global_vars.score}"` for joined text;
  - `camera_shake()` while its arguments are still the defaults;
  - four-space indents and double quotes;
  - no `x = None` lines, and no unused imports.
  - The blocks say True, False, None, `and`, `or`, `not` and `print`.
- **Variables:**
  - "my" variables belong to the instance (`self.lives`) and keep their value between steps, which is what students almost always mean.
  - "global" variables are shared by every object (`global_vars.score`).
  - Local variables, for loops, live only inside the event.
- **Blocks for the rest:** setting, changing and reading properties (x, hspeed, image_xscale…, also of `other` or a loop's `e`), `self` and `other`, destroy, alarms, and "for each e in instances(...)".
- **Pickers for names:** objects, tile layers, sprites, rooms, keys, mouse buttons and colours, filled from the project. A name the project no longer has is kept, not swapped for another. The game then says "no object called Coin", which a student can act on.
- **Renaming** an object or sprite changes it in blocks too, even in blocks open on screen.
- **Convert to Python** turns a blocks event into ordinary Python, after a warning; it can't be undone. Python never turns into blocks: the Blocks tab is disabled for an event with Python in it. An empty event can switch either way freely.
- **Loose blocks** lying beside the hat are greyed out and left out of the code, as in Scratch.
- **Errors land on the block.** Clicking a game error selects the block that made the line and shows the line in the Python beside it.
- **Undo:** Ctrl+Z inside the blocks undoes blocks, with Blockly's own undo. Anywhere else it undoes the project, and never changes blocks, just as it never changes typed code.
- **Blockly 13.3.0** is the one new dependency. It adds about 220 KB gzipped, downloaded only the first time a Blocks tab opens. Students who only type Python never load it. Its icons and sounds come from our own server, not Google's, so a school filter can't break them.

The project format is now **version 5**: an event can be `mode: "blocks"`, with its blocks beside its Python. Older projects load unchanged.

### Found and fixed along the way

- **Project undo merged unrelated changes.** Any two changes without a label made within a second became one undo step. Adding an event and then ticking Solid was one step, and undoing the tick deleted the event. Unlabelled changes are now always separate steps, and the object editor's changes have their own labels ("Undo change solid").

### Tests

```
cd frontend
npm test                      # Vitest: 157
npm run e2e                   # Playwright: 42 editor tests + 7 account tests
../backend/.venv/bin/python ../backend/tests/test_server.py   # 53 server checks
python3 scripts/sabotage.py   # 214 deliberate bugs
```

New this phase:
- `src/blocks/blocks.test.ts`: every catalog entry's block, every palette block's Python checked in real Pyodide, the exact text of typical programs, blocks running in a game, renaming.
- `e2e/blocks.spec.ts`: building an event by dragging blocks and playing it; the Python/Blocks rules and Convert; an error selecting its block; Ctrl+Z in and out of the blocks; renaming with the blocks open; a blocks script's function called from an event's blocks; creation code built in its dialog.

### Known issues and gaps

- A function block shows its Python name and parameter names (`place_meeting x ( ) y ( ) obj ( )`) rather than a Scratch-style sentence. That's on purpose, so the block matches the Python beside it. Blockly's compare block shows `=` where the Python has `==`.
- After a rename, a palette category still shows the old name until it is opened again. Blocks placed after that, and the code, use the new one.
- No starter tutorial uses blocks yet. "Blocks to Python" is one of the four tutorials in Phase 11.

---

## Phase 6 gaps, fixed (2026-10-26, reviewed)

You asked for Phase 6's known gaps to be fixed before Phase 7. Three of them are fixed, and one more turned out to be a crash.

1. **Undo covers the whole project:** sprites, tilesets, objects, rooms and the resource tree, including deleting things. It lasts for as long as the project is open, whatever tab the change was made in.
   - The **↶ ↷** buttons in the top bar say what they'd undo ("Undo delete Coin"). Ctrl+Z, Ctrl+Shift+Z and Ctrl+Y work everywhere except while typing in a box.
   - Changes close together are one step: a painted stroke, or typing a number into a box.
   - **Undo never changes code.** Code keeps its own undo inside its editor, and restoring an older snapshot keeps every event's, script's and creation code's current text. Without that, undoing a sprite change would wipe out typing done since.
2. **Replacing a tileset's picture** (or changing its tile size, offset or spacing) keeps painted tiles on the same part of the picture. Solid flags and autotile sets move with them. Tiles with nowhere to go are removed with a notice, and Undo brings them back.
3. **Huge levels:** the game draws tile layers in 16 × 16-tile chunks, built only when they come near the view, hidden when they leave, and freed when far away. The room editor draws only the cells on screen, and **Fit now zooms out to 2%** (it stopped at 10%, which left big rooms off screen).

   An honest note: on this laptop, even drawing all 86 000 tiles held 60 fps. The gain is memory, and frame time on slower machines like Chromebooks. So the test checks what is drawn (about 1 700 of the 86 000), not speed. The Debug overlay shows "tiles drawn" too.
4. **Autotiling:**
   - A tileset can have **autotile sets**: 16 tiles, one for each way a cell joins its neighbours.
   - Build one in the tileset editor: pick a slot (each shows which sides it joins) and click its tile; it moves on to the next slot. Or use **Take 16 in order**.
   - In the room editor, the Tiles panel lists autotile **brushes**. Paint, rectangle, bucket fill and erase all pick edges and corners by themselves, and update the neighbours too.
   - The starter tileset now has a 16-piece **grass** set, and the Platformer template's ground is painted with it.

**Not changed, on purpose:** tiles still don't send collision *events*. GameMaker's don't either, and an event firing every step a player stands on the floor would be noise. `place_meeting`, `place_free` and `move_and_collide` cover it.

**Found along the way:**
- **A crash: replacing a tileset's picture crashed the tileset editor.** The old picture was closed while still on screen. The room editor's picture hooks had the same pattern. All three now close old pictures only after the new ones are showing, and a test pins it.
- **The platformer's enemies shook in place** (you spotted this one). They stood a row above the ground, so the "edge of a drop" check found nothing under them and turned them round every step. They now stand on the floor, look half a tile ahead (they used to walk until their middle was past the edge), and a test checks that they walk and turn at both ends.
- **A tile cleared during play was hidden but kept.** Its sprite is now freed.
- **A weak test the sabotage run exposed:** the autotile-set test only checked a button appeared. It now paints with the set and checks the tile.

The project format is at **version 4** (autotile sets). Older projects upgrade on load, unchanged.

### Tests

```
cd frontend
npm test                      # Vitest: 131
npm run e2e                   # Playwright: 35 editor tests + 7 account tests
../backend/.venv/bin/python ../backend/tests/test_server.py   # 50 server checks
python3 scripts/sabotage.py   # 170 deliberate bugs
```

---

## Phase 6 — Tilesets and tile maps ✅ (2026-10-26, reviewed; gaps fixed above)

**The spec's acceptance demo passes**, as an automated browser test that does it the way a student would, from an empty project:
- import a character sprite sheet and slice it;
- make a tileset with solid ground and paint a level with it;
- create Player, Coin and Enemy;
- write a Step event with gravity and jumping in Python;
- drag instances into the room and play.

The player falls, lands exactly on the ground, jumps and comes back down, at 60 fps.

### Done

- **Tilesets** are their own folder in the resource tree (no longer "soon").
  - Choose a picture, then set the tile width and height, offset and spacing; the tile count updates as you type.
  - **Click a tile to make it solid** (red). Solid tiles are what players stand on and bump into; others are scenery.
- **Tile layers** in the room editor (Layers → + Tile layer, named "Ground" by default) have their own tools:
  - **Paint** (drag paints; right-click erases);
  - **Rectangle** (repeats the brush to fill);
  - **Fill** (bucket: everything joined and alike, inside the room, capped so a huge room can't hang the page);
  - **Pick** (eyedropper);
  - **Erase**.
- **The Tiles panel** shows the layer's tileset. Click a tile for the brush, or **drag across several for a multi-tile stamp** (a whole platform, a tree).
- **Layers can be reordered** (↑ ↓), shown, hidden and locked. A hidden tile layer isn't drawn but still collides: the usual way to make invisible walls.
- **Undo and redo** for every room edit (Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y, or the buttons). A painted stroke, a rectangle or a move is one step. Up to 100 steps per room while its tab is open.
- **Solid tiles in collisions**, as the spec asks:
  - `place_meeting(x, y, "Ground")`: a tile layer by name, wherever an object name goes;
  - `place_free` and `move_and_collide` with no object named: solid tiles and solid instances alike;
  - `move_and_collide` also reports the layer it hit by name, so `if move_and_collide(0, self.vy):` is true when the floor stops you.

  Tiles collide by the instance's real shape: turned, scaled, circles.
- **`tile_at(x, y, layer=None)`** gives the tile number there (or None). **`tile_set(x, y, tile, layer=None)`** changes the level while the game runs: breakable blocks, doors. Restarting the room puts the tiles back.
- **A Platformer template:**
  - a scrolling level painted with the starter tileset;
  - running and jumping in 15 lines of plain Python;
  - coins and enemies that patrol and can be stomped;
  - a camera that glides, a shake on a hit, and a HUD in Draw GUI.
- **A starter tileset** (grass, dirt, brick, stone, platform pieces, a bush), drawn in code like the starter sprites.
- **Lighter dark theme:** the editor's greys are a step lighter, as you asked. The stage behind the game stays dark.
- **The project format is at version 3** (tilesets, tile layers). Older projects upgrade on load, unchanged.

### Tests

```
cd frontend
npm test                      # Vitest: 120
npm run e2e                   # Playwright: 28 editor tests + 7 account tests
../backend/.venv/bin/python ../backend/tests/test_server.py   # 50 server checks
python3 scripts/sabotage.py   # 150 deliberate bugs
```

**Found along the way:**
- **A real engine bug: `move_and_collide` from a fractional position stopped short.** After a jump, the player landed 0.4 px above the ground (415.6, not 416). Blocked, it stepped whole pixels from 402.6. It now steps to the next whole pixel first. The acceptance test caught it, and a test pins it.
- **Weak tests the sabotage run exposed:**
  - The tile-shape test never set up a case where box and shape disagree. It now has a ball beside a tile's corner.
  - The tileset-count numbers gave the same answer with or without spacing.
  - The delete test used a partial match where `{}` matches anything.

  All fixed. One redundant case was removed, because a second guard in Python already covers it.

### Known issues and gaps

1. **No autotiling.** The spec lists it as nice to have later.
2. Undo history is per room and lasts while the room's tab is open. There's no undo for other resources yet (code has its own).
3. Every tile is its own sprite in the game. That's fine for levels of a few thousand tiles; a huge map (hundreds of thousands) would want chunked drawing.
4. Tiles don't send collision *events* (GameMaker's don't either). Use `place_meeting`, `place_free` or `move_and_collide`.
5. A tileset's picture can be replaced, but tiles already painted keep their numbers. A picture with a different layout reshuffles them.

---

## Phase 5 — Room editor ✅ (2026-10-25, reviewed)

### Done

- **A drag-and-drop room editor** replaces Phase 2's instance table.
  - **Placing:** drag an object from the resource tree onto the room. Or use the **Place** tool: click to place, drag to paint a row along the grid (painting never stacks a second copy in the same place), right-click to erase.
  - **Selecting:** click, Shift-click to add, or drag a box (it catches what lies wholly inside).
  - **Moving:** drag (snapped to the grid; hold Alt for free) or use the arrow keys.
  - **Keys:** Delete, Ctrl+C / X / V (pastes where the pointer is, even into another room), Ctrl+D to duplicate, Ctrl+A for the whole layer, Esc to clear.
  - **Zoom and pan:** Ctrl+wheel or a pinch zooms about the pointer, the wheel scrolls, Space-drag or the middle button pans, and **Fit** shows the whole room. Coordinates show as you move.
  - Instances are drawn with their sprite, turned and scaled. An object without a sprite shows as a labelled box so it can still be found and moved.
- **Room settings:** size, background colour, grid size, and a Snap switch.
- **Layers:**
  - **Instance layers** organise the editor: show and hide, lock (a locked layer can't be clicked or painted on), and choose which layer new instances go on. An instance still draws at its object's depth.
  - **Background layers** have a colour and/or a picture that repeats, stretches or sits once, with its own depth and scroll speed (a moving sky), and **parallax** (0 = moves with the room, 1 = fixed to the screen, between = far away).
  - Tile layers come in Phase 6.
- **Per-instance settings:** object, x and y, scale x and y, angle, and **creation code**: Python run for that one instance after its Create event, with `self` meaning that instance.
  - An error in creation code says "Room1 → Ball at (128, 96), creation code line 2", and clicking it selects the instance and highlights the line.
- **Camera:** a room can show part of itself, a view of any size, following an object (snapping to it, or gliding with smoothing), and always kept inside the room. The editor draws the view as a dashed box where the game would start it.
  - In code: `camera_follow(self)`, `camera_follow(self, 0.1)` to glide, `camera_set(x, y)`, `camera_shake(strength, steps)`, and `view_x`, `view_y`, `view_width`, `view_height`.
  - `mouse_x`/`mouse_y` are room positions under the camera.
- **Added to this phase:**
  - **Screen shake**: `camera_shake`. It moves only the picture: `view_x`, the mouse and collisions never shake.
  - **A smooth camera**: the room's smoothing setting, or `camera_follow`'s second argument.
  - **Full screen**: a button by Play; Esc leaves.
  - **Crisp pixel scaling**: the game window grows only by whole numbers (2×, 3×…), so every pixel stays square. It's on by default and in Game settings. The camera's position is drawn on whole pixels, so pixel art doesn't shimmer as it glides.
- **A Draw GUI event** draws on the screen over everything, where the camera can't move it: scores, health, menus. The coins template's HUD uses it now.
- **The project format is at version 2.** Older projects are upgraded as they load and look exactly as they did: their instances go on an Instances layer, the camera is off, and nothing is scaled or turned. A test pins this.

### Tests

```
cd frontend
npm test                      # Vitest: 102
npm run e2e                   # Playwright: 24 editor/sprite/room tests + 7 account tests
../backend/.venv/bin/python ../backend/tests/test_server.py   # 50 server checks
python3 scripts/sabotage.py   # 129 deliberate bugs
```

New this phase:
- the room editor's geometry: snapping, hit-testing turned and scaled pictures, the topmost instance, locked and hidden layers, box selection, copy and paste;
- the camera preview;
- the upgrade from version 1 to 2;
- building rooms: overrides only where set, hidden backgrounds left out;
- creation-code errors mapped to their instance;
- in real Python: overrides before Create and creation code after it, follow and clamp, smoothing, `camera_set`, `camera_follow`, shake fading out without moving `view_x`, the mouse in room coordinates, and Draw GUI apart from Draw.

In the browser:
- dropping from the tree;
- painting without stacking, and erasing;
- box select, nudge, copy, paste and delete;
- locked layers;
- creation code, and its errors;
- a following camera with whole-number scaling;
- a scrolling background layer.

**Found along the way:**
- **A real bug: clicking exactly on a grid line could place an instance a whole row up.** Floating-point zoom arithmetic turned 96 into 95.99999. Snapping now allows for that, and a test pins it.
- **The sabotage harness passed silently on a mistyped case name.** It printed "ALL SABOTAGES CAUGHT" for a case that didn't exist. Now it refuses unknown names.
- **Weak tests the sabotage run caught:** the box-select test had nothing partly inside the box, the paste test didn't check the copies' ids differ from each other, and one sabotage broke the build instead of the behaviour. All fixed.

### Known issues and gaps

1. Instance layers don't set depth: an instance draws at its **object's** depth. That keeps Phase 2's Depth setting meaningful. GameMaker 2 does it the other way: the layer sets the depth.
2. The room editor draws each instance's first frame; it doesn't animate.
3. `view_x` in Python is where the camera was at the end of the last step. It's always current for drawing; it just doesn't change in the middle of a step.
4. Hiding an instance layer only hides it in the editor; its instances are still in the game. Hiding a background layer leaves it out of the game.
5. There's no undo for room edits yet. Code has its own undo, per event.

---

## Phase 4 — Sprites ✅ (2026-10-25, reviewed)

### Done

- **Import your own pictures:** PNG, JPG, GIF or WebP, from **Add a sprite → Import your own picture…**, by **dropping a file anywhere on the editor**, or by **pasting** one.
  - Animated GIFs come in frame by frame in Chrome and Edge. Elsewhere you get their first frame.
  - Pictures over 4096 px on a side are refused, and the message says why.
- **The sprite sheet slicer** cuts a picture one of three ways:
  - **Whole picture**;
  - **Equal frames**: N frames across, or stacked;
  - **Grid**: frame width and height, columns and rows (0 = as many as fit), offset, spacing.

  The grid is drawn over the picture as the numbers change, with every frame numbered. Clicking a frame leaves it out or puts it back. The chosen frames play beside it at the speed you set. You also pick the name and the origin (center, bottom-center for feet, or top-left). Half frames at the edge are left out, not cut.
- **The sprite editor:**
  - the picture with its origin and mask drawn over it;
  - a frame strip with add frames (only frames of the sprite's size), move and delete;
  - play and pause, and an **animation speed** in frames per second;
  - the origin by click, numbers or presets;
  - the **collision mask**:
    - **Box fitted to the picture**: the default, kept fitted as frames change;
    - **Box I draw**: drag on the picture;
    - **Circle**: drag from the middle out;
    - **Exact pixels**: frame by frame.
- **Masks turn with `image_angle` and scale with `image_xscale`/`image_yscale`** (added to this phase). A circle under uneven scale is an exact ellipse.
  - A test checks that a turned mask sits exactly where the renderer draws the sprite.
  - The common case, unrotated boxes, costs what it always did.
- **Animation speed belongs to the sprite now**, as in GameMaker. `image_speed` multiplies it: 1 is the sprite's speed, 2 twice as fast, 0 stopped. Sprites made before this phase have no speed and keep the old meaning (one frame per step), so existing games animate exactly as before.
- **Starter sprites** have their own speeds and fitted masks; the ball and coin collide as circles. The coins template no longer needs code to slow its coin down.
- Imported frames are saved like every other picture: in the browser, and in Postgres when signed in.

### Tests

```
cd frontend
npm test                      # Vitest: 85
npm run e2e                   # Playwright: 16 editor and sprite tests + 7 account tests
../backend/.venv/bin/python ../backend/tests/test_server.py   # 50 server checks
python3 scripts/sabotage.py   # 103 deliberate bugs
```

New this phase:
- the slicing arithmetic: grid, spacing, offsets, strips, half frames;
- finding the opaque part of a picture, ignoring soft edges;
- every mask shape, turned and scaled, against the renderer's transform;
- the separating-axis test;
- circles missing a box's corner;
- exact pixels, using the frame on screen;
- slivers thinner than a pixel;
- collision events and queries using the exact shapes;
- per-sprite animation speed;
- refitting automatic masks while keeping hand-drawn ones.

In the browser: dropping a sheet and skipping a frame; a grid with spacing; adding frames of the wrong size and then the right one; drawing a mask; and a ring whose hole really isn't part of it in a running game.

What the sabotage run caught in my own tests: the "touching boxes" check never reached the shape test, because the bounding-box check already rejected those boxes; and one test name was read as a regular expression. Fixed: the touching check now uses squares turned 45°, whose bounding boxes overlap. One real bug was found by looking: frame thumbnails went blank because React runs effects twice in development and my cleanup revoked pictures still on screen.

### Known issues and gaps

1. **Exact-pixel masks are tested by sampling** the overlap one point per pixel, at most 4096 points. Two huge sprites overlapping slightly can, in principle, miss a one-pixel touch. Boxes and circles use exact arithmetic or sampling the same way.
2. GIF frames need Chrome or Edge (`ImageDecoder`); other browsers get the first frame. A GIF's own frame timing becomes one average speed.
3. There's no built-in pixel editor (the spec lists it as nice to have later).
4. Replacing a single frame's picture means deleting it and adding another, then moving it into place.

---

## Phase 3 — Backend core ✅ (2026-10-25, reviewed and deployed at https://gameide.onrender.com/)

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

## The plan from here (amended 2026-10-25)

The spec's phases 4–11, plus **game feel**, added so student games can look
and feel like GameMaker's showcase (Hyper Light Drifter, Katana Zero, Nuclear
Throne…). Small pieces go into the phase they belong to; the rest is a phase
of its own after Phase 9.

| Phase | Spec | Added |
|---|---|---|
| 4 Sprites | import, sheet slicer, origin, masks, animation | **rotated and pixel-precise masks** |
| 5 Room editor | placement, layers, camera, rooms | **screen shake, smooth camera, full screen and clean pixel scaling** |
| 6 Tiles | tile painting, solid tiles | |
| 7 Blocks | Blockly | |
| 8 Event sheets | conditions → actions | |
| 9 Sounds, export, publishing | audio, HTML5, zip, publish, Explore | **gamepad, save files (progress, high scores), custom fonts**; desktop exports; installable web app (Android APK dropped) |
| 9½ Game feel (new) | — | **particles, lighting and blend modes, ready-made shader effects (glow, CRT, flash, outline), tweening and easing, a dialogue-box helper, hit-pause** |
| 10 Classrooms | classes, assignments, dashboard | |
| 11 Tutorials | tutorial panel, checks, library | |

## Next: Phase 9 — Sounds, export, publishing

Audio (sounds stored in Postgres like pictures), HTML5 export, the remaining microStudio exports (installable web app, desktop), publish links with all three visibility levels, the public Explore page, the class gallery, remixing and reporting — plus gamepad, save files and custom fonts.

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

