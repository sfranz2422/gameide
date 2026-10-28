# Progress

## Mystery Meat from Outer Space, part 1: the adventure, with stand-in art (2026-10-28, in progress)
- The third showcase game: a point-and-click adventure after LucasArts' Zak McKracken, in 320 x 200 pixel art. The school paper's reporter, Robin, finds out the new lunch lady's Sleepy Joes come from a spaceship: eight rooms, five people, eleven things to carry, conversations, and a front page at the end. The teacher is making the pictures with Gemini from `showcase/mystery/PROMPTS.md`.
- `showcase/mystery/`: `game/_1world.py` (rooms, clickable spots, walkable floors, people, items), `_2engine.py` (nine verbs, Use/Give with two things, walking with depth, the action queue that plays out each click), `_3story.py` (what every verb does to every thing, as `@on("use", "ice", "boiler")` handlers, and the notepad that always says what to try next), `_4screen.py` (drawing; Thornwood's pixel font, tinted per speaker).
- Until the pictures exist the build draws stand-ins from the world data itself, each room with its spots boxed and named. Gemini's "pixel art" will be shrunk to the game's real pixels and a small palette, and its sprites cut off flat magenta, feet aligned.
- Tests: `src/showcase/mystery.test.ts` plays the whole adventure headless, keeps the doors shut that should be, walks to the foot of a clicked wall, finishes talk one line a click, and tries every verb on every spot in every room. 7 sabotage cases, all caught (a new `MM` runner).

## The Lantern of Greymire: the second showcase game ✅ (2026-10-28, waiting for review)
- **An illustrated gamebook** in the style of inkle's Sorcery!: 60 pages, a painted map you travel by tapping places (the lantern walks the dotted paths), choices that remember (a horse found in the reeds, Marrow's whistle, Gallow's feather, Pip), a riddle, a door of three faces, Sorcery's duel (how much strength into each blow, against a foe whose face may lie), Rewind to before any choice, a save, and four endings, counted on the title. `showcase/greymire/`: the story in `game/_1story.py` as plain data a student can read and change, the book's rules in `_2book.py`, the drawing in `_3screens.py`, and one object, Book.
- **The teacher's Gemini pictures, as they came**: 14 scenes, the map, the paper, and five portraits drawn two to a picture (cut apart by the build, faded at the edges). Gemini gave Pip a body of willow leaves in every scene after the willow, so the story does too. The pictures live in `~/Downloads/greymire/`, not the repository; fonts are IM Fell (OFL), in `fonts/`.
- **The build checks the story** before building (like Thornwood's route checker): every choice leads to a page, every page can be reached, and every page fits its sheet, measured with the real font. It refuses to build otherwise.
- **Engine fixes it found**: Draw-event drawing at one depth now stacks in the order it was called (all of a depth's shapes were one Graphics, so the game's words vanished under its own paper), and a game without crisp pixel scaling is drawn smoothly in the editor too (the pane drew everything pixelated).
- Tests: `src/showcase/greymire.test.ts` (every page drawn whole with book quotes, the best ending played by keys, a duel's arithmetic and its full-strength choices fitting, Rewind, the dark ending), `feel.editor.spec.ts` (draw order read back pixel by pixel; smooth scaling). Played in WebKit with an iPhone's screen. 13 sabotage cases, all caught (a new `GM` runner rebuilds the game around each); the first runs missed two, both fixed: holding back's extra strength hidden by the cap, and an over-long page that still fit.

## The Lantern of Greymire, part 1: ask(), wrapped text, the prompts (2026-10-28, in progress)
- The next featured game: an illustrated gamebook like inkle's Sorcery!, in a haunted marsh. The teacher is making its pictures with Gemini from `showcase/greymire/PROMPTS.md` (one locked ink-and-watercolour style, a reference picture attached to every prompt).
- **`ask(question, choices, name=None, then=None)`**: a question in the dialogue box, after any `say()` lines waiting, with its choices under it once it's typed out. Click or tap one, arrow keys and Enter, or its number. `answer()` is the choice (None while asking); `then` is called with it. A click that shows the question whole picks nothing, and a tap that misses the choices does nothing.
- **`draw_text(x, y, text, width=None)`** breaks lines between words to fit the width, measured in the font set now; **`string_wrap(text, width)`** does it alone, so a page can be typed out (`string_wrap(t, w)[:n]`) without words jumping lines.
- Tests: `feel.test.ts` (order after say, keys, numbers, a click on a choice and one off it, then, the errors, wrapping and its cache per font size) and `feel.editor.spec.ts` (a real click on the game's canvas picks the choice under it). 10 sabotage cases, all caught (one first missed: the wrap cache was never asked the same text at two sizes).

## Docs as a page; Thornwood on an iPhone ✅ (2026-10-28, waiting for review)
- **Docs is in the top bar** (`#/docs`, `editor/DocsPage.tsx`): the editor's Docs tab as a page, every function and `self.` property, searchable, in columns. There's no code there to type into, so a click copies the entry. On a phone the bar's links take a row of their own under the name; in one row, Docs and the light/dark button ran off the edge.
- **Published games were a black screen on every iPhone** (Safari's engine is the only one there). Pixi, starting its renderer, imported its worker extensions, which the bundler had put in the worker's own file — so the import was of the worker's script, and Safari ran it a second time: "Extension type texture-source already has a handler". The touch buttons showed (the game's Python had started) but nothing drew and nothing moved. The worker now imports them itself (`gameWorker.ts`). Found by playing the published Thornwood in WebKit with the phone's screen size.
- **The player said nothing** when the engine failed: it ignored a crash with no Python error. It shows the message now.
- Tests: `e2e/build.editor.spec.ts` (no chunk imports the worker), `published.spec.ts` plays a published game in WebKit until a frame is drawn and shows an engine failure, `e2e/docs.editor.spec.ts` (the page, search, copy, the phone bar, and the editor's tab still typing). 10 sabotage cases, all caught (the WebKit test first missed one: it checked the game's Python, which starts before the renderer fails, so it now waits for a drawn frame).

## Building Levels: five lessons on the editor itself; Python Basics first ✅ (2026-10-27, waiting for review)
- **The shelves start with Python Basics**, then Getting Started: every game lesson is written in Python (the teacher's call). A tutorial that names no shelf still goes on Getting Started.
- **Five new Getting Started lessons** (`public/tutorials/lv-*.md`), each opening with the ones before it done (`levelsStart` in store/templates.ts, built from the library's Kenney art as a student builds it):
  1. **Art from the Library**: two frames of a Pixel Platformer character as a sprite, renamed hero, on a Player.
  2. **A Tileset**: the whole Tiles sheet, renamed ground, its grass and dirt marked solid.
  3. **Painting a Room**: a tile layer, the palette, Rectangle, a floor and a platform, and a Decor layer of plants.
  4. **Walking on Tiles**: gravity, `move_and_collide` against the solid tiles, running, jumping.
  5. **A Bigger World**: a 1920-wide room, more ground, a gap that restarts the room, a camera that follows the Player.
- **New checks** for what the editor makes: `sprite hero has at least 2 frames`, `tileset ground has at least 4 solid tiles`, `room Room1 has at least 30 tiles`, `… has a tile layer using ground`, `… has at least 2 tile layers`, `… is at least 1600 wide`, `room Room1 camera follows Player`. On the help page.
- **Spotlight names** for the library button, a tileset's Solid tiles, the room's tools, + Tile layer, its Size and its tabs (`room-tab-*`).
- `e2e/levels.editor.spec.ts` does all five lessons the way a student does — library clicks, renames, solid tiles, painting by dragging, the camera — pressing Check my work at every step. It found two things a student would have hit: Next can't be pressed while the library window is open (the two steps either side of it are one step now), and a spotlight on something not yet on screen never shows.
- `cutCells` moved from LibraryBrowser.tsx to library.ts, for the starters.

## Fixes: `uses +`, events for the whole class, photos everywhere ✅ (2026-10-27, waiting for review)
- **`uses +` failed on `print(3+4)`** (a Python Basics lesson): a check's word had to have no letter or digit beside it, which is right for `for` but meant the 3 beside the + hid it. The edge rule now applies only where the word itself starts or ends with a letter or digit (`checks.ts`, `wordIn`). PyIDE's and FlaskIDE's `uses` couldn't see an operator at all; they read it from the code's tree now.
- **A random event reaches the whole class**: `/api/me/xp/news` sends the class's events (`events_after`) to every student, hit or not, and the popup names who it hit — "⭐ Glowing code review · Ana +10 XP", "You" for themselves. First names only, there and on the class page's banner, which now lists them. The popup is filled green, as in the other editors; red for a student it took XP from.
- **Approved photos**: GameIDE already served one from any editor; PyIDE, WebIDE and FlaskIDE served only their own, so a photo approved in GameIDE was a broken picture on their class pages. Fixed there.

## Notes that play a part at a time ✅ (2026-10-27, waiting for review)
Asked for across all four editors. `animate: words` (or `animate: type`, a typewriter) as the notes' first line; a line of `...` divides a slide into parts.
- In the Notes tab, ▶ Play plays the next part (`reveal.ts`, `animateIn`: word by word or letter by letter; code, questions, cards and tests come in whole). Play waits while a part plays; the next slide's arrow waits until the slide has been played. Slides already played show whole, and how far a student got is kept in the browser (`gameide-reveal:<slug>`), so the notes reopen there. Reduced motion gets each part at once.
- **Speed**: `animate: words slow` / `animate: type fast`, or just `animate: slow`; none is normal. The first speed (70 ms a word) was too quick to read along with — normal is now 250 ms a word, slow 450 (`SPEEDS` in reveal.ts, the same numbers as notes.js).
- **Pause**: `^` on its own waits about a second mid-section (`^^` twice), then carries on by itself; hidden wherever notes show whole, never read in code.
- **↺ Replay** for the teacher: a slide once played showed whole for good, so a change to it could never be watched play.
- **Nothing pops by itself**: what the teacher wraps in `:::pop` … `:::` is a highlighted box, arriving with a little pop (`popMarks`/`popBoxes` in quiz.ts).
- The teacher opening the assignment gets the same, kept apart (`author:`), with ⏭ Skip: it finishes the part playing, or between parts shows the whole slide. Students have no Skip.
- The assignment page's preview shows the notes whole, without the `animate:` line, and now draws a cards block as cards (it was drawn as tests).
- Help page section; Vitest for the header, sections and pops; `e2e/notes.spec.ts` plays a slide through as a student and skips as the teacher. 11 sabotage cases, all caught.

## More in notes: four question kinds, checklists, flip cards ✅ (2026-10-27, waiting for review)
Asked for across all four editors (code that runs in the notes and a notes column were for PyIDE, WebIDE and FlaskIDE only — GameIDE's three columns stay as they are).
- **`type: order`** (put the lines in order), **`type: bug`** (click the wrong line) and **`type: sort`** (sort items into groups) — `backend/quiz.py`, the same file as PyIDE's, now with the three kinds. Order and sort give part marks (order by the longest run of lines kept in order, so one line out of place costs one line); bug is right or wrong. Shuffled lines and items come out in the same order everywhere, by an FNV-1a hash both quiz.py and quiz.ts work out (`scramble`), because that order is part of the question and what an answer is marked against. Redacted like the rest: the order, the groups and the `bug:` line never reach a student.
- In the Notes tab (`NotesPane.tsx`): ▲ ▼ to move a line; a button per line of the bug's code; a tray and a box per group — click an item, then a group (or an item already in that group: a click aimed at a crowded box landed on an item and only changed which was picked, found by the e2e test).
- **`type: predict`**: what does the code in its `~~~` fence print? `answer:` is the output, marked like a short answer (line breaks don't count). GameIDE's notes have no Python to run the code in, as the other editors' do, so once a student has answered, the reply carries the key as `output` and the Notes tab shows "It prints:" — never before an answer.
- **Checklists**: `- [ ] item` is a box to tick, kept in the browser per assignment (`- [x]` starts ticked). **Flip cards**: a ```` ```cards ```` block, `front -> back` a line.
- The help page has them all; `notes.py` refuses an order that isn't the question's lines, a sort with an item left out, and a bug answer that isn't a line number.
- Tests: the shared parse cases (`parse-cases.json`) gain the three kinds, read the same by quiz.ts and quiz.py; Vitest for the shuffle, cards and the cards block; server checks for the keys staying home and the marking; `e2e/notes.spec.ts` ticks a box and reloads, flips a card and solves all three. 11 sabotage cases, all caught.

## Game Elements on Learn ✅ (2026-10-27, waiting for review)
Asked for: the concepts of the video series further down microStudio's tutorials page (mrLman's *Game Elements*, 24 videos in three levels), as our own step-by-step tutorials — no videos. Their code is only in pictures, so the lessons are written fresh for GameIDE, an element each.
- **Lessons that build one game** (`src/tutorials/series.ts`): each lesson starts from the game as the lesson before left it (starter `<series>-<n>`), so a class can start at any lesson. One list says what each step types and makes; the starters are built from it, and the walkthrough test holds every lesson's markdown to it.
- **Game Elements 1: The Basics** — a dodging game: **1. Player** (arrows and WASD, `clamp` to the screen), **2. Gamepad** (`gamepad_axis`, the D-pad, a run button), **3. Enemy** (`hspeed`, coming back round at a random height and speed), **4. Collisions** (lives, `other`, `room_restart`, a flash), **5. Score** (a point a dodge, a Hud, a best score kept across restarts), **6. Time Limit** (an alarm a second, `game_pause`, `ignore_pause` and Space to play again).
- **Game Elements 2: Adding to the Fun** — the same game, carried on (a series can start where another ended, `continues`): **1. Title Screen** (a room made first, `room_goto`), **2. Collecting** (coins, then a `places` script with a function both events use), **3. Projectile** (held fire with a cooldown, Outside Room, bullets hitting enemies), **4. Increasing Difficulty** (faster each pass, capped with `max`, a new enemy every 5 seconds), **5. Multiplayer** (keys in variables, a **Player2** child with `super().on_create()`), **6. End Screen** (a GameOver room, tidying the old pause code away, `save_set`/`save_get` for a best score that lasts). From lesson 1 on the game opens on its title, so the checks that play it hold Space, and firing is a held key, not a press, for the same reason.
- **Game Elements 3: Advanced Techniques** — two new games. A space shooter: **1. Angled Movement** (`image_angle`, `direction`/`speed`, the hspeed and vspeed they make, wrapping with `%`), **2. Top-Down Physics** (pushing with `cos`/`sin`, friction, a top speed, brakes), **3. Spawning and Destroying** (drifting rocks, a Spawner on an alarm, bullets made where the ship points, `b = instance_create(...)`), **4. Delay Timer** (a rate of fire and a safe time, with alarms), **5. Health Bars** (`draw_rect` from a number, colours that warn, a bar over the ship in a Draw event, healing with `min`), **6. Explosions** (`effect`, `camera_shake`, rocks breaking into two smaller ones in a loop, sparks, `hit_pause`), **7. Pause Menu** (`ignore_pause`, choices in a list drawn with a loop, picked with the arrows and Enter), **8. Button Click and Tap** (a Left Pressed event, hover with `collision_point`). Then a cave platformer: **9. Level Maps** (the level as rows of text, built by two loops), **10. Platformer Tools** (`move_and_collide`, gravity, jumping from the ground with `place_free`, short hops, a falling cap), **11. Scrolling Camera** (a room three screens wide, the room's camera following the player, `camera_follow` smoothing, `camera_zoom`), **12. Strike and Interact** (slimes that turn at walls, a short-lived Slash in front of the player, talking to a friend nearby with `instance_nearest`, `point_distance` and `say`).
- Found while testing Level 3: the walkthrough's runner ran ten steps every time a check asked how far the game had got — including the first time, which only reads where it starts — so "after 0.1 seconds" was really 20 steps, and the slash (15 steps long) was gone before it was looked at. It now runs one step at a time for the first 30. A browser test plays the cave game with its painted sprites and finds the player standing exactly where lesson 10's check expects.
- New: **`room_name()`**, the room the game is in now (catalog: Rooms).
- Found while writing them: a check like "after 8 seconds, the score is at least 1" could fail by chance, when three enemies happened to hit the player and the room restarted; checks now ask for the best score, which a restart keeps, and the walkthrough seeds Python's random numbers so it never passes by luck.
- Tests: `src/tutorials/series.test.ts` works every lesson from its own starter — each step's code is in the game after it, and each check passes in the real Pyodide; `e2e/tutorials.editor.spec.ts` opens lesson 3 and finds lessons 1 and 2 done in it, and plays the cave game. 15 sabotage cases, all caught.

## Python Basics on Learn ✅ (2026-10-27, waiting for review)
Asked for: "basic python for kids who don't have a lot of programming experience", shelved like microStudio's tutorials page (its Programming course: short numbered lessons in a series), in our own look.
- A new **Python Basics** shelf on Learn, second after Getting Started, of nine lessons: **1. Hello, Python** (print, strings, comments, reading an error), **2. Variables**, **3. Numbers and Maths** (`//`, `%`, `**`, brackets), **4. Working with Text** (`len`, `.upper()`, `str`, f-strings), **5. Making Decisions** (comparisons, `if`/`elif`/`else`, `and`/`or`), **6. Loops** (`for`, `range`, adding up, `while`), **7. Lists** (index, `append`, `in`, `max`/`min`/`sum`, `random.choice`), **8. Functions** (`def`, parameters, `return`) and **9. Python in a Game** (a Draw event, a loop that draws, `self.` variables, keys). Each ends with a "Your turn", and says which lesson is next.
- They start from a new starter, **python-start**: one object, **Main**, in the room, with a Create event to type in. No sprite: the Console is the point.
- A new check, **`prints <text>`**: plays the game a second and looks for the text in what it printed, ignoring capitals and spacing; failing, it says what *was* printed ("It printed "Helo, world!", not …"). The runtime keeps the first and last 10 000 characters printed (`_printed()`, by wrapping `sys.stdout`), so a print in a Step event doesn't push the Create event's out.
- **The Console under the step**: a lesson with `prints` checks shows the Console's last 8 lines in the lesson pane. The Console is a tab beside Notes, so otherwise a beginner had to leave the lesson after every Play to see their output.
- Tests: `src/tutorials/pythonBasics.test.ts` works through every lesson as a student would — each step's code typed into the event, the "Your turn"s answered — and runs each step's checks in the real Pyodide, so no lesson can lock a student on a step they did right. `e2e/tutorials.editor.spec.ts` does lesson 1's print step in the browser, typo first, and reads the output under the step. 8 sabotage cases, all caught.
- Found on the way: the server had no route for the free art library's pictures (`/library/`), so on the real site it showed none; fixed and pushed on its own (`de1ae8e`), with a server check.

## Phase 13 — Physics ✅ (2026-10-27, waiting for review)
Asked for "not the way microStudio does it — it gets very complicated". So there's no body, fixture or world to make: **code only, no object setting**. Built on planck.js 1.5.1 (Box2D's port, MIT), in `engine/physics.ts`.
- **`self.physics = True`** and it falls, bounces, stacks, tips over and rolls, its sprite's mask its shape (a circle mask a circle, anything else its box). Its `x`, `y`, `image_angle`, `hspeed` and `vspeed` are still the student's: the engine writes them back every step and notices when the game's code changed them since, which is how a throw (`self.vspeed = -6`) or a teleport reaches planck. Gravity, friction-as-slowing and the ordinary speeds are skipped for it.
- Beside it: **`bounce`** (0–1), **`weight`** (its mass whatever its size, 1 to start), **`fixed`** (never moves; things land on it and hang from it), **`spin`** (degrees a step, anticlockwise), and **`friction`**, which for a physics instance is its grip (0.3 when physics is turned on with none). **`other.push(dx, dy)`** changes its speed by (dx, dy) ÷ weight.
- **`physics_gravity(x, y)`** in pixels per step², (0, 0.3) to start, kept across rooms.
- **Joints**: **`physics_join(a, b=None, kind="hinge", x=None, y=None)`** — `"hinge"` (pinned, free to turn), `"weld"`, `"rope"` (never further than now; goes slack) and `"spring"` — to another physics instance or, with b None, the room itself. Gives back a joint for **`physics_unjoin`**. A joint ends with either instance, and with the room.
- **Mixing with the rest**: solid tiles are one static body of rectangles merged as big as they go (separate 16 px boxes snag a sliding crate on every seam); one-way tiles hold a body only from above, and `drop_through` drops it through. **Solid instances without physics are kinematic**: immovable, and a moving one (a lift) carries what rests on it. Physics instances count as solid for `place_free`, `move_and_collide`, `collision_line` and `path_find`, so a player walks up to a crate and pushes it with `for c in move_and_collide(dx, 0): c.push(...)`. Touching pairs fire collision events (resting things only share an edge, which the overlap test doesn't count), once a step; GameMaker's put-back-on-solid-collision doesn't happen to a physics body. Paused (`game_pause`), nothing moves.
- A **Physics** category in the docs, the blocks palette (set physics / bounce / weight / friction / spin / fixed, and the three functions) and the event-sheet pickers.
- Found while testing: planck rests boxes skin to skin, so a crate floated a third of a pixel over the floor and a stack of three was a pixel off; boxes are made smaller by the skin less the slop and now rest within 0.07 px. Telling whether a body is above a one-way tile from planck's own AABB let a falling crate through (it's padded and swept over the step), so it's worked out from the body's transform. A crate resting on a platform had gone to sleep, so `drop_through` did nothing until it is woken.
- Tests: `src/python/physics.test.ts` (21, real Pyodide); `e2e/physics.editor.spec.ts` drops a coin onto the coins game's walls and hangs another on a rope, in the worker. 30 sabotage cases, all caught (the first run missed one: a crate both overlapping and touching a button — only then could its event come twice — had no test). Throwing the world away at a room change isn't one of them: leaving a room already ends its instances' bodies and joints, so nothing a game can see depends on it.
- Not done: a joint can't be drawn for you (draw a rope with `draw_line` between its ends), and nothing slows a swing (a pendulum swings for ever).

## Phase 12 — What GameMaker and GDevelop have that GameIDE didn't ✅ (2026-10-26, waiting for review)
Asked for after Thornwood's level 1 needed workarounds for most of these.
### 12a — Drawing and small maths ✅
- **`draw_sprite_ext(sprite, frame, x, y, xscale, yscale, angle, color, alpha)`**: scaled, flipped, turned, tinted and faded, as GameMaker's. Its alpha multiplies with `draw_set_alpha`'s.
- **Shapes**: `draw_line` (with a width), `draw_circle`, `draw_ellipse` and `draw_triangle` (filled, or outline=True), and `draw_rect_gradient` (top to bottom, or left to right).
- **Text**: `draw_set_halign` ("left", "center", "right") and `draw_set_valign` ("top", "middle", "bottom"), reset at the start of each Draw event like the colour. `string_width` and `string_height` measure text in the font set now: on a canvas in the game, and as monospace's 0.6 em a character in the headless tests.
- **Small maths**, in the Motion docs: `clamp`, `lerp`, `approach`, `sign` and `choose(list)`.
- Each one is in the catalog, so it has docs, autocomplete, a block and an event-sheet entry.
- Tests: `src/python/drawing.test.ts` (6, real Pyodide); `e2e/drawing.editor.spec.ts` reads the game's own pixels for every shape, the scaled and tinted sprite, the gradient and centred text. 12 sabotage cases, all caught. Two existing tests compared whole text commands and now allow for the two alignment fields.

### 12b — Line of sight, one-way platforms, pathfinding ✅
- **`collision_line(x1, y1, x2, y2, obj=None)`**: the first instance (or tile layer's name) a straight line touches, nearest its start; with no object named, anything solid. None is a clear line. Instances are tested by their boxes, tiles every 2 px along the line. The instance asking is never the answer, and one-way platforms don't block a line.
- **One-way platforms**: a tileset's tiles can be marked **One-way** instead of Solid (the tileset editor's new Solid / One-way choice; blue, with a bar along the top). They stop something coming down onto them from above, and nothing else: jumped up through, walked along, and stood on, so `place_free(x, y + 1)` is False on one. **`self.drop_through = 12`** falls through them for 12 steps; it counts down by itself. A tile is never both (marking one takes the other off). Stored as `oneWay` on the tileset, optional, so older projects need no change.
- **`path_find(x1, y1, x2, y2, cell=16)`**: the points of a way round every solid tile and solid instance on a grid of `cell` px, by A* with diagonal steps that never cut a corner. [] when there is no way, or either end is in a wall. For games seen from above. The instance asking isn't an obstacle; a room over 250 000 cells is refused rather than frozen.
- Tests: `src/python/paths.test.ts` (8, real Pyodide); `e2e/tiles.spec.ts` marks tiles one-way and back; the codegen test sends `oneWay`. 12 sabotage cases, all caught.

### 12c — Pausing, camera zoom, parallax down, rooms that remember ✅
- **`game_pause(paused=True)`** and **`game_paused()`**: nothing moves, animates, counts down (alarms, flashes, `drop_through`), collides or gets mouse clicks, particles and weather hang where they are, and tweens wait. Step, Begin/End Step and key events run only for instances with **`self.ignore_pause = True`** (a pause menu), which also keep moving. Everything is still drawn. `game_restart()` starts unpaused.
- **`camera_zoom(zoom=1, steps=0)`**: 2 shows half as much, twice as big, about the middle of the view (a followed instance stays in the middle), at once or eased over `steps`. `view_width`/`view_height`, the mouse, following and the room's edges all use the zoomed view; the window and Draw GUI don't change. Lights scale with it. A new room starts at 1.
- **Parallax down**: a background layer's **Parallax down** (`parallaxY`; absent = the same as across, as before) and two new fills, **Repeat across only** / **down only**, and an **Offset x / y**. A strip of hills now slides sideways and stays at one height on the screen — what Thornwood had to draw by hand.
- **Rooms that remember** (the room's **Remember how it was left**): leaving one parks its instances — the same Python objects, so references between them still work — with their state, and its tile layers as they are; coming back puts them in again with no Create event, and Room Start runs. A reference kept to a parked instance reads where it was (it's a ghost while parked). `room_restart()` and `game_restart()` start it afresh. Found while testing: parked instances stayed on the event lists (`_reap` tidies only when something was destroyed), so coming back listed them twice; `_prune` now runs after parking.
- Tests: `src/python/rooms12.test.ts` (8, real Pyodide); `e2e/rooms.spec.ts` reads a strip repeated across only, at its offset, and the room drawn bigger by zoom; the checkbox; codegen sends the new fields. 22 sabotage cases, all caught.

### 12d — Touch controls, a debugger, flipped and animated tiles ✅
- **`touch_controls(show=True, buttons=('space', 'x'), always=False)`**: arrows bottom-left and up to 4 buttons bottom-right, over the game, each holding its key while a finger is on it — a keyboard game plays on a touchscreen unchanged, several fingers at once. Shown only on a touchscreen unless `always=True`; `touch_controls(False)` hides them. In the editor, published games and exports alike (the host draws them; Python asks with the frame's commands).
- **The debugger** (with **Debug** ticked): **❚❚ Freeze** stops the game's steps where it is (still drawn), **Step** takes one, **▶ Go on** carries on; and **click an instance** to see inside it — its own variables, its built-in properties and `global_vars`, kept up to date three times a second. Separate from `game_pause`, which is the game's own.
- **Flipped and turned tiles**: the tile palette's **⇋ Flip**, **⇵ Flip** and **↻ Turn** change the brush (a block of tiles turns as a whole). A painted cell keeps them in bits above its tile number (`game.ts` `TILE_FLIP_X`…); only the picture changes — collisions, `tile_at` and paths go by the tile. Flips and turns compose as the renderer draws them (scaled, then turned), so the brush shows what the game draws.
- **Animated tiles**: the tileset's **Animated tiles** (+ New animation, click its frames, fps). Paint the first frame; the game shows each in turn, all in step. Kept with the tiles when a tileset's picture is replaced.
- Tests: `e2e/feel.editor.spec.ts` (touch moves the coins Player and stops when let go; the debugger shows the Player's variables updating, and freezing/stepping moves it exactly once); `e2e/tiles.spec.ts` reads a tile painted upside down and its animation cycling; unit tests for brush transforms, flagged tiles colliding, remapping flags and frames. 17 sabotage cases, all caught.

### 12e — A free art library ✅
- **Add a sprite → Free art library…**: Kenney's **Pixel Platformer**, **Tiny Dungeon**, **Tiny Town** and **Pixel Shmup** (kenney.nl), all CC0 — public domain, free for any game, published or sold, credit optional. 100 KB in all, in `frontend/public/library/kenney/`, each pack with its own `License.txt`.
- Choose a pack, then click cells of a sheet — in the order they should play, shift-click for a run — and **Add as a sprite** (its box fitted, 8 frames a second); or **Add the sheet as a tileset**, cut at its own tile size. Either opens at once.
- Tests: `src/library/library.test.ts` (every listed picture there, a whole number of cells, every licence CC0); `e2e/sprites.spec.ts` makes a 4-frame sprite from a run and a 132-tile tileset. 3 sabotage cases, all caught (one showed the run test was too short to tell a run from two clicks).

## Phase 9½ — Game feel ✅ (2026-10-26, waiting for review)

The phase planned in October "so student games can look and feel like GameMaker's showcase", built before the showcase platformer that will use it. Everything is in a new **Effects** category of the catalog, so it's in the docs, the blocks palette, event sheets and autocomplete.

### Done

- **Particles** (`engine/effects.ts`, drawn by Pixi ParticleContainers):
  - `particles(x, y, count, color, speed, size, life, gravity, spread, direction, shape, depth)`; a list of colours picks one per particle.
  - `effect("explosion" / "sparkle" / "dust" / "smoke" / "confetti" / "hit", x, y, color, scale)`: ready-made bursts.
  - `weather("rain" / "snow", amount)` across the screen.
  - `particles_clear()`.
  - At most 4000 particles, so a game never slows to a crawl.
- **Hits**:
  - `hit_pause(steps)` freezes the whole game, still drawn; keys pressed meanwhile aren't lost.
  - `self.flash("white", 6)` draws the sprite as one colour.
  - Both go with the existing `camera_shake`.
- **How a sprite looks**: `self.image_blend` (tint), `self.blend_mode` ("add" for fire and magic), `self.outline` and `self.glow` (a colour, or None).
- **Lighting**: `lighting(darkness, color)` darkens the room, and `light(x, y, radius, color)` each step cuts light out of it with a soft coloured glow. The score in Draw GUI never goes dark.
- **The screen**:
  - `screen_effect("crt" / "vignette" / "grayscale" / "sepia" / "pixelate")`.
  - `screen_flash(color, steps)`.
  - `screen_fade(to, steps, color)`, which lasts across rooms for fade-out / change room / fade-in.
  - `draw_set_alpha(alpha)` for see-through drawing.
- **Tweens**: `tween(self, "y", 100, 30, "out_bounce")` on anything with a number (global_vars too), `tween_stop`, and `ease(name, t)`. There are 16 easings: quad, cubic, sine, back, bounce, elastic.
- **Dialogue**: `say("text", name="Owl")` types a line out in a box at the bottom. Space, Enter or a click goes on, and the key that starts a line never skips it. Also `dialogue_open()` and `dialogue_clear()`.
- `game_restart()` starts all of it over. A new room starts in daylight with no weather or particles; a screen effect, being the game's whole look, stays.
- Five more colour names: cyan, magenta, pink, gold, brown.

### Found and fixed along the way

- **A room's Create events lost their effects**: the room change was applied after them and wiped them (a torch lit in the first step went out at once). Found by the drawing test; now the room changes first.
- **The outline and screen shaders failed to compile** (a uniform at two precisions) and silently drew nothing. They are now high precision throughout.
- **Checks timed by the clock failed on a busy computer**: "after 1 second holding right" now means a second of the *game's* steps, however long that takes. Five browsers at once in the tests showed it; a slow Chromebook in class would have too. It's in 11a's checks, now steady.
- The old camera test waited a fixed 200 ms for the game. It now polls.

### Tests

```
cd frontend
npm test                      # Vitest: 236
npm run e2e                   # Playwright: 65 editor tests + 17 account tests (4 opt-in, skipped)
../backend/.venv/bin/python ../backend/tests/test_server.py   # 345 server checks
python3 scripts/sabotage.py   # 430 deliberate bugs
```

- **`src/python/feel.test.ts`** (22, real Pyodide): particles move and die, the cap, effects and misspellings, weather and rooms, Create events' effects surviving, lighting and per-step lights, screen effects, hit-pause (and keys during it), flash countdown, the four looks, tweens (landing exactly, global_vars, destroyed targets, errors), every easing 0→1, dialogue typing and advancing (and the same key not skipping), fades, alpha, restart.
- **`e2e/feel.editor.spec.ts`** reads the game's own pixels: flash, outline, tint, particles, lighting, a screen effect, and the dialogue box are really drawn.
- A unit test: checks wait for game time on a slow computer.
- 23 new sabotage cases, each caught.

### After review: fixes from trying it

- **Deleting an assignment was a 500 on Render.** Rows pointing at it (its game, its questions' keys…) weren't all deleted first, and Postgres refuses that. The tests' SQLite never noticed, because SQLite ignores foreign keys unless asked. Now:
  - every table that refers to an assignment is cleared first, and the same for **deleting a class** (its random events and visits would have failed the same way)
  - **the tests' database enforces foreign keys**, as Postgres does, with a server check that it does.
- **The code cursor was invisible on the dark theme.** CodeMirror draws its own cursor, near-black unless told otherwise; the event-sheet boxes had the same problem. A test now checks it's light, and was watched to fail. My first fix used the wrong class name and changed nothing; the test caught that.
- **The Add event menu had no way out** but picking an event: it now closes with ×, Escape, or a click away.
- **Spotlights in an assignment's notes**: a `highlight: <name>` line on a slide rings that part of the editor while the slide is open, as in tutorials. The notes editor warns about a name it can't point at, and `#/help/checks#spotlights` lists the names. Found on the way: a `highlight:` line inside a code block was taken out too (in tutorials as well); it's code, so it's now left alone.
- The assignment's page has a **✎ Notes** button that goes to its notes editor.
- Tests now: Vitest 237, Playwright 81 (+4), server 348, sabotage 436.

### Known issues and gaps

- Lights and glows draw in the room; a light on a moving camera follows it, but lights aren't blocked by walls (no shadows).
- Effects are WebGL shaders: every Chromebook has WebGL, but a browser with it turned off draws the game without them.

---

## Phase 11b — Tutorials ✅ (2026-10-26, reviewed)

Built on 11a, as agreed: the tutorial panel **is** the Notes tab, steps are **strict**, a tutorial assigned to a class **is an assignment** whose notes are the tutorial, and **tutorial code can't be copied** (no Copy button; code can't be selected).

### Done

- **The format** (`src/tutorials/tutorial.ts`):
  - A header (`title`, `level`, `time`, `starter`, `description`, and `locked: no` to let students skip), then one step per `---`, exactly as notes are cut into slides.
  - A step has ` ```check ` blocks in the check language, and a `highlight:` line naming part of the editor.
- **In the editor**, the Notes tab shows a tutorial one step at a time: "Step 3 of 8", a progress strip, the step's words and code, its checks with **✔ Check my work** (game checks play in the game pane), and Back / Next.
  - **Next stays locked** until the step's checks pass, or the student passed them before.
  - A step's **spotlight** is a pulsing ring round the part of the editor it's about. It never blocks a click and goes at the first one.
- **Progress lives in the game** (`Project.tutorial`), so it saves offline and signed out like any change. A reload carries on, and the library reads it from the games.
- **The library** (`#/tutorials`, **Learn** in the top bar):
  - Shelved by level (the spec's five).
  - Each tutorial shows not started / step k of n / finished ✓, with Start or Resume. Start builds its starting game.
  - Teachers get **Write a tutorial**, Edit on their own, and **Assign to…** a class.
- **Writing one** (`#/tutorials/edit/…`): the markdown with a step-by-step preview, warnings for any check GameIDE can't read or spotlight on nothing, who can see it (only me / my classes / everyone, admins only), Try it, and Delete.
- **Assigning** makes an assignment from the tutorial's starting game with the tutorial as its notes. Its checks are what Check all checks and count toward the grade. The results page shows each student's step.
- **XP**: 2 for each step with checks passed (once ever), 20 for finishing (once). Only for tutorials the student can open.
- **The four starters**, each from a starting game made for it:
  - **Your First Game** (8 steps): sprite, object, room, arrow keys.
  - **Collect the Coins** (6): collisions, score, a HUD, sound. It starts from the maze with no scoring.
  - **Simple Platformer** (7): speed, `move_and_collide`, gravity, jumping, coins. It starts from the level with a still Player.
  - **Blocks to Python** (7): an event in blocks, its Python, then turned into Python.
- New check: `Player.step is written in blocks` (or python, or an event sheet).

### Tests

```
cd frontend
npm test                      # Vitest: 213
npm run e2e                   # Playwright: 64 editor tests + 17 account tests (4 opt-in, skipped)
../backend/.venv/bin/python ../backend/tests/test_server.py   # 345 server checks
python3 scripts/sabotage.py   # 407 deliberate bugs
```

- Unit tests:
  - the format
  - the problems it reports
  - **every built-in tutorial**: it reads cleanly, its starter exists, all its checks are readable, all its spotlights are real, and it never says "copy"
  - **every spotlight target is still in the editor**
  - step counts match the server's (shared cases).
- **26 new server checks**: sharing (private / classes / site, admins only for site), only its author edits, step XP (once, only steps with checks, finishing, no steps that aren't there, no sneaky paths), an assigned tutorial's checks graded, progress on My Games and the results, the files served.
- **`e2e/tutorials.editor.spec.ts`**:
  - **"Your First Game" done the whole way through**, as a student would: each Next locked until its check passes, a check failing with its reason first, the spotlight on the Sprites +, step 6's checks playing the game holding the arrow keys, finished, a reload carrying on, and the library saying Finished ✓.
  - Code can't be selected.
- **`e2e/tutorials.spec.ts`**: a teacher writes one and shares it with a class; the student does it and gets the XP; the teacher assigns a built-in one and sees "step 3 of 8".
- 19 new sabotage cases, each caught. Along the way:
  - **Flask didn't serve the built-in tutorials** (found by the account test; the editor-only tests' static host hid it).
  - The library crashed on a static host with no API.
  - Three cases were fixed: one sabotage didn't compile, one was aimed at the wrong check, and one check crashed instead of failing.

### Known issues and gaps

- Only **Your First Game** is played through end to end by a test. The other three's checks are all readable and their spotlights real, and Collect the Coins' first game check is the one 11a's test runs on the same maze. Playing each through once yourself is worth it.
- Spotlights point at what's on screen. If the part isn't open (a tab not chosen), there's no ring. The step's words still say where.
- A tutorial's step XP trusts the page (the checks run in the browser), like Check my work; the most a faked claim takes is 2 per step and 20 a tutorial.
- Tutorials can't hold questions yet (they can, as an assigned tutorial's notes are notes, but the step view shows only words and checks).

---

## Phase 11a — Notes, questions and tests ✅ (2026-10-26, reviewed)

Phase 11 is split like Phase 9: **11a** builds the Notes tab, questions and the check language; **11b** builds tutorials on them (library, strict steps, spotlights, authoring, assigning, the four starters). Agreed: the Notes tab is the tutorial panel, steps are strict, a tutorial is an assignment, and **tutorial code can't be copied**.

### Done

- **The Notes tab**, beside Console and Docs, on an assignment's game. The editor's layout is unchanged; the tab appears only when there are notes, and the editor opens on it.
  - Markdown, cut into slides at `---` lines (← 3 / 7 →, remembered per assignment).
  - Sanitised with DOMPurify: no forms, no inline style, links open in a new tab.
  - Pressing Play keeps the notes open, since a step and the game are meant to be read together. An error during a check goes to the Console without hiding the results.
  - **Code in notes can't be selected**: typing it is the exercise. It's a speed bump, not a lock, like PyIDE's live pane.
- **Questions**: PyIDE's ` ```quiz ` formats exactly (choice, short answer, blanks, match, long). `quiz.py` is copied unchanged from PyIDE, and the questions use PyIDE's tables.
  - One try, marked at once, part marks for blanks and matches.
  - **The answers never leave the server**: the student's editor gets the notes redacted. That's the one exit, and a leak check opens it, along with every other route a student has.
  - Long responses are cleaned when stored and when shown, and you mark them on the assignment's page.
  - XP as in PyIDE: points × 10 per question, plus a bonus for answering them all.
- **Tests**: a ` ```tests ` block in the notes, in GameIDE's **check language**:
  - Existence: `object Player exists`, `Player has sprite`, `Player has event step`.
  - Code: `Player.step uses keyboard_check` (or `avoids`), `room Level1 has 3 Coin`.
  - Running the game: `game runs 2 seconds without errors`, `after 1 second holding right, Player.x increased`, `after 2 seconds, <any Python>`.
  - Points per line, as in PyIDE.
  - **Check my work** plays the student's game in their own game pane, holding keys as the check says, and marks each line ✓ or ✗ with why. It's feedback, and pays a little XP once per test.
  - **Check all** on the assignment's page runs every turned-in version in a game hidden in your browser. That's the result that counts, at 10 XP a point. A check older than the student's last turn-in shows ⟳.
- **Grades** are your score plus the questions plus the checked tests (`backend/grades.py`, PyIDE's rule). The total is on the results page, on the student's class page, for quests, and sent by Classroom's Sync. With no points set, earning everything in the notes is full marks.
- **The assignment's page** has a notes editor with the students' view beside it, flags any check it can't read, and offers "Start from an example". It also has Questions, Tests and Total columns, and the long answers to mark.
- **`#/help/checks`** lists every question format and check. Its examples are tested to be ones GameIDE reads.

### Tests

```
cd frontend
npm test                      # Vitest: 208
npm run e2e                   # Playwright: 62 editor tests + 16 account tests (4 opt-in, skipped)
../backend/.venv/bin/python ../backend/tests/test_server.py   # 319 server checks
python3 scripts/sabotage.py   # 388 deliberate bugs
```

- **Questions and tests are read the same in Python and TypeScript.** `src/notes/parse-cases.json` is read by both Vitest and the server checks.
- **42 new server checks**, covering:
  - the leak checks
  - one try, marking, part marks, cleaning (also as stored), practice for the teacher, XP and the all-answered bonus
  - marking a long answer
  - a student's check keeps only the notes' tests at the notes' points, pays once, and counts for nothing
  - the teacher's check counts and pays once, only for turned-in work, and goes stale after a re-turn-in
  - totals on every page, and notes-only full marks.
- **12 new unit tests**: slides, notes split into pieces, every kind of check against a project, game checks against a fake game, and the help page's examples.
- **`e2e/notes.spec.ts`**:
  1. The teacher writes notes.
  2. The student opens on the Notes tab, can't select its code, answers the question, and presses Check my work, which plays the coins game holding keys: 5 ✓ and 1 ✗ with its reason.
  3. The student turns it in, and the teacher's Check all puts 6 / 7 and the total on the page.

  While writing it, the engine was right and the test wrong: holding left *does* move the player 4 pixels to the wall.
- 24 new sabotage cases, each caught. Three found weak checks:
  - a long answer cleaned only on the way out
  - a "prefix" case the test never had
  - one sabotage that didn't compile.

### After review: a favicon, and GameIDE's own name

- **GameIDE's mark** is a pixel cartridge with one of the badge creatures on its label, the cartridges of My Games and the badges in one picture. It's drawn once as a grid in `scripts/make_logo.py`, which writes the favicon (SVG, a 32px PNG, a phone icon) and the logo's cells.
  - It's on every page and on published games' play pages.
  - It's in HTML5 exports' file list, so an exported game carries it.
- **The name in the top bar** is the mark, "Game" in bold, and "IDE" as a green chip of code. That replaces microStudio's two-tone word.
- 1 e2e test and 1 server check; 2 sabotage cases, both caught.

### Known issues and gaps

- **PyIDE, WebIDE and FlaskIDE load DOMPurify 3.2.4** from the CDN, which has published XSS advisories (fixed in 3.4.17, which GameIDE uses). Worth updating there; I haven't touched them.
- A check plays the game for 10 seconds at most, and holds keys rather than clicking.
- Long responses are a plain box (paragraphs kept), without PyIDE's small formatting toolbar.
- Slide themes (`theme: chalkboard`) aren't in GameIDE's notes yet.

---

## Phase 10b — XP ✅ (2026-10-26, reviewed)

Agreed: XP now, then a Phase 11 that brings the notes tab, questions and tests along with the tutorials.

**One total per person, across all four editors.** GameIDE joins PyIDE's XP rather than copying it.
- The rules are `xp.py`, now byte-identical in four repos. Its header says so in all four, and PyIDE's CLAUDE.md does too.
- The rows are the shared tables: `xp_awards`, `shop_items`, `shop_requests`, `student_photos` and `class_events`.
- XP earned in GameIDE counts on a PyIDE leaderboard, and the other way round. Your token shop is the same shelf in every editor.

### Done

- **What earns XP in GameIDE:**
  - A **game that ran** for 5 seconds without an error earns `RUN_XP`, at most once per half hour of working time, and only when its code changed. This is PyIDE's rule:
    - Working time is now counted in GameIDE's idle check, as in PyIDE.
    - The page sends a hash of the code, never the code.
  - **Quests:** a "Quest reward" on an assignment pays once on full marks (a score reaching its points). Setting it pays everyone who already has full marks.
  - The **teacher's XP**: give or take with a reason, from the class's new **XP and tokens** page. You tick students, pick one of the programming-themed reasons or type your own. XP never goes below 0.
  - **Random events:** shown big for the projector and on the class's page for a day. Undo takes them back.
- **Students:**
  - An XP card at the top of Classes: avatar, level and title, progress bar, badges, tokens to spend, leaderboards (top five plus their own row) and open quests.
  - Their teacher's **token shop** with Ask buttons, and their requests.
  - "Hide me from the leaderboards".
  - **#/xp** lists every award, from every editor, with why.
  - XP from elsewhere **pops up** on any page, the editor included, and so does a run that paid.
  - **Avatars**: PyIDE's pictures, unlocked by level, or **their own photo once a teacher approves it**.
- **Teachers:**
  - The **XP and tokens** page per class: roster with XP, level and tokens, Use a token, requests to approve or decline, photos to approve or reject, and the event history with Undo.
  - **Token shop** (`#/shop`): your shelf, editable, with items taken off it rather than deleted.
  - Each class's page has its **leaderboard** (and an all-classes one once you have two classes) and marks quests.
- Leaderboards show first name and last initial, never an email.

### Tests

```
cd frontend
npm test                      # Vitest: 196
npm run e2e                   # Playwright: 62 editor tests + 15 account tests (4 opt-in, skipped)
../backend/.venv/bin/python ../backend/tests/test_server.py   # 277 server checks
python3 scripts/sabotage.py   # 364 deliberate bugs
```

- **57 new server checks**, covering:
  - run XP (not before the working time, not twice inside it, not for the same code, never for a teacher, working time counted as the student works)
  - the teacher's XP (reason shown, only their own class, never below 0)
  - one total with PyIDE's XP included
  - leaderboards (names only, hidden students off, closed to outsiders)
  - quests (short of full marks pays nothing, full marks once, setting the reward pays early finishers)
  - avatars (level locks)
  - photos (no one sees one until approved)
  - the shop (no asking past your tokens, only the class's teacher approves, approving spends, off-shelf items hidden)
  - events and Undo
  - every avatar's picture present.
- **`e2e/xp.spec.ts`**:
  - The teacher gives XP and it pops up for the student. The student picks an avatar, which shows on the leaderboard, asks for a shop item, and the teacher approves it. A random event shows big and on the class's page.
  - A game that runs is claimed for XP (the server's answer is stubbed: it pays only after half an hour of work). A game stopped at once isn't claimed.
- 25 new sabotage cases, each caught. Four found weak checks that passed for the wrong reason; all four were fixed:
  - a second run was refused because two awards shared a minute, not by the time check
  - the "runs aren't news" check never had a run in range
  - two editor sabotages didn't compile.

### Known issues and gaps

- PyIDE's **editor themes** for sale in the shop aren't offered here: they change PyIDE's editor only.
- XP for questions and tests arrives with Phase 11, as agreed.
- The badges are PyIDE's, including programming titles like "List Wrangler" (they're shared, so one set for all four).

---

## Phase 10 — Classrooms ✅ (2026-10-26, reviewed)

Built the way PyIDE's classes are, on the tables PyIDE made and shares (`classes`, `enrollments`, `class_items`, `assignments`, `submissions`, `classroom_links`, `classroom_posts`), every row carrying `app = "gameide"`. So there are no join codes: a class's students come from its Google Classroom roster, or are typed in by email.

### Done

- **Classes** (`#/classes`, a Classes button in the top bar when signed in).
  - A teacher makes one class per period: from a Google Classroom class (its students come with it), or by name, adding students by the email they sign in with.
  - A student sees the classes whose roster has their email. Only GameIDE's own classes are listed; never PyIDE's, WebIDE's or FlaskIDE's.
  - Google Classroom: Connect, bring a class in, Sync roster. This is PyIDE's connection, with its own token, since each editor connects separately. The token is encrypted with `SECRET_KEY`.
- **A class's page** (`#/class/<id>`).
  - The teacher sees its assignments in their own order (↑ ↓), group headings, and Hide/Show, Link, Edit starter, Copy to another class, Archive and Delete.
  - Below that: the roster, the class's **publishing switch** (auto-approve, moved here from Approvals) with links to Approvals and the class gallery, then Rename and Delete class.
  - A student sees the same page minus hidden and archived assignments, with Start/Open, the due date, whether they turned it in, their score, and new comments.
- **Assignments.**
  - New assignment: pick one of your games, plus title, points and due date. The **starter is a copy**, so you can keep changing your own game. It's kept off My Games and opened with Edit starter.
  - The link `/a/<slug>` gives each student **their own copy** the first time and the same game every time after. It's an ordinary game of theirs, on My Games too, and a game deleted by mistake comes back.
  - Hidden and archived assignments can't be started; a game already started still opens.
  - An assignment students turned in can't be deleted, only archived. Deleting a class archives its assignments.
- **Turning in.**
  - **Turn in** is in the editor's top bar, on assignment games only. It saves first, then freezes the game as it is: a version in History called "Turned in".
  - The student carries on; "Turn in again" appears once they change it.
- **The teacher's results** (`#/assignment/<slug>`).
  - Everyone on the roster: their game, when they last changed it, what they turned in and when (and how many times), a score box, and comments.
  - **Open and play** opens a student's game, or the version they turned in, **read only in the real editor**. The teacher can look at every event and press Play. Changes they try are never saved.
  - **Copy to demo** (also **Copy to my games** in the editor) is a copy of the student's game in the teacher's own games, to show the class.
  - Work never turned in can be scored too: that freezes it, so a score always points at what it was for.
- **Comments**: the teacher comments on a student's game, from the results or the editor, and the student replies from the editor's Comments button. New ones are counted on both sides.
- **Google Classroom grades**: **Post to Classroom** creates the coursework with the `/a/` link, the points and the due date (optionally as a draft). **Sync grades** sends scores as draft grades, naming any student it can't match.

### Tests

```
cd frontend
npm test                      # Vitest: 191
npm run e2e                   # Playwright: 62 editor tests + 13 account tests (4 opt-in, skipped)
../backend/.venv/bin/python ../backend/tests/test_server.py   # 220 server checks
python3 scripts/sabotage.py   # 337 deliberate bugs
```

- **96 new server checks**, most of them **who may see what**:
  - a class's page only to its teacher and roster
  - a student's game only to them and their assignment's teacher, read only (that teacher can't save over it or add files)
  - results, scores, Sync and duplicating only for the assignment's teacher
  - another editor's classes never.
- They also cover starters as copies, the same copy every time, frozen turn-ins, hidden and archived assignments, comments, and ordering.
- Classroom runs with Google replaced, so nothing reaches the network. The checks cover connect (a forged callback refused, the token encrypted), bringing in a class, roster sync (a student who left is dropped), posting (link, points, due date) and grade sync.
- **`e2e/classes.spec.ts`** covers the whole path in two browsers:
  1. The teacher makes a class, students and an assignment.
  2. The student starts it, renames it and turns it in, and the link opens the same game again.
  3. The teacher opens it read only, plays it, comments, scores and copies it to demo.
  4. The student sees the comment and the score, and replies.

  It also checks that an outsider can't open the class or start a hidden assignment.
- 27 new sabotage cases, each run and caught. Two found checks that **crashed instead of failing**; both were fixed.

### After review: GameIDE's own look, and a licence

- You confirmed that classes stay under **Classes** in the top bar and that Approvals stays its own page.
- **My Games** is GameIDE's own design now, not microStudio's:
  - games are cartridges on a shelf: the picture on the label, the name and "changed today" under it, and Export, Clone and Delete along the bottom
  - **New game** is the first slot
  - Import is a small button beside the title.
- **Each game gets its own picture**: a game with no "icon" sprite shows a pixel badge made from its id. It's mirrored like a sprite and has its own colour, and it's the same every visit. This replaces the one gamepad every card carried. `store/gameBadge.ts`, with 3 tests and 2 sabotage cases.
- **The home page's hero** is a little level: a pixel grid behind it, ground tiles along the bottom, the editor's screenshot tilted and lit, and a row of hopping badges over the headline (still for reduced motion).
- **MIT License** (`LICENSE`, `package.json`). README says the bundled libraries keep their own licences: Pyodide MPL 2.0, Blockly Apache 2.0, the fonts OFL / Ubuntu Font Licence.
- Tests now: Vitest 194, Playwright 71 (+4 opt-in), server 220, sabotage 339.

### Known issues and gaps

- ~~Your step: add the Classroom callback to the OAuth client~~ — done by the user, 2026-10-26.
- Classroom is tested against a fake Google, not yet the real one. It is PyIDE's code, which works with real Classroom.
- **Students find their classes under Classes in the top bar**, not under their name menu as in PyIDE. Say if you'd rather have them in the menu.
- Changing a due date after posting doesn't change it in Classroom; PyIDE can't do that either.
- An assignment posts to its own class's Classroom course only. One assignment per class, so that's the only one.
- Comments are on the whole game, not on a line or an object.
- Approvals stays its own page (reached from each class page) rather than a tab on it: it lists every student's game across classes, and an admin uses it too.
- PyIDE features beyond the spec aren't here: live lessons, questions in notes, XP, tests, attendance and the view-only class link.

---

## Phase 9c — Steam build kit ✅ (2026-10-26, reviewed)

As agreed: a build kit (one command on a computer with Node), achievements later.

### Done

- **Export → Steam (desktop)** downloads a kit: the game as an Electron desktop app, the way GDevelop makes Steam builds.
  - `npm install`, then `npm run steam`, makes `steam/windows`, `steam/mac` (on a Mac: one app for Intel and Apple silicon) and `steam/linux` (Steam Deck too). Each folder is what one Steam depot uploads.
  - `npm start` plays it right away, without building.
- **The app:**
  - It's the HTML5 player and the game, fully offline, in a window titled with the game's name.
  - It starts **full screen**; F11 switches. There's no menu bar, but Cmd+Q still quits on a Mac.
  - The game **starts by itself**: no Play button, since a desktop app may make sound from the start.
  - Save files stay on the player's computer between launches.
  - The game is served on its own `app://` scheme with the cross-origin isolation headers, so a stuck loop can still be stopped at its line, as in the editor. (file:// pages can't run the game's worker.)
- **The README** walks through building, then Steamworks: depots, launch options (the executable names are in a table), uploading with the web uploader or SteamCMD, and updating.
- Electron 44.7.0 and @electron/packager 20.3.0 are pinned, so a kit builds the same way later.
- The player learned `?autostart` (for the app); the HTML5 export and the kit share one list of the game's files.

### Tests

```
cd frontend
npm test                      # Vitest: 191
npm run e2e                   # Playwright: 62 editor tests + 11 account tests (4 opt-in, skipped)
../backend/.venv/bin/python ../backend/tests/test_server.py   # 124 server checks
python3 scripts/sabotage.py   # 310 deliberate bugs
```

- `e2e/steam.editor.spec.ts`: the kit's contents (the game, `main.js`, the pinned versions, the README), on every run.
- With `RUN_STEAM_KIT=1`, the same file installs the kit's Electron and **plays the exported game in the real desktop app**: it starts with no click, is cross-origin isolated, and is titled with the game's name. With `RUN_STEAM_BUILD=1` as well, it also runs `npm run steam` and checks the folders. Run both for this phase: the kit built Windows, Linux and a universal Mac app, and the **packaged** Mac app played the game.

### Known issues and gaps

- **Steam achievements** aren't in it yet (agreed: later, once a game is on Steam).
- The apps carry Electron's icon (Steam shows your store and library art). The README says how to set your own.
- The Mac app isn't signed by Apple. It runs from Steam; a downloaded copy needs right-click → Open.
- The apps are 300–400 MB on disk per platform (about 100 MB to download: Steam compresses). That's Electron, as for every Electron game on Steam. The game itself is about 20 MB of it.

---

## Phase 9b — HTML5 export and publishing ✅ (2026-10-26, reviewed)

### Done

- **Export → HTML5 game:** a .zip that plays on its own, on itch.io (upload it as an HTML project) or in any folder of any website.
  - Inside: the player page, its files, Pyodide, and the game: `game/project.json` plus its pictures, sounds and fonts.
  - The README says how to put it online, and how to try it on your own computer (`python3 -m http.server`; double-clicking index.html can't work).
  - **Export → Project** is the old .zip, for importing into GameIDE again.
- **One small player**, used by both the export and published games. A game starts on a click: browsers only allow sound after one, and it gives the game the keyboard. The editor's build now uses relative paths, so the player works from any folder.
- **Publish**, in the editor's top bar:
  - Choose a title, a description, the name shown (your first name by default, or one you choose; never an email), up to three kinds (platformer, puzzle…), whether others may remix it, and who can play it.
  - It saves to your account first, then publishes that as a **snapshot**: you keep working, and players see the new version only when you **Publish again**.
  - **Unpublish** takes the link down.
  - **The picture:** with the game running, "use what the game shows now" makes the picture Explore shows.
- **Who can play:**
  - **Anyone with the link:** signed out too.
  - **My class:** members of the class, its teacher and admins, after signing in. It's in the class's **gallery**. Only **GameIDE's own classes** count, the ones a teacher brings into GameIDE, as each editor has its own. A student's PyIDE or WebIDE class never shows up here (fixed after review: at first every editor's classes were listed).
  - **Everyone, on Explore:** a student's game waits for a teacher's approval first; the link works meanwhile. Publishing again puts it back in the queue, so an approved game can't be swapped for something else. A teacher's or admin's goes straight up, and a class can be set to approve by itself.
- **The play page** `/play/<id>`: the game, its title and author, plays (counted once per visit), likes, **Remix** (copies it into your games, crediting the original, if its author allows), **Report**, full screen, and **Install**, which adds it as an app with its own window and icon.
- **Explore** (on the front page): approved public games, Featured / Newest / Most played, search, and a filter by kind. Plus a gallery page for each of your classes.
- **Approvals** (teachers and admins, on the front page):
  - games waiting for Explore (Approve / Not for Explore);
  - reported games with their reasons (Take down, with a note the student sees, or Nothing wrong);
  - every game your students have published (take down or restore);
  - and each of your classes' auto-approve switch.
  - Admins see every game and can **Feature** games for Explore.
- **Admins** are `ADMIN_EMAILS`, an environment variable like `TEACHER_EMAILS`, so nobody can make themselves one.

**To do on Render:** add `ADMIN_EMAILS` (your email, comma-separated for more) to the service's environment. Until then nobody is an admin; teachers still approve their own students' games. The new tables are made on first start.

### Tests

```
cd frontend
npm test                      # Vitest: 191
npm run e2e                   # Playwright: 55 editor tests + 11 account tests
../backend/.venv/bin/python ../backend/tests/test_server.py   # 118 server checks
python3 scripts/sabotage.py   # 301 deliberate bugs
```

New:
- **Server checks (56 new)** for every publishing rule:
  - who may play unlisted, class and public games;
  - the gallery, the approval queue and who may approve;
  - republishing going back into the queue, auto-approve, and teachers skipping the queue;
  - snapshots, plays, likes, remixes with credit, and remixing refused;
  - reports, take-downs and restoring, featuring, unpublishing;
  - and no email anywhere on a play page.
- `e2e/publish.spec.ts`: the HTML5 export downloaded, unzipped and played from **another site, in a folder of its own**, with all of its own files loaded.
- `e2e/published.spec.ts`, against the real server:
  - a link played signed out, with its title and play count and no email;
  - a public game approved by an admin, then on Explore with its picture, then remixed;
  - a report, a take-down, and the note the student sees;
  - the install manifest.

### After review: the home page and My Games

The editor's layout stays exactly as it is. The pages around it changed:
- **The home page** (`#/`) is laid out like gdevelop.io, in GameIDE's fonts and colours: a big "Make your own game. Code it in real Python." with **Start your game now** and **Explore games**, a screenshot of the editor, games made with GameIDE (once there are some on Explore), the three ways to write a game (Python, blocks, event sheets, each with a screenshot), what GameIDE gives a game, how sharing works, and a last call to start. Everything it says is something GameIDE does now. The screenshots are of GameIDE itself, made by `e2e/home-images.editor.spec.ts` (`MAKE_HOME_IMAGES=1 npx playwright test home-images`).
- **My Games** (`#/games`) is laid out like microStudio's My Projects:
  - a big title, green **Create New Game** (opens the templates), blue **Import Game**, and a search box;
  - a card per game, with its name, its picture, a size pill, a pill saying how it's published, and blue **Export**, green **Clone**, red **Delete**.
  - The picture is the game's sprite named "icon", as in microStudio, or a pixel game controller.
- **A bar across the top** of every page but the editor: the GameIDE name, then Explore, Create and (for teachers and admins) Approvals, each an icon over a word as in microStudio.
- The editor's GameIDE link now goes back to My Games.

**Also fixed:** a sheet's `sound_play` (or `draw_set_font`) started with an empty name instead of one of the game's own sounds or fonts.

### After review: microStudio's look

The dark theme now follows microStudio's own stylesheets, read from its source (github.com/pmgl/microstudio):
- everything on one hue: a deep blue-teal gradient behind, steel blue for bars, tabs and whatever is selected;
- green for Play and other actions;
- a pastel colour for each kind of thing in the tree, with a matching bar beside what is open (scripts red, sprites yellow, tilesets green, objects cyan, rooms purple, sounds mint, fonts blue, settings pink);
- Source Sans and Ubuntu, bundled with the app so a school filter can't block them;
- code in Ubuntu Mono, in microStudio's Tomorrow Night Bright colours on black.

The light theme is unchanged.

### Known issues and gaps

- **GameIDE can't bring classes in yet.** That's Phase 10, done the way PyIDE does it. Until then there are no GameIDE classes, so "My class" is greyed out, there are no galleries, and teachers' Approvals lists are empty: only an admin can approve a student's game for Explore.
- **Installed games don't play offline.** I built offline play with a service worker, then found in tests (Chromium and real Chrome) that the game's worker loads Python past any service worker, so it was taken out rather than shipped half-working. Install gives an app window and icon; starting needs the internet. The Steam build (9c) packs everything locally, so it is offline by nature.
- **The HTML5 export holds every built file**, the editor's too (about 1 MB more zipped than the player needs). The game's worker is bundled out of sight of the build's file graph, so trimming the list risked a blank exported game.
- **The approval queue lives on its own page** for now; Phase 10's teacher dashboard will take it in.
- No comments on games, as the spec says for v1.

---

## Phase 9a — Sounds, gamepads, save files, fonts ✅ (2026-10-26, reviewed)

Phase 9 is in three parts, as agreed:
- **9a** (this): sounds, gamepads, save files and custom fonts.
- **9b:** HTML5 export and publishing, with the approval queue.
- **9c:** the Steam-ready desktop export.

### Done

- **A Sounds folder.**
  - Add a sound, then choose an MP3, OGG or WAV file (up to 8 MB, so a few minutes of music fits), or one of six **starter sounds**: coin, jump, hit, explosion, powerup, laser. They're made in code the 8-bit way, so no audio files live in the repo.
  - The sound editor plays it, shows its length and size, sets its volume, and has the Python to copy.
  - In Python: `sound_play("coin")` (with `loop=True` and `volume=`), `sound_stop("coin")` or `sound_stop()` for every sound, `sound_playing("coin")`, `music_play("theme")` (one music at a time: it replaces any playing) and `music_stop()`.
- **How sound works:** browsers give a worker no audio, so Python sends orders with each frame and the page plays them with Web Audio. Each sound is measured when the game starts, so `sound_playing` is worked out in Python from its length; nothing waits on the page. Stop, Restart and `game_restart()` silence everything.
- **Gamepads, up to four:**
  - `gamepad_check("a")`, `gamepad_check_pressed`, `gamepad_check_released` (buttons named as on an Xbox pad: a, b, x, y, lb, rb, lt, rt, select, start, ls, rs, up, down, left, right, home).
  - `gamepad_axis("left_x")`, from -1 to 1, with a dead zone so a worn stick rests at 0.
  - `gamepad_connected()`.
  - The page polls the pads while the game runs. A press between two steps still counts as pressed for one step, as keys do.
- **Save files:** `save_set("best", score)`, `save_get("best", 0)`, `save_delete`, `save_clear`.
  - They keep numbers, text, True/False, lists and dicts between plays, in the player's browser.
  - Values are copied in and out, so changing a list after saving it doesn't change the save. The limit is about 1 MB, and the error says so.
  - **Game settings** shows what the game has saved here, and **Clear saved data** resets it, for testing "first time playing".
- **A Fonts folder:** TTF, OTF, WOFF or WOFF2 files, previewed at four sizes with your own sample text. `draw_set_font("pixel", 24)` sets the font and size for `draw_text`; `draw_set_font()` goes back to the built-in font.
- **Everywhere at once:** the new functions are in the catalog, so they're in autocomplete and the docs, the blocks palette (new **Sound** and **Saving** categories, with pickers for sounds, fonts, gamepad buttons and sticks), and the event sheet pickers.
- **The templates use sound:** Collect the coins plays "coin"; the Platformer plays "jump", "coin" and "hit".
- **The server** accepts sounds and fonts, judged by their first bytes like pictures, with an 8 MB limit for a sound and 2 MB for a picture or font. The page applies the same checks before saving, so a file it accepts is never refused later.

The project format is now **version 8** (Sounds and Fonts folders). Older projects load unchanged.

### After review: names in quotes

`room_goto(Level2)` gave only Python's "name 'Level2' is not defined". Objects are Python names (each is a class) but rooms, sprites, sounds and fonts are text, and students mix them up. Such an error now adds what the name is and how to write it: *Level2 is a room. A room is named in quotes, as text: "Level2" — for example room_goto("Level2").*

### Found along the way

- **A font that failed to load was drawn in the browser's default font**, though its warning said "the built-in font". The renderer now uses a game font only if it really loaded, and the built-in font otherwise. The sabotage run found this: the font test passed even with fonts never loaded, because the fallback still looked different.
- **The docs pane had its own list of categories**, so new functions would have quietly gone missing from it. The docs, the blocks palette and the sheet pickers are now each checked against one list in the catalog.

### Tests

```
cd frontend
npm test                      # Vitest: 191
npm run e2e                   # Playwright: 54 editor tests + 7 account tests
../backend/.venv/bin/python ../backend/tests/test_server.py   # 62 server checks
python3 scripts/sabotage.py   # 277 deliberate bugs
```

New:
- `src/python/media.test.ts`, in the real Pyodide:
  - sound orders, `sound_playing` from length, music, and restart silencing;
  - gamepad held/pressed/released, taps, sticks and pad numbers, and the dead zone;
  - save values handed in, sent out only when changed, copied, refusing what JSON can't hold, and the 1 MB limit;
  - fonts in text commands;
  - starter sounds being real WAVs, file sniffing, and sounds and fonts in the built game and the project's assets.
- `e2e/media.spec.ts`:
  - a starter sound really starting through Web Audio;
  - a fake file turned away;
  - a pretend gamepad moving the player;
  - save data surviving a reload, then cleared;
  - a font file drawing differently from the built-in font (compared by screenshot, so a font that never reached the game would fail).
- Server checks for WAV, MP3, OGG and OTF uploads, a 3 MB sound accepted where a 3 MB picture isn't, and non-media refused.

### Known issues and gaps

- **No sound editing** (trimming, effects). Choose a finished file, or a starter sound.
- **Fonts aren't checked as fonts on the server** beyond their first bytes. A damaged font is skipped with a warning when the game starts and the text uses the built-in font.
- Sounds are decoded when Play is pressed, so a game with many long sounds takes a moment longer to start. Decoded sounds are kept between plays.

---

## Phase 8 — Event sheets ✅ (2026-10-26, reviewed)

As agreed: per-event sheets, explicit for-each instead of GDevelop's hidden picking, typed Python boxes, and sheets for creation code but not scripts.

### Done

- **An Event Sheet tab for every event**, and for creation code (in the same dialog as its blocks). The sheet is one method's body, so its subject is `self`; objects, inheritance, collision events with `other`, alarms and scripts all stay as they are.
- **Rows of conditions → actions.** Conditions are on the left, actions on the right, as in GDevelop.
  - A row with no conditions just runs its actions.
  - A row's conditions are all needed (`and`), or click **all (and)** to make any one enough (`or`).
  - **not** turns a condition around.
  - From a row's ⋯ menu: **sub-events** (nested `if`s), **Else** after a row (with conditions it's `elif`), **For each** inside, comments, move up/down, delete.
  - **Drag and drop** (added after review): drag a row by its ⋮⋮ grip, and its sub-events come with it. Drop on the top of another row to put it before, the bottom for after, the middle to make it a sub-event, or below the last row for the end of the sheet. A line or a dashed outline shows where it will land. A row can't go into its own sub-events, nothing goes inside a comment, and a drag is one undo step.
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
npm test                      # Vitest: 177
npm run e2e                   # Playwright: 49 editor tests + 7 account tests
../backend/.venv/bin/python ../backend/tests/test_server.py   # 53 server checks
python3 scripts/sabotage.py   # 248 deliberate bugs
```

New this phase:
- `src/eventsheets/sheet.test.ts`: the exact Python for and/or/not, no-condition rows, sub-events, else/elif, for-each, comments and Trigger once; the line map; the checks on what's typed; every catalog condition and action compiling in real Python with the arguments its boxes start with; Trigger once firing once and again after resetting, in a real game; renaming; moving rows (before, after, inside, to the end; never into themselves or a comment).
- `e2e/sheets.spec.ts`: dragging rows by their grips; building a sheet with the pickers and playing it with the keyboard; name suggestions inside quotes; nesting, else, for-each and comments; a bad box marked; the Python/Sheet rules and Convert; an error outlining its action; Ctrl+Z on and off the sheet; creation code as a sheet, renamed.

### Known issues and gaps

- **Scripts can't be sheets**, as agreed. A script is function definitions, which aren't conditions → actions.
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
| 10 Classrooms | classes, assignments, dashboard | PyIDE's classes and Classroom instead of join codes |
| 11 Tutorials | tutorial panel, checks, library | |
| ~~12 Retro mode~~ | — | **Dropped 2026-10-26**: worries about copyright around console formats, and doubt students would use it |

## Next: nothing planned

Every phase in the spec is built (1–11, with 9 and 11 in parts). Retro mode was dropped.

## Phase 11 — Tutorials, with the notes tab, questions and tests (the plan; built as 11a and 11b above)

Agreed 2026-10-26: a **Notes** tab beside Console and Docs (the editor's layout unchanged) showing an assignment's markdown and slides, questions in PyIDE's format, and game-shaped tests ("Player has a Step event", "uses keyboard_check", "after setup there are 15 Coins") with Check my work and Check all — built with the tutorials, which need the same panel and step checks.

(Phase 9's parts are below; the old plan for all of Phase 9 follows them.)

## Phase 9 — Sounds, export, publishing (the plan)

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
   other Draw-event drawing, whatever order they were called in. (The
   rest stacks in call order since 2026-10-28; before that, texts and
   sprites landed over or under all of a depth's shapes by chance.)
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

