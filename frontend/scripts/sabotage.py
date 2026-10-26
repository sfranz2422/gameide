"""
The house rule, made repeatable: every check must have been watched to fail.

Each case below breaks one thing a test guards (a one-line edit to the
source), runs only the test that should notice, confirms it FAILS, and puts
the source back. Run it after changing a test or the code it guards:

    python3 scripts/sabotage.py                 # every case
    python3 scripts/sabotage.py "gravity sign"  # just these

A sabotage must still compile — strict TypeScript refuses an unused
variable, and a build that fails runs no test and proves nothing (it prints
"no test matched"). Break behaviour, not syntax.

"pattern found 0 times" means the code moved on and the case needs its
`old` text updated — not that the test is fine. A case that prints MISS is a
test that would let that bug through.

The source is always restored, even on Ctrl-C (try/finally), but check
`git status` if the run was killed hard.
"""
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
RT, EN, IN, BR = "src/python/runtime.py", "src/engine/engine.ts", "src/engine/input.ts", "src/python/bridge.ts"
CG, PJ, HOST, UP = "src/python/codegen.ts", "src/store/project.ts", "src/editor/gameHost.ts", "src/editor/useProject.ts"
E2E = "e2e"  # a sixth item: run the Playwright test of that name instead of Vitest
PY = "py"    # …or the server's checks (backend/tests/test_server.py); caught = that check prints FAIL
APP = "../backend/app.py"
RO, RE = "src/editor/rooms/roomOps.ts", "src/editor/rooms/RoomEditor.tsx"
SP, TO = "src/engine/sprites.ts", "src/editor/tiles/tileOps.ts"
HI = "src/editor/history.ts"
CB, PB, TB = "src/blocks/catalogBlocks.ts", "src/blocks/python.ts", "src/blocks/toolbox.ts"
BE, OE = "src/blocks/BlocksEditor.tsx", "src/editor/ObjectEditor.tsx"
SH, SE, EB = "src/eventsheets/sheet.ts", "src/eventsheets/SheetEditor.tsx", "src/eventsheets/ExprBox.tsx"
GH, SND, AT = "src/editor/gameHost.ts", "src/editor/sound.ts", "src/store/assetTypes.ts"
GS = "../backend/gamestore.py"
PUB, PA, PD = "../backend/publishing.py", "src/player/PlayerApp.tsx", "src/editor/PublishDialog.tsx"
CM, BS = "src/editor/codeMode.tsx", "src/blocks/blockState.ts"
CL, UPJ, EP = "../backend/classes.py", "src/editor/useProject.ts", "src/editor/EditorPage.tsx"
RW, XPP, RX = "../backend/rewards.py", "src/xp/XpPages.tsx", "src/xp/runXp.ts"
NT, GR, QZ, CK = "../backend/notes.py", "../backend/grades.py", "src/notes/quiz.ts", "src/checks/checks.ts"
TU, TUP, TP = "../backend/tutorials.py", "src/tutorials/tutorial.ts", "src/tutorials/TutorialPane.tsx"
FX, FEEL, BRG = "src/engine/effects.ts", "src/engine/render/feel.ts", "src/python/bridge.ts"
PXR = "src/engine/render/pixiRenderer.ts"
CASES = [
 ("layout drift", RT, '"x": boxy(F.X)', '"x": boxy(F.Y)', "every built-in property"),
 ("no polar sync", RT, "            _st[b + i] = v\n            set_polar(b)", "            _st[b + i] = v", "two views of one motion"),
 ("gravity sign", EN, "v -= Math.sin(gd) * grav;", "v += Math.sin(gd) * grav;", "speed, gravity and friction"),
 ("friction reverses", EN, "const k = Math.max(0, sp - fr) / sp;", "const k = (sp - fr) / sp;", "speed, gravity and friction"),
 ("input after step", RT, "        _input_events()\n        _call_all(_lists[\"on_step\"], \"on_step\")", "        _call_all(_lists[\"on_step\"], \"on_step\")\n        _input_events()", "GameMaker's order"),
 ("alarm late", EN, "if (v <= 1) {", "if (v < 1) {", "third step"),
 ("no parent walk", RT, "                p = objects[cur].get(\"parent\")\n                cur = _type_index.get(p) if p else None", "                cur = None", "parent's collision"),
 ("no solid revert", RT, "            if other.solid:\n                o.x = o.xprevious", "            if False:\n                o.x = o.xprevious", "solid instance puts"),
 ("outside every step", EN, "outside && !st[b + F.OUTSIDE])", "outside)", "outside room fires once"),
 ("no anim end", EN, "this.pushEvent(events, EV.ANIMATION_END, s, 0);", ";", "animation end"),
 ("tap lost", IN, "keys[KEY_COUNT + i] = this.pressed[i]!;", "keys[KEY_COUNT + i] = this.held[i]!;", "tapped between"),
 ("no instance mouse", EN, "this.pushEvent(events, EV.MOUSE, c, edge.button * 2 + (edge.released ? 1 : 0));", ";", "clicking an instance"),
 ("draw_self no-op", RT, "            _st[self._b + _F_DRAWN] = 1.0", "            pass", "drawn only by draw_self"),
 ("no dirty on move", RT, "            if not _st[b + _F_DIRTY]:\n                _mark_dirty(self._slot, b)\n        return property(get, set_)", "        return property(get, set_)", "moved earlier in the same step"),
 ("no pixel stepping", EN, "        pos += sign * stepSize;\n        remaining -= stepSize;", "        break;", "flush against a wall"),
 ("nearest includes self", EN, "if (s === exclude || !this.matches(st, s, t)) continue;", "if (!this.matches(st, s, t)) continue;", "instance_nearest"),
 ("no ghosts", RT, "        o.__class__ = _ghost(type(o))\n", "", "keeps reading its own values"),
 ("no rebind on grow", RT, "    _capacity = cap\n    _js.rebind()", "    _capacity = cap", "arrays grow"),
 ("no fresh views", EN, "if (this.views.st.length === 0) this.views = this.acquire();", "", "memory grows"),
 ("persistent killed", RT, "if o._alive and not _types[o._t].persistent:", "if o._alive:", "persistent instances"),
 ("runtime frames shown", RT, "frames = [f for f in traceback.extract_tb(e.__traceback__) if _student_frame(f.filename)]", "frames = list(traceback.extract_tb(e.__traceback__))", "names the object, the event"),
 ("script called object", RT, 'kind, _, obj = where[1:-1].partition(" ")', 'kind, _, obj = where[1:-1].partition(" "); kind = "object"', "was the script"),
 ("warn every time", RT, "    if message not in _warned:\n        _warned.add(message)\n        _warnings.append(message)", "    _warnings.append(message)", "warned about, once"),
 ("no suggestion", RT, "    close = difflib.get_close_matches(word, list(choices), n=1)", "    close = []", "says what was meant"),
 ("slow getters", RT, "        def get(self):\n            return _st[self._b + i]\n\n        def set_(self, v):\n            b = self._b\n            _st[b + i] = v\n            if not", "        def get(self):\n            sum(range(3000))\n            return _st[self._b + i]\n\n        def set_(self, v):\n            b = self._b\n            _st[b + i] = v\n            if not", "frame's budget"),
 ("param renamed", RT, "def draw_text(x, y, text):\n    if _check_draw(\"draw_text\"):\n        _draw_list.append([\"text\", _draw_depth, x, y, str(text), _color, _font, _font_size, _alpha])", "def draw_text(x, y, txt):\n    if _check_draw(\"draw_text\"):\n        _draw_list.append([\"text\", _draw_depth, x, y, str(txt), _color, _font, _font_size, _alpha])", "matches runtime.py"),
 ("undocumented function", RT, '    "show_debug",\n]', '    "show_debug", "point_distance2",\n]\npoint_distance2 = lambda a, b: 0', "matches runtime.py"),
 ("default differs", RT, 'def mouse_check(button="left"):', 'def mouse_check(button="right"):', "matches runtime.py"),
 ("property undocumented", "src/catalog/api.ts", '  { name: "depth", description: "Lower depth draws on top." },\n', "", "only properties"),
 ("far edge inclusive", "src/engine/spatialHash.ts", "    const cx1 = Math.max(cx0, Math.ceil(right / cs) - 1);\n    const cy1 = Math.max(cy0, Math.ceil(bottom / cs) - 1);\n    const r = this.ranges;", "    const cx1 = Math.floor(right / cs);\n    const cy1 = Math.floor(bottom / cs);\n    const r = this.ranges;", "far edge as exclusive"),
 ("duplicates", "src/engine/spatialHash.ts", "          if (stamps[s] === stamp) continue;", "", "once per query"),
 ("remove leaves it", "src/engine/spatialHash.ts", "          bucket[i] = bucket[bucket.length - 1]!;\n          bucket.pop();", "", "moves and removes"),
 ("no mirror swap", "src/engine/sprites.ts", "    out.left = x + Math.min(l, r);\n    out.right = x + Math.max(l, r);", "    out.left = x + l;\n    out.right = x + r;", "mirror when the scale"),
 ("edges touch", "src/engine/sprites.ts", "return a.left < b.right && b.left < a.right", "return a.left <= b.right && b.left <= a.right", "share an edge"),
 ("repeat is a press", IN, "    if (!this.held[code]) this.pressed[code] = 1;", "    this.pressed[code] = 1;", "reports the press once"),
 ("no any", IN, "    keys[0] = any;", "    keys[0] = 0;", "while any key"),
 ("blur keeps mouse", IN, "    for (let b = 0; b < 3; b++) if (this.mouseHeld[b]) this.mouseUp(b);", "", "loses focus"),
 # Phase 2: code generation and error mapping
 ("tabs kept", CG, r'const detab = (line: string) => line.replace(/^\t+/, (tabs) => "    ".repeat(tabs.length));', "const detab = (line: string) => line;", "tabs at the start"),
 ("no pass for comments", CG, '    if (!hasCode(body)) lines.push("        pass");', '    if (!body.length) lines.push("        pass");', "only comments"),
 ("children first", CG, "    if (parent) visit(parent, path);\n", "", "children come after parents"),
 ("map off by one", CG, "    spans.push({ eventId: ev.id, label: eventLabel(project, ev.key), defLine, firstLine: defLine + 1, lineCount: body.length });", "    spans.push({ eventId: ev.id, label: eventLabel(project, ev.key), defLine, firstLine: defLine, lineCount: body.length });", "third event, line 2"),
 ("traceback not rewritten", CG, '  const traceback = e.traceback.replace(', '  const traceback = e.traceback; void (', "third event, line 2"),
 ("script not targeted", CG, "    if (script) target = { kind: \"script\", scriptId: script.id, line: e.line ?? 1 };", "", "inside a script"),
 ("def line unmapped", CG, "    if (line === s.defLine) return { span: s, bodyLine: 1 };", "", "def line and an empty event"),
 # project operations
 ("case-sensitive names", PJ, "  const clash = list.find((r) => r.id !== renaming && r.name.toLowerCase() === lower);", "  const clash = list.find((r) => r.id !== renaming && r.name === name);", "objects must be Python names"),
 ("orphans kept", PJ, "      o.events = o.events.filter((e) => !(e.key.type === \"collision\" && e.key.object === id));", "", "takes its room instances"),
 ("loop allowed", PJ, "    if (cur === child || seen.has(cur)) return true;", "    if (seen.has(cur)) return true;", "would make a loop"),
 ("unquoted replaced", PJ, "  const re = new RegExp(`([\"'])${from.replace(/[.*+?^${}()|[\\]\\\\]/g, \"\\\\$&\")}\\\\1`, \"g\");", "  const re = new RegExp(`()${from}()`, \"g\");", "in quotes only"),
 ("commas ignored", "src/editor/code/pythonHelp.ts", "    } else if (c === \",\" && depth === 0) commas++;", "    }", "counting commas"),
 # Phase 2: the editor, in the browser
 ("no interrupt", HOST, "      this.interrupt[0] = 2; // SIGINT: Pyodide raises KeyboardInterrupt", "      this.interrupt[0] = 0;", "stopped at its line", E2E),
 ("never killed", HOST, "    if (!this.interrupt || now - this.interruptedAt > KILL_MS) this.kill();", "    if (now < 0) this.kill();", "freeze the page", E2E),
 ("no close backup", UP, "          if (p) localStorage.setItem(backupKey(p.id), JSON.stringify(p));", "          if (p && p.id === \"never\") localStorage.setItem(backupKey(p.id), JSON.stringify(p));", "just before the page closes", E2E),
 ("error not followed", "src/editor/EditorPage.tsx", "        setFocus({ eventId: t.eventId, line: t.line, nonce: Date.now() });", "        setFocus(null);", "clicking it goes there", E2E),
 ("rename leaves quotes", "src/editor/ResourceTree.tsx", "                            if (alsoCode) replaceQuoted(p, r.name, name);", "                            if (alsoCode && name === \"\\u0000\") replaceQuoted(p, r.name, name);", "update its name in quotes", E2E),
 ("no project names", "src/editor/code/CodeEditor.tsx", "completionSource(() => namesRef.current?.() ?? { objects: [], sprites: [], rooms: [] })", "completionSource(() => ({ objects: [], sprites: [], rooms: [] }))", "object names inside the quotes", E2E),
 # Both guards gone at once: either one alone keeps the cursor where it is typed.
 ("jump on every render", "src/editor/code/CodeEditor.tsx",
  "    if (!v || !err || usedJumps.has(err.nonce)) return;\n    usedJumps.add(err.nonce);",
  "    if (!v || !err || usedJumps.size < 0) return;", "clicking it goes there", E2E,
  ("  }, [err?.nonce]);", "  }, [err]);")),
 # Phase 3: the server (backend/tests/test_server.py)
 ("anyone reads any project", APP, "    if not classes.can_read(db, user, p):", "    if False:", "someone else's project can't be read", PY),
 ("id hijack", APP, "            if p.owner_id != user.id:\n                # The id is someone else's", "            if False:\n                # The id is someone else's", "its id is taken", PY),
 ("replaced not kept", APP, '                _snapshot(db, p, "replaced", "Replaced by a save from another tab or computer")\n', "", "what it replaced is kept", PY),
 ("not unpacked", APP, '        if isinstance(data, dict) and set(data) == {"_packed"}:', "        if False:", "a packed body", PY),
 ("any file is a picture", "../backend/gamestore.py", "    return (kind, MAX_SOUND_BYTES) if kind else (None, 0)", '    return (kind, MAX_SOUND_BYTES) if kind else ("image/png", MAX_ASSET_BYTES)', "isn't a picture is refused", PY),
 ("asset overwritten", APP, '            return jsonify(ok=True) if existing.data == data else err("That asset id is already used.", 409)', "            return jsonify(ok=True)", "different bytes can't take", PY),
 ("no project size limit", APP, "        if size > gamestore.MAX_PROJECT_BYTES:", "        if size > gamestore.MAX_PROJECT_BYTES * 100:", "over the limit is refused, with the sizes", PY),
 ("never pruned", APP, "        if old:\n            db.query(GameVersion)", "        if old and False:\n            db.query(GameVersion)", "pruned to the newest", PY),
 ("snapshot every save", APP, "                if last_auto is None or (", "                if True or (", "within the interval", PY),
 ("restore not undoable", APP, '        _snapshot(db, p, "restore", f"Before going back', '        0 and _snapshot(db, p, "restore", f"Before going back', "keeps what was there before the restore", PY),
 ("polls count", APP, '    return not (request.method == "GET" and request.path.startswith("/api/"))', "    return True", "polling (a GET to /api/) is not activity", PY),
 ("teachers idle out", APP, '    if not uid or session.get("teacher"):', "    if not uid:", "a teacher is never signed out", PY),
 ("dev login on server", APP, 'DEV_LOGIN = os.environ.get("GAMEIDE_DEV_LOGIN") == "1" and not os.environ.get("DATABASE_URL")', 'DEV_LOGIN = os.environ.get("GAMEIDE_DEV_LOGIN") == "1"', "dev sign-in is off", PY),
 ("open redirect", APP, '    return nxt if nxt.startswith("/") and not nxt.startswith("//") else ""', '    return nxt if nxt.startswith("/") else ""', "never redirects off the site", PY),
 ("not isolated", APP, "        response.headers.setdefault(k, v)", "        pass", "cross-origin isolated", PY),
 ("deleted still listed", APP, "        rows = [p for p in (db.query(GameProject).filter_by(owner_id=user.id).filter(GameProject.deleted_at.is_(None))", "        rows = [p for p in (db.query(GameProject).filter_by(owner_id=user.id)", "a deleted project leaves the list", PY),
 # Phase 3: the editor's side
 ("tab speaks for the browser", "src/store/cloudStore.ts", "          json: { data: project, base: this.bases.get(id) ?? meta.base },", "          json: { data: project, base: meta.base },", "two tabs editing one game", E2E),
 ("offline is an error", "src/store/cloudStore.ts", '      if (e instanceof OfflineError) return { state: "offline" };', '      if (e instanceof OfflineError) return { state: "error", message: "offline" };', "edits made offline", E2E),
 ("never retried", "src/store/cloudStore.ts", "    for (const p of await this.cache.list()) {\n      const m = await this.meta(p.id);\n      if (m.dirty || m.pending.length) void this.sync(p.id);", "    for (const p of await this.cache.list()) {\n      const m = await this.meta(p.id);\n      if (m.dirty && p.id === \"never\") void this.sync(p.id);", "edits made offline", E2E),
 ("moved but kept", "src/editor/ProjectsPage.tsx", "      await browser.remove(summary.id);", "      await browser.list();", "moved into the account", E2E),
 ("restore not shown", "src/editor/AccountBits.tsx", "                      replace(await store.restoreVersion!(project.id, v.id));", "                      void (await store.restoreVersion!(project.id, v.id)), replace;", "History keeps versions", E2E),
 ("bodies not packed", "src/store/api.ts", "      body: opts.json !== undefined ? packed(opts.json) : opts.body,", "      body: opts.json !== undefined ? JSON.stringify(opts.json) : opts.body,", "opens on another computer", E2E),
 ("pictures never uploaded", "src/store/cloudStore.ts", "        if (blob) await api(`/api/projects/", "        if (blob && !blob) await api(`/api/projects/", "picture added in the editor reaches", E2E),
 ("import overwrites", "src/store/zip.ts", "  project.id = newId();", "  project.id = project.id || newId();", "round-trips a project"),
 ("no folder prefix", "src/store/zip.ts", '  const prefix = Object.keys(entries).find((k) => k.endsWith("project.json"))?.slice(0, -"project.json".length);', '  const prefix = "project.json" in entries ? "" : undefined;', "inside a folder"),
 # Phase 4: masks and sprites
 ("turned the wrong way", "src/engine/sprites.ts", "    const c = Math.cos(angle * DEG), sn = Math.sin(angle * DEG);\n    const rx", "    const c = Math.cos(-angle * DEG), sn = Math.sin(-angle * DEG);\n    const rx", "where the sprite is drawn"),
 ("box ignores angle", "src/engine/sprites.ts", "  if (angle % 360 === 0) {\n    // A negative scale", "  if (angle === angle) {\n    // A negative scale", "turn with the instance"),
 ("no separating axes", "src/engine/sprites.ts", "    if (!turnedA && !turnedB) return true; // the boxes are the masks", "    if (turnedA || !turnedA) return true; // the boxes are the masks", "collide by their shapes"),
 ("touching overlaps", "src/engine/sprites.ts", "  return maxA <= minB + 1e-9 || maxB <= minA + 1e-9;", "  return maxA < minB - 1e-9 || maxB < minA - 1e-9;", "only touch along an edge"),
 ("circles are boxes", "src/engine/sprites.ts", "    return ex * ex + ey * ey < s.r * s.r;", "    return ex * ex + ey * ey < 4 * s.r * s.r;", "misses a box's corner"),
 ("first frame only", "src/engine/sprites.ts", "  const f = ((Math.floor(st[b + F.IMAGE_INDEX]!) % frames.length) + frames.length) % frames.length;", "  const f = 0;", "frame being shown"),
 ("slivers skipped", "src/engine/sprites.ts", "  const nx = Math.max(1, Math.ceil(w / step)), ny = Math.max(1, Math.ceil(h / step));", "  const nx = Math.floor(w / step), ny = Math.floor(h / step);", "sliver of overlap"),
 # Doubly guarded (normalise, then the branch), so both go at once.
 ("old masks are circles", "src/engine/sprites.ts", '  if (m.kind === "circle") {\n    info.kind = SHAPE.CIRCLE;', '  if (m.kind !== "rect" && m.kind !== "precise") {\n    info.kind = SHAPE.CIRCLE;', "saved before masks had kinds", "vitest",
  ('  if (!m.kind) return { ...(m as object), kind: "rect" } as MaskShape;\n', "")),
 ("fps ignored", "src/engine/sprites.ts", "    framesPerStep: (def.fps ?? stepsPerSecond) / stepsPerSecond,", "    framesPerStep: stepsPerSecond / stepsPerSecond,", "own speed sets how fast"),
 ("events by box", EN, "            if (masksOverlap(st, s, st[b + F.X]!, st[b + F.Y]!, c, cx, cy, this.sprites, scratch, scratch2))", "            if (cx === cx)", "collision events use the shapes"),
 ("queries by box", EN, "      if (!masksOverlap(st, self, x, y, c, cx, cy, this.sprites, scratch, scratch2)) return false;\n      found = c;", "      if (!masksOverlap(st, self, x, y, c, cx, cy, this.sprites, scratch, scratch2) && false) return false;\n      found = c;", "only where the picture is drawn"),
 ("spacing ignored", "src/store/imageTools.ts", "  const stepX = fw + Math.max(0, p.spacingX), stepY = fh + Math.max(0, p.spacingY);", "  const stepX = fw, stepY = fh;", "offset and spacing"),
 ("half frames kept", "src/store/imageTools.ts", "  const fitCols = Math.floor((imageWidth - p.offsetX + Math.max(0, p.spacingX)) / stepX);", "  const fitCols = Math.ceil((imageWidth - p.offsetX + Math.max(0, p.spacingX)) / stepX);", "offset and spacing"),
 ("faint pixels count", "src/store/imageTools.ts", "export const SOLID_ALPHA = 128;", "export const SOLID_ALPHA = 1;", "faint pixels"),
 ("auto reaches engine", CG, '  return { kind: m.kind === "precise" ? "precise" : "rect", left, top, right, bottom };', "  return { kind: m.kind as \"rect\", left, top, right, bottom };", "carry their speed"),
 ("hand masks refitted", "src/store/spriteOps.ts", '  if (kind !== "auto" && kind !== "precise") return mask;', '  if (kind === "circle" && kind !== "circle") return mask;', "stays as they made it"),
 ("no pixels in the worker", "src/python/spritePrep.ts", '    if (mask?.kind === "precise" && s.images.length) {', '    if (mask?.kind === "precise" && s.images.length < 0) {', "hole in a ring", E2E),
 ("drops ignored", "src/editor/EditorPage.tsx", "      if (f) void startImport(f);\n      else addLines", "      if (f && !f) void startImport(f);\n      else if (!f) addLines", "dropped on the editor", E2E),
 ("frames not skippable", "src/editor/sprites/SpriteImport.tsx", "      if (n.has(i)) n.delete(i);\n      else n.add(i);", "      void n;", "dropped on the editor", E2E),
 ("any size appended", "src/editor/sprites/SpriteImport.tsx", "  const wrongSize = appendTo && (fw !== appendTo.width || fh !== appendTo.height);", "  const wrongSize = appendTo && fw < 0;", "must be its size", E2E),
 ("drag doesn't draw", "src/editor/sprites/SpriteEditor.tsx", '    if (right > left && bottom > top) set((s) => void (s.mask = { kind: "rect", left, top, right, bottom }));', '    if (right > left && bottom < top) set((s) => void (s.mask = { kind: "rect", left, top, right, bottom }));', "drawn by hand", E2E),
 # Phase 5: rooms and the camera
 ("snap rounds", RO, "  return grid > 0 ? Math.floor(v / grid + 1e-6) * grid : Math.round(v);", "  return grid > 0 ? Math.round(v / grid) * grid : Math.round(v);", "snaps to grid lines"),
 ("snap noise", RO, "  return grid > 0 ? Math.floor(v / grid + 1e-6) * grid : Math.round(v);", "  return grid > 0 ? Math.floor(v / grid) * grid : Math.round(v);", "snaps to grid lines"),
 ("unrotated hit test", RO, "  const c = Math.cos(inst.angle * DEG), s = Math.sin(inst.angle * DEG);\n  const dx", "  const c = 1, s = 0;\n  const dx", "turned and scaled as the game draws"),
 ("locked clickable", RO, '  return new Set(room.layers.filter((l) => l.kind === "instances" && l.visible && !l.locked).map((l) => l.id));', '  return new Set(room.layers.filter((l) => l.kind === "instances" && l.visible).map((l) => l.id));', "never a hidden or locked layer"),
 ("bottom one clicked", RO, "  for (let i = order.length - 1; i >= 0; i--) {", "  for (let i = 0; i < order.length; i++) {", "clicks the one drawn on top"),
 ("box catches touching", RO, "corners(inst, spriteFor(project, inst)).every(", "corners(inst, spriteFor(project, inst)).some(", "wholly inside"),
 ("paste keeps old ids", RO, "map((i) => ({ ...i, id: newId(), layer, x: i.x + x, y: i.y + y }));", "map((i) => ({ ...i, id: \"same\", layer, x: i.x + x, y: i.y + y }));", "paste where asked with new ids"),
 ("camera off the edge", RO, "  x = Math.max(0, Math.min(x, room.width - c.width));", "  void 0;", "where the game would start it"),
 ("no upgrade", "src/store/project.ts", "  if (p.schemaVersion < 2) upgradeTo2(p as Project);", "  if (p.schemaVersion < 0) upgradeTo2(p as Project);", "look exactly as they did"),
 ("overrides always sent", CG, "      ...(i.scaleX !== 1 ? { scaleX: i.scaleX } : {}),", "      scaleX: i.scaleX,", "carry overrides only where set"),
 ("hidden backgrounds drawn", CG, '    if (l.kind !== "background" || !l.visible || (!l.color && !l.sprite)) continue;', '    if (l.kind !== "background" || (!l.color && !l.sprite)) continue;', "carry overrides only where set"),
 ("creation error unplaced", CG, "    const line = Math.max(1, (e.line ?? 2) - 1);", "    const line = e.line ?? 1;", "creation code points at that instance"),
 ("overrides after create", RT, "    if placed:\n        _st[b + F.XSCALE]", "    if placed and False:\n        _st[b + F.XSCALE]", "overrides apply before Create"),
 ("creation code skipped", RT, "        if code is not None and o._alive:", "        if code is not None and o._alive and False:", "overrides apply before Create"),
 ("camera unclamped", EN, "    c.x = Math.max(0, Math.min(c.x, room.width - c.w));", "    void room;", "stays inside the room"),
 ("camera never glides", EN, "        const k = c.fresh ? 1 : c.smoothing;", "        const k = 1;", "glides toward"),
 ("camera starts at 0", EN, "        const k = c.fresh ? 1 : c.smoothing;", "        const k = c.fresh ? 0 : c.smoothing;", "starts on it"),
 ("shake moves the view", EN, "      c.offX = (Math.random() * 2 - 1) * amp;", "      c.x += 3; c.offX = (Math.random() * 2 - 1) * amp;", "shake moves the picture"),
 ("shake never ends", EN, "      c.shakeLeft--;", "      void 0;", "shake moves the picture"),
 ("mouse on screen", EN, "    g[G.MOUSE_X] = g[G.MOUSE_X]! + this.camera.x;", "    void 0;", "mouse is where it points in the room"),
 ("gui in the room", RT, '    for name, target in (("on_draw", _draw), ("on_draw_gui", _gui)):', '    for name, target in (("on_draw", _draw), ("on_draw_gui", _draw)):', "Draw GUI goes on the screen"),
 ("tree drag not an object", "src/editor/ResourceTree.tsx", '                      if (f.kind === "objects") e.dataTransfer.setData(OBJECT_DRAG_TYPE, r.id);', '                      if (f.kind === "sprites") e.dataTransfer.setData(OBJECT_DRAG_TYPE, r.id);', "dragged from the tree lands", E2E),
 ("paint stacks", RE, "        if (!occupied(room, placeObject, at.x, at.y)) place(placeObject, at);\n      }", "        place(placeObject, at);\n      }", "without stacking copies", E2E),
 ("move not saved", RE, "        for (const i of r.instances) if (selected.has(i.id)) (i.x += dx), (i.y += dy);", "        for (const i of r.instances) if (selected.has(i.id) && dx > 1e9) (i.x += dx), (i.y += dy);", "move with the keys", E2E),
 ("enemies in the air", "src/store/templates.ts", '  "    ====                                ",\n  " P               E      *    E          ",', '  "    ====         E           E          ",\n  " P                      *               ",', "enemies walk their floor", E2E),
 ("creation code not saved", RE, "          onChange={(code) => edit((i) => void (i.code = code))}", "          onChange={(code) => edit((i) => void (i.code = code.slice(0, 0)))}", "creation code runs for that one", E2E),
 ("scaling not whole", "src/editor/gameHost.ts", "    const scale = this.pixelScaling && fit >= 1 ? Math.floor(fit) : fit;", "    const scale = this.pixelScaling && fit >= 1e9 ? Math.floor(fit) : fit;", "scales by whole numbers", E2E),
 # Phase 6: tiles
 ("scenery collides", EN, "          if (tile < 0 || !solid[tile]) continue;", "          if (tile < 0) continue;", "scenery doesn't"),
 ("hidden layers skipped", EN, "    this.tiles = (room.tileLayers ?? []).flatMap((l) => {", "    this.tiles = (room.tileLayers ?? []).filter((l) => l.visible).flatMap((l) => {", "scenery doesn't"),
 ("tile rows short", EN, "r1 = Math.min(def.rows - 1, Math.ceil(scratch.bottom / th) - 1);", "r1 = Math.min(def.rows - 1, Math.ceil(scratch.bottom / th) - 2);", "stops on the floor"),
 ("tiles by box only", SP, "  if (s.kind === SHAPE.RECT && st[b + F.ANGLE]! % 360 === 0) return true;", "  if (s.kind === SHAPE.RECT || s.kind !== SHAPE.RECT) return true;", "misses a tile's corner"),
 ("tile hits unreported", EN, "          record(c); // an instance, or a tile layer's code", "          if (c >= 0) record(c); // an instance, or a tile layer's code", "says which layer stopped it"),
 ("tile_set ignored", EN, "    t.cells[cell] = tile >= 0 && tile < t.tileset.count ? tile : -1;", "    void cell;", "tile_set changes the level"),
 ("tiles persist", EN, "      return [{ def: l, tileset, cells: Int32Array.from(l.cells), solid }];", "      const keep = l as unknown as { live?: Int32Array };\n      return [{ def: l, tileset, cells: (keep.live ??= Int32Array.from(l.cells)), solid }];", "puts the tiles back"),
 ("short of the floor", EN, "        const stepSize = Math.min(toWhole > 1e-9 ? toWhole : 1, remaining);", "        const stepSize = Math.min(toWhole > 1e9 ? toWhole : 1, remaining);", "still ends flush"),
 ("no layer suggestion", RT, "        raise NameError(f'This room has no tile layer called \"{layer}\".' + _suggest(str(layer), layers)", "        raise NameError(f'This room has no tile layer called \"{layer}\".' + \"\"", "says what is"),
 ("tiles past the edge kept", CG, "      if (c >= 0 && row >= 0 && c < columns && row < rows) cells[row * columns + c] = tile;", "      if (c >= 0 && row >= 0) cells[row * columns + c] = tile;", "left out, not lost"),
 ("spacing uncounted", "src/store/project.ts", "  const across = (t.imageWidth - t.offsetX + t.spacingX) / (t.tileWidth + t.spacingX);", "  const across = (t.imageWidth - t.offsetX) / t.tileWidth;", "allowing for offset and spacing"),
 ("tileset delete leaves tiles", "src/store/project.ts", "          l.tileset = null;\n          l.tiles = {};", "          l.tileset = null;", "clears the tile layers"),
 ("no upgrade to 3", "src/store/project.ts", "  if (p.schemaVersion < 3) upgradeTo3(p as Project);", "  if (p.schemaVersion < 0) upgradeTo3(p as Project);", "look exactly as they did"),
 ("stamp unclipped", TO, "    for (let x = 0; x < stamp.columns; x++) if (inside(c + x, r + y, b)) out[key(c + x, r + y)] = stamp.tiles[y * stamp.columns + x]!;", "    for (let x = 0; x < stamp.columns; x++) out[key(c + x, r + y)] = stamp.tiles[y * stamp.columns + x]!;", "clipped to the room"),
 ("pattern from the drag start", TO, "      if (stamp) out[key(c, r)] = patternAt(stamp, c, r, left, top);", "      if (stamp) out[key(c, r)] = patternAt(stamp, c, r, c0, r0);", "either way it was dragged"),
 ("bucket floods everything", TO, "    if (seen.has(k) || !inside(x, y, b) || tiles[k] !== target) continue;", "    if (seen.has(k) || !inside(x, y, b)) continue;", "joined and alike"),
 ("bucket unbounded", TO, "  while (stack.length && seen.size < limit) {", "  while (stack.length && seen.size < limit * 1000) {", "stops at its limit"),
 ("palette one way", TO, "  const left = Math.min(ca, cb), right = Math.max(ca, cb), top = Math.min(ra, rb), bottom = Math.max(ra, rb);\n  const tiles: number[] = [];", "  const left = ca, right = cb, top = ra, bottom = rb;\n  const tiles: number[] = [];", "dragged either way"),
 ("solid click ignored", "src/editor/tiles/TilesetEditor.tsx", "        set((t) => void (t.solid = t.solid.includes(n) ? t.solid.filter((s) => s !== n) : [...t.solid, n].sort((a, b) => a - b)));", "        set((t) => void (t.solid = t.solid.filter((s) => s !== n)));", "solid tiles chosen", E2E),
 ("undo per tile", RE, "{ label, ...(stroke.current ? { group: stroke.current } : {}) }", "{ label, ...(stroke.current ? { group: stroke.current + Math.random() } : {}) }", "painting a level", E2E),
 ("palette single only", RE, "            if (n !== null) setStamp(stampFromPalette(anchor, n, grid.columns));", "            if (n !== null) setStamp(stampFromPalette(n, n, grid.columns));", "painting a level", E2E),
 # Phase 6 gaps: undo, remap, chunks, autotiling
 ("undo changes code", HI, "  const out = structuredClone(snapshot);\n", "  const out = structuredClone(snapshot);\n  if (out) return out;\n", "never changes code"),
 ("undo groups forever", HI, "    const same = group !== null && this.group === group && (opts.group !== undefined || now - this.at < GROUP_MS);", "    const same = group !== null && this.group === group;", "close together are one"),
 ("groups time out", HI, "    const same = group !== null && this.group === group && (opts.group !== undefined || now - this.at < GROUP_MS);", "    const same = group !== null && this.group === group && now - this.at < GROUP_MS;", "one step however long"),
 ("redo kept", HI, "    this.future = [];\n    this.group = group;", "    this.group = group;", "clears redo"),
 ("code edits are undo steps", "src/editor/ObjectEditor.tsx", '                    { history: "skip" },', '                    { history: "record" },', "never undoes typing", E2E),
 ("room edits not undoable", RE, "      mutate((p) => recipe(find(p, \"rooms\", roomId)!), { label, ...(stroke.current ? { group: stroke.current } : {}) }),", "      mutate((p) => recipe(find(p, \"rooms\", roomId)!), { label, history: \"skip\" }),", "never undoes typing", E2E),
 ("no remap on change", "src/editor/tiles/TilesetEditor.tsx", "        lost = remapTileset(p, tilesetId, before);", "        lost = remapTileset(p, tilesetId, before.id === t.id ? t : before);", "wider replacement picture", E2E),
 ("solid not remapped", "src/store/project.ts", "  after.solid = after.solid.flatMap((n) => {", "  after.solid = after.solid.flatMap((n) => {\n    if (n >= 0) return [n];", "same picture tile, not the same number"),
 ("autotiles not remapped", "src/store/project.ts", "  for (const set of after.autotiles) set.tiles = set.tiles.map((n) => (n < 0 ? n : move(n) ?? -1));", "", "same picture tile, not the same number"),
 ("all chunks drawn", "src/engine/render/pixiRenderer.ts", "        const near = cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;", "        const near = cx >= x0 - 1e9 && cx <= x1 + 1e9 && cy >= y0 - 1e9 && cy <= y1 + 1e9;", "86 000 tiles", E2E,
  ("      for (let cy = Math.max(0, y0); cy <= Math.min(maxCy, y1); cy++)\n        for (let cx = Math.max(0, x0); cx <= Math.min(maxCx, x1); cx++)", "      for (let cy = Math.max(0, y0 - 1e9); cy <= Math.min(maxCy, y1 + 1e9); cy++)\n        for (let cx = Math.max(0, x0 - 1e9); cx <= Math.min(maxCx, x1 + 1e9); cx++)")),
 ("tile changes unseen", "src/engine/render/pixiRenderer.ts", "      if (chunk) this.drawTile(chunk, t, cell);", "      if (chunk && cell < 0) this.drawTile(chunk, t, cell);", "changed while playing", E2E),
 ("fit stops at 10%", RE, "const MIN_ZOOM = 0.02;", "const MIN_ZOOM = 0.1;", "86 000 tiles", E2E),
 ("left and right swapped", TO, "    const mask = (isMember(c, r - 1) ? UP : 0) | (isMember(c + 1, r) ? RIGHT : 0) | (isMember(c, r + 1) ? DOWN : 0) | (isMember(c - 1, r) ? LEFT : 0);", "    const mask = (isMember(c, r - 1) ? UP : 0) | (isMember(c + 1, r) ? LEFT : 0) | (isMember(c, r + 1) ? DOWN : 0) | (isMember(c - 1, r) ? RIGHT : 0);", "row joins its ends"),
 ("neighbours not retiled", TO, "  out = retile(out, withNeighbours(inRoom), set);", "  out = retile(out, inRoom, set);", "changes the cell already there"),
 ("erase leaves old edges", TO, "  return retile(out, withNeighbours(cells), set);", "  return out;", "erasing lets the neighbours"),
 ("no fallback piece", TO, "  return set.tiles[15] !== undefined && set.tiles[15]! >= 0 ? set.tiles[15]! : set.tiles.find((x) => x >= 0) ?? 0;", "  return 0;", "borrows its fully joined"),
 ("autotile brush ignored", RE, "  const dab = (t: Record<string, number>, c: number, r: number, erasing: boolean) =>\n    autoSet", "  const dab = (t: Record<string, number>, c: number, r: number, erasing: boolean) =>\n    autoSet && c < -1e9", "autotile brush picks", E2E),
 ("in order does nothing", "src/editor/tiles/TilesetEditor.tsx", "              onClick={() => change((t) => void (t.autotiles.find((x) => x.id === current.id)!.tiles = Array.from({ length: 16 }, (_, i) => from + i)))}", "              onClick={() => change((t) => void (t.autotiles.find((x) => x.id === current.id)!.tiles = t.autotiles.find((x) => x.id === current.id)!.tiles.map((n) => n + 0 * from)))}", "filled in order", E2E),
 ("picture closed early", "src/editor/tiles/TilesetEditor.tsx", "    return () => {\n      alive = false;\n    };\n  }, [blob]);", "    return () => {\n      alive = false;\n      shown.current?.close();\n    };\n  }, [blob]);", "wider replacement picture", E2E),
 ("no isolation", "vite.config.ts", '  "Cross-Origin-Embedder-Policy": "credentialless",', "", "stopped at its line", E2E),
 # Phase 7: code blocks
 ("catalog block missing", TB, "    for (const type of blocksFor(e)) out.push({ kind: \"block\", type, inputs });", "    for (const type of blocksFor(e).slice(1)) out.push({ kind: \"block\", type, inputs });", "every catalog entry's blocks"),
 ("extra argument", CB, "  return `${f.name}(${args.map((a) => a.code).join(\", \")})`;", "  return `${f.name}(${args.map((a) => a.code).join(\", \")}${args.length ? \", 0\" : \"\"})`;", "calls with the catalog's parameters"),
 ("bad Python", CB, "  return `${target} += ${arg(b, g, \"BY\", Order.ADDITIVE)}\\n`;", "  return `${target} +== ${arg(b, g, \"BY\", Order.ADDITIVE)}\\n`;", "calls with the catalog's parameters"),
 ("defaults written out", CB, "  while (args.length && args[args.length - 1]!.isDefault) args.pop();", "", "optional arguments still at their default"),
 ("negative added", CB, "Number(by.getFieldValue(\"NUM\")) < 0)", "Number(by.getFieldValue(\"NUM\")) < -1e9)", "what a person would type"),
 ("two-space indent", PB, "    this.INDENT = \"    \";", "    this.INDENT = \"  \";", "what a person would type"),
 ("single quotes", PB, "  override quote_(s: string): string {", "  quoteUnused(s: string): string {", "what a person would type"),
 ("x = None lines", PB, "      .filter(([k]) => k !== \"variables\")", "      .filter(([k]) => k !== \"variables_\")", "no `x = None` lines"),
 ("unused import", PB, "      return isImport(d) && (!m || rest.includes(`${m[1]}.`));", "      return isImport(d) && (!m || rest.length >= 0);", "imports only what it uses"),
 ("no f-strings", CB, "generators[\"text_join\"] = (b, g) => {", "generators[\"text_join_unused\"] = (b, g) => {", "joins text into an f-string"),
 ("braces not doubled", CB, ".replace(/[{}]/g, (c) => c + c)", ".replace(/[{}]/g, (c) => c)", "joins text into an f-string"),
 ("loose blocks run", PB, "  const body = first ? (gen.blockToCode(first) as string) : \"\";", "  const body = ws.getTopBlocks(true).filter((b) => b !== hat).map((b) => gen.blockToCode(b) as string).join(\"\") + (first ? (gen.blockToCode(first) as string) : \"\");", "aren't under the hat"),
 ("unknown name swapped", CB, "    return typeof value === \"string\" ? value : null;", "    return typeof value === \"string\" && currentNames().objects.includes(value) ? value : null;", "no longer has"),
 ("no line map", PB, "    if (m) current = m[2]!;", "    if (m) current = null;", "which block made each line"),
 ("error selects nothing", BE, "    Blockly.getFocusManager().focusNode(block);\n", "", "selects the block that made it", E2E),
 ("rename skips blocks", PJ, "      if (e.blocks) renameInBlocks(e.blocks, from, to);", "      if (e.blocks && from === to) renameInBlocks(e.blocks, from, to);", "renames in blocks too"),
 ("open blocks not reloaded", BE, "    if (!w || json === saved.current) return;", "    if (!w || json !== \"\") return;", "renames it in the blocks' pickers", E2E),
 ("undo reverts blocks mode", HI, "    if (n.mode) h.mode = n.mode;\n    else delete h.mode;\n", "", "never changes blocks either"),
 ("undo restores converted blocks", HI, "    else delete h.blocks;", "    else h.blocks = h.blocks;", "never changes blocks either"),
 ("unlabelled merged", HI, "    const group = opts.group ?? (opts.label !== undefined ? `auto:${opts.label}` : null);", "    const group = opts.group ?? `auto:${opts.label ?? \"\"}`;", "never merged"),
 ("object changes share a label", OE, '  const set = (recipe: (o: ObjectResource) => void, label: string) => mutate((p) => recipe(find(p, "objects", objectId)!), { label });', '  const set = (recipe: (o: ObjectResource) => void, label: string) => mutate((p) => recipe(find(p, "objects", objectId)!), { label: label.slice(0, 0) });', "elsewhere it undoes the project", E2E),
 ("Python becomes blocks", CM, "export const canUse = (h: CodeHolder, mode: CodeMode) => modeOf(h) === mode || isEmpty(h);", "export const canUse = (h: CodeHolder, mode: CodeMode) => modeOf(h) === mode || isEmpty(h) || mode !== \"python\";", "Python never becomes blocks", E2E,
  ("  if (modeOf(h) === mode || !isEmpty(h)) return;", "  if (modeOf(h) === mode) return;")),
 ("converted without asking", CM, "  return isEmpty(h) || confirm(", "  return true || isEmpty(h) || confirm(", "Python never becomes blocks", E2E),
 ("Ctrl+Z in blocks undoes the project", "src/editor/EditorPage.tsx", '".cm-editor, .blocks-editor, .blocklyWidgetDiv', '".cm-editor, .blocklyWidgetDiv', "in the blocks undoes blocks", E2E),  # -g is a regex: no "+" in it
 ("blocks not saved", BE, "        latest.current.onChange(state, py.code);", "        void state;", "the game runs it", E2E),
 ("media not built", "vite.config.ts", "      for (const f of readdirSync(blocklyMediaDir)) copyFileSync", "      for (const f of readdirSync(blocklyMediaDir).slice(0, 0)) copyFileSync", "the game runs it", E2E),
 ("media not served", APP, '    r = send_from_directory(DIST / "blockly-media", name)', '    r = send_from_directory(DIST / "blockly-medium", name)', "Blockly's media", PY),
 ("still version 4", PJ, "  if (p.schemaVersion < 7) p.schemaVersion = 7;", "", "version 1 rooms"),
 # Blocks in scripts and creation code
 ("script globals kept", PB, '    return gen.finish("").replace(/^ +global [\\w, ]+\\n/gm, "")', '    return gen.finish("").replace(/^ +globalx [\\w, ]+\\n/gm, "")', "no `global` lines"),
 ("functions crowded", PB, '      .join("\\n\\n\\n");', '      .join("\\n");', "PEP 8 apart"),
 ("script runs loose blocks", PB, '    return gen.finish("").replace(', '    return gen.finish(ws.getTopBlocks(true).filter((b) => !FUNCTION_DEFS.includes(b.type)).map((b) => gen.blockToCode(b) as string).join("")).replace(', "anything that isn't a function"),
 ("call slots ignored", CB, "    const call = `${name}(${block.params.map((_, i) => arg(b, g, `ARG${i}`)).join(\", \")})`;", "    const call = `${name}(${block.params.slice(1).map((_, i) => arg(b, g, `ARG${i}`)).join(\", \")})`;", "one slot per parameter"),
 ("calls never refreshed", CB, "    if (f && f.params.join() !== b.params.join()) b.setParams(f.params);", "    if (f && b.params.length < 0) b.setParams(f.params);", "parameters as they are now"),
 ("plugged blocks dropped", CB, "        if (old) input.connection!.connect(old);", "        if (old && params.length < 0) input.connection!.connect(old);", "parameters as they are now"),
 ("functions not found", BS, "s.code.matchAll(/^def\\s+", "s.code.matchAll(/^define\\s+", "found in any script's code"),
 ("self in scripts", TB, '    contents: kind === "script" ? withoutSelf(contents) : contents,', "    contents,", "calls with the catalog's parameters"),
 ("no Functions category", TB, "      functions,\n    ],", "    ],", "every catalog entry's blocks"),
 ("comments count as Python", BS, '  return code.split("\\n").some((l) => l.trim() !== "" && !l.trim().startsWith("#"));', '  return code.split("\\n").some((l) => l.trim() !== "");', "no Python in it yet"),
 ("scripts can't be blocks", "src/editor/OtherEditors.tsx", '        onBlocks={() => edit((s) => toBlocks(s, "script"))}', "        onBlocks={() => edit((s) => void (s.code.length < 0 && toBlocks(s, \"script\")))}", "script made with blocks", E2E),
 ("creation dialog never opens", RE, '          edit((i) => toBlocks(i, "creation"));\n          setOpen(true);', '          edit((i) => toBlocks(i, "creation"));', "built in a dialog", E2E),
 ("creation blocks not saved", RE, "                      i.blocks = blocks;\n                      i.code = code;\n", "                      i.blocks = blocks;\n                      void code;\n", "built in a dialog", E2E),
 ("undo reverts scripts and creation code", HI, "    ...p.scripts,\n    ...p.rooms.flatMap((r) => r.instances),\n", "", "in scripts and creation code too"),
 ("rename skips creation code", PJ, "      i.code = sub(i.code);\n", "", "instances' creation code"),
 ("function comment written", CB, 'Blockly.Msg["PROCEDURES_DEFNORETURN_COMMENT"] = "";\n', "", "script made with blocks", E2E),
 # Phase 8: event sheets
 ("and becomes or", SH, '  const all = parts.join(r.any ? " or " : " and ");', '  const all = parts.join(" or ");', "conditions joined with and"),
 ("or never", SH, '  const all = parts.join(r.any ? " or " : " and ");', '  const all = parts.join(r.any ? " and " : " and ");', "OR row joins with or"),
 ("no brackets", SH, "  return joined && LOOSE.test(code) ? `(${code})` : code;", "  return joined && LOOSE.test(code) ? code : code;", "OR row joins with or"),
 ("not dropped", SH, '  if (c.type === "call") return `${not ? "not " : ""}${callCode(c.fn, c.args)}`;', '  if (c.type === "call") return `${not ? "" : ""}${callCode(c.fn, c.args)}`;', "negates a condition"),
 ("always gets an if", SH, "        body(r.actions, r.children, depth, r.id, false);\n        return;", "        emit(depth, \"if True:\", r.id);\n        body(r.actions, r.children, depth + 1, r.id);\n        return;", "with no conditions"),
 ("else never elif", SH, "      if (follows) emit(depth, t ? `elif ${t}:` : \"else:\", r.id);", "      if (follows) emit(depth, t ? \"else:\" : \"else:\", r.id);", "else/elif rows follow"),
 ("empty body, no pass", SH, '    if (needed && !real) emit(depth, "pass", owner);', '    if (needed && !real && depth < 0) emit(depth, "pass", owner);', "for-each row"),
 ("comments are a body", SH, '    const real = lines.slice(before).some((l) => !l.trim().startsWith("#"));', "    const real = lines.length > before;", "body of only comments"),
 ("trigger once ignored", SH, '  if (r.conditions.some((c) => c.type === "once")) return', '  if (r.conditions.some((c) => c.type === "once") && r.id === "") return', "Trigger once wraps"),
 ("once never resets", RT, "        memory[key] = now\n", "        memory[key] = now or before\n", "Trigger once included"),
 ("line map off", SH, "    for (const a of actions) emit(depth, actionCode(a), a.id);", "    for (const a of actions) emit(depth, actionCode(a), owner);", "which row, condition or action"),
 ("sheet defaults written", SH, "    while (out.length) {", "    while (out.length < 0) {", "with no conditions"),
 ("any value passes", SH, '  if (error || names.length !== 1 || names[0] !== "ExpressionStatement") return "This isn\'t a Python value.";', '  if (error) return "This isn\'t a Python value.";', "one Python value in a value box"),
 ("if allowed on a line", SH, '  if (COMPOUND.has(names[0]!)) return "Use rows for if, for and while.";\n', "", "one simple line in a line box"),
 ("stray else allowed", SH, '          out.set(r.id, "An Else row goes straight after a row with conditions.");', "          void r;", "problems are found by the id"),
 ("wrong conditions offered", SH, '(e): e is ApiFunction => e.kind === "function" && e.returns === "True or False");', '(e): e is ApiFunction => e.kind === "function" && e.returns !== "nothing");', "every function that answers True/False"),
 ("for-each keeps old name", SH, "        if (r.object === from) r.object = to;\n", "", "a for-each's object"),
 ("rename skips sheet creation code", PJ, "      if (i.sheet) renameInSheet(i.sheet, from, sub, to);\n", "", "renaming reaches its boxes", E2E),
 ("undo reverts sheets", HI, "    if (n.sheet) h.sheet = structuredClone(n.sheet);\n    else delete h.sheet;\n", "", "and sheets"),
 ("Python becomes a sheet", CM, "export const canUse = (h: CodeHolder, mode: CodeMode) => modeOf(h) === mode || isEmpty(h);", "export const canUse = (h: CodeHolder, mode: CodeMode) => modeOf(h) === mode || isEmpty(h) || mode !== \"python\";", "Python never becomes a sheet", E2E,
  ("  if (modeOf(h) === mode || !isEmpty(h)) return;", "  if (modeOf(h) === mode) return;")),
 ("sheet Ctrl+Z redoes", SE, "          if (k === \"y\" || e.shiftKey) redo();\n          else undo();", "          if (k === \"y\" || e.shiftKey) redo();\n          else redo();", "Ctrl.Z on the sheet", E2E),
 ("typing is many undo steps", SE, "    if (!(group && last && last.group === group && now - last.at < UNDO_GROUP_MS)) {", "    if (!(group && last && last.group === group && now - last.at < -UNDO_GROUP_MS)) {", "Ctrl.Z on the sheet", E2E),
 ("Ctrl+Z on a sheet undoes the project", "src/editor/EditorPage.tsx", '.blocklyDropDownDiv, .sheet-editor")', '.blocklyDropDownDiv")', "Ctrl.Z on the sheet", E2E),
 ("sheet Python not updated", SE, "    latest.current.onChange(next, sheetToPython(next).code);\n  };\n  const undo", "    latest.current.onChange(next, latest.current.code);\n  };\n  const undo", "a sheet builds an event", E2E),
 ("error not marked on the sheet", SE, '${ops.errorId === act.id ? " error" : ""}', '${ops.errorId === act.id ? "" : ""}', "lands on the row and the action", E2E),
 ("no names in quotes", EB, '      if (ty && (before.match(/"/g) ?? []).length % 2 === 1) {', '      if (ty && (before.match(/"/g) ?? []).length % 2 === 3) {', "a sheet builds an event", E2E),
 ("calls not refitted", SH, "    if (!f || f.params.length === item.args.length) return;", "    if (!f || item.args.length >= 0) return;", "fitted to the function's parameters"),
 ("dropped into itself", SH, "  if (row.kind !== \"comment\" && findRow(row.children, target)) return false;\n", "", "never onto itself"),
 ("target not found again", SH, "  else to.list.splice(to.index + (where === \"after\" ? 1 : 0), 0, row!);", "  else to.list.splice(to.index + (where === \"after\" ? 1 : 0) + (to.list === from.list && to.index >= from.index ? 1 : 0), 0, row!);", "finds its target again"),
 ("inside goes nowhere", SH, "  if (where === \"inside\" && t.kind !== \"comment\") t.children.push(row!);", "  if (where === \"inside\" && t.kind === \"comment\") t.children.push(row!);", "as its last sub-event"),
 ("drop does nothing", SE, "        e.stopPropagation();\n        ops.finishDrop();", "        e.stopPropagation();", "rows move by drag and drop", E2E),
 ("middle is not inside", SE, '    return f < 0.25 ? "before" : f > 0.75 ? "after" : "inside";', '    return f < 0.25 ? "before" : f > 0.75 ? "after" : "after";', "rows move by drag and drop", E2E),
 ("no end of sheet", SE, '            if (dropAt(null, "after")) e.preventDefault();', '            if (dropAt(null, "after") && e.clientY < 0) e.preventDefault();', "rows move by drag and drop", E2E),
 ("bad box not marked", EB, '<span ref={host} className={`expr-box${problem ? " bad" : ""}`}', '<span ref={host} className={`expr-box${problem ? "" : ""}`}', "a box that isn't Python is marked", E2E),
 # Phase 9a: sounds, gamepads, save files, fonts
 ("sound orders lost", RT, '        out["sounds"] = list(_sound_orders)', '        out["sound"] = list(_sound_orders)', "go out to the page as orders"),
 ("sounds never end", RT, "    ends = None if loop else _step_count + max(1, round(_sound_length[name] * _steps_per_second))", "    ends = None", "worked out from each sound's length"),
 ("music not one at a time", RT, "    if _music == name:\n        return True", "    if _music is not None:\n        return True", "music is one at a time"),
 ("restart keeps playing", RT, '    _sound_orders.append(["stop_all"])\n    _sound_orders.append(["music_stop"])\n    _playing.clear()\n    _music = None\n    for o in list(_all):', "    for o in list(_all):", "music is one at a time"),
 ("unknown sound allowed", RT, "    if isinstance(sound, str) and sound in _sound_length:\n        return sound", "    if isinstance(sound, str):\n        return sound", "isn't in the Sounds folder"),
 ("pad pressed every step", IN, "    this.padPressed.fill(0);\n", "", "held, pressed and released per step"),
 ("pad tap lost", IN, "        if (!down && this.padHeld[at]) this.padReleased[at] = 1;", "        if (!down && this.padHeld[at]) this.padPressed[at] = 0;", "held, pressed and released per step"),
 ("no dead zone", IN, "        return Math.abs(v) < DEAD_ZONE ? 0 : Math.max(-1, Math.min(1, v));", "        return Math.abs(v) < 0 ? 0 : Math.max(-1, Math.min(1, v));", "read with a dead zone"),
 ("every pad is pad 0", RT, '    return _g[_L.G.PAD_DOWN + _pad(pad) * len(_L.PAD_BUTTONS) + _pad_button(button)] == 1', '    return _g[_L.G.PAD_DOWN + 0 * _pad(pad) + _pad_button(button)] == 1', "held, pressed and released per step"),
 ("save keeps the caller's list", RT, "    _save[key] = json.loads(text)", "    _save[key] = value", "are copies"),
 ("save sent every frame", RT, '        out["save"] = _save\n        _save_changed = False', '        out["save"] = _save', "keep values between plays"),
 ("save starts empty", RT, '    _save = json.loads(json.dumps(game.get("save") or {}))', "    _save = {}", "keep values between plays"),
 ("font not drawn", RT, '        _draw_list.append(["text", _draw_depth, x, y, str(text), _color, _font, _font_size, _alpha])', '        _draw_list.append(["text", _draw_depth, x, y, str(text), _color, -1, 16, _alpha])', "draw_set_font picks a font"),
 ("fonts not loaded in the worker", "src/python/gameWorker.ts", "  const fonts = await loadFonts(msg.def);", "  const fonts = await loadFonts({ ...msg.def, fonts: [] });", "the game draws with it", E2E),
 ("renderer ignores the font", "src/engine/render/pixiRenderer.ts", '          const family = this.fonts.has(font) ? `gameide-font-${font}` : "monospace";', '          const family = this.fonts.has(font + 1e9) ? `gameide-font-${font}` : "monospace";', "the game draws with it", E2E),
 ("page plays nothing", GH, "      case \"sounds\":\n        this.sound.run(m.orders);", "      case \"sounds\":\n        void m.orders;", "a starter sound plays", E2E),
 ("sounds not decoded", SND, "      if (buffer) this.buffers.set(s.name, { buffer, volume: s.volume ?? 1 });", "      if (buffer && !buffer) this.buffers.set(s.name, { buffer, volume: s.volume ?? 1 });", "a starter sound plays", E2E),
 ("save not kept", GH, "            localStorage.setItem(saveKey(this.saveId), JSON.stringify(m.data));", "            void m.data;", "save files keep values", E2E),
 ("save not handed back", GH, "save: gameId ? readSave(gameId) : {} };", "save: gameId ? {} : {} };", "save files keep values", E2E),
 ("pads not polled", GH, '        this.send({ type: "input", events: [{ k: "pads", pads }] });', "        void pads;", "a gamepad moves the player", E2E),
 ("server refuses sounds", GS, "    kind = sniff_sound(data)\n", "    kind = None\n", "a WAV sound is accepted", PY),
 ("sounds get the picture limit", GS, "    return (kind, MAX_SOUND_BYTES) if kind else (None, 0)", "    return (kind, MAX_ASSET_BYTES) if kind else (None, 0)", "3 MB sound is fine", PY),
 ("any file is a sound", AT, "  if (!type || kindOf(type) !== want) throw new Error", "  if (!type || (kindOf(type) !== want && want.length < 0)) throw new Error", "turned away, saying what is wanted", E2E),
 ("sound files not kept", PJ, '      ...(project.sounds ?? []).flatMap((s) => (s.asset ? [s.asset] : [])),\n', "", "sounds and fonts go into the built game"),
 ("old projects lack sound folders", PJ, "    p.sounds ??= [];\n    p.fonts ??= [];\n", "", "sounds and fonts go into the built game"),
 ("a category left out", "src/catalog/api.ts", 'export const CATEGORIES: Category[] = ["Instances", "Collision", "Input", "Motion", "Drawing", "Sound", "Saving",', 'export const CATEGORIES: Category[] = ["Instances", "Collision", "Input", "Motion", "Drawing", "Saving",', "every category is in the docs"),
 ("WAV says the wrong length", "src/store/starterSounds.ts", "  v.setUint32(40, samples.length * 2, true);", "  v.setUint32(40, samples.length, true);", "real WAV files"),
 ("MP3 without a tag refused", AT, "  if (ascii(b, 0, \"ID3\") || (b[0] === 0xff && ((b[1] ?? 0) & 0xe0) === 0xe0)) return \"audio/mpeg\";", "  if (ascii(b, 0, \"ID3\")) return \"audio/mpeg\";", "known by their first bytes"),
 ("no hint for a name without quotes", RT, '        message = "".join(traceback.format_exception_only(type(e), e)).strip() + _quotes_hint(e)', '        message = "".join(traceback.format_exception_only(type(e), e)).strip() + _quotes_hint(None)', "gets a hint saying how to write it"),
 # Phase 9b: export and publishing
 ("class games open to all", PUB, '    if pub.visibility == "class" and not owner:', '    if pub.visibility == "classy" and not owner:', "is closed to someone outside the class", PY),
 ("any teacher moderates", PUB, "    return bool(user) and (is_admin(user) or user.id in _teachers_of(db, pub.owner_id))", "    return bool(user) and (is_admin(user) or is_teacher(user) or user.id in _teachers_of(db, pub.owner_id))", "another class's teacher can't approve it", PY),
 ("public skips the queue", PUB, '            status = "approved" if (is_teacher(user) or is_admin(user) or auto) else "pending"', '            status = "approved"', "waits for approval", PY),
 ("approval survives a republish", PUB, "        pub.status = status\n", "        pub.status = pub.status or status\n", "puts it back in the queue", PY),
 ("Explore lists pending games", PUB, '        q = db.query(Published).filter(Published.visibility == "public", Published.status == "approved", Published.taken_down == 0)', '        q = db.query(Published).filter(Published.visibility == "public", Published.taken_down == 0)', "isn't on Explore yet", PY),
 ("taken down still plays", PUB, "    if pub.taken_down and not (owner or moderates(db, user, pub)):", "    if pub.taken_down and owner and not owner:", "taken down is gone for players", PY),
 ("an email as the author", PUB, '    if not text or "@" in text or "/" in text:', "    if not text:", "email as the author name", PY),
 ("players see the live project", PUB, "        return jsonify(info=_info(db, pub, user), project=json.loads(pub.data))", "        return jsonify(info=_info(db, pub, user), project=json.loads(db.query(GameProject).get(pub.project_id).data))", "players see the published version", PY),
 ("plays counted every visit", PUB, "        if pub.slug not in seen:", "        if True:", "counted once per visit", PY),
 ("remix ignores the author", PUB, "        if not pub.allow_remix and pub.owner_id != user.id:", "        if not pub.allow_remix and pub.owner_id == -1:", "won't let be remixed", PY),
 ("remix without credit", PUB, '        data["remixOf"] = {"id": pub.slug, "title": pub.title, "author": pub.author}\n', "", "crediting where it came from", PY),
 ("gallery open to anyone", PUB, "        if course is None or not (_member(db, user, class_id) or is_admin(user)):", "        if course is None:", "gallery is only for its class", PY),
 ("auto-approve ignored", PUB, "                                                  ClassSettings.auto_approve == 1).first()", "                                                  ClassSettings.auto_approve == 2).first()", "approve by itself", PY),
 ("students moderate", PUB, "    if not (is_teacher(user) or is_admin(user)):\n        fail(\"Only teachers can see this.\", 403)", "    if False:\n        fail(\"Only teachers can see this.\", 403)", "can't open the approval queue", PY),
 ("reports never shown", PUB, "            reported=[row(g) for g in games if g.id in by_game],", "            reported=[],", "its teacher sees the report", PY),
 ("take-down leaves reports open", PUB, '            pub.takedown_note = str(body.get("note") or "")[:300]\n            db.query(Report).filter_by(published_id=pub.id).update({"handled": 1})', '            pub.takedown_note = str(body.get("note") or "")[:300]', "its reports are handled", PY),
 ("export without Pyodide", "vite.config.ts", '      const files = ["play.html", "favicon.svg", ...built, ...PYODIDE_FILES.map((f) => `pyodide/${f}`)];', '      const files = ["play.html", "favicon.svg", ...built];', "plays from another site", E2E),
 ("Pyodide from the site's root", GH, '    const indexURL = new URL("pyodide/", document.baseURI).href;', '    const indexURL = new URL("/pyodide/", document.baseURI).href;', "plays from another site", E2E),
 ("export without the game's files", "src/store/html5.ts", "    index.assets[id] = name;\n", "", "plays from another site", E2E),
 ("play page titled by project", PA, "        document.title = info ? `${info.title} — GameIDE` : p.project.name;", "        document.title = info ? `${p.project.name} — GameIDE` : p.project.name;", "plays from its link for anyone", E2E),
 ("play page without its base", APP, """    head = (f'<base href="/">\\n    <link rel="manifest\"""", """    head = (f'\\n    <link rel="manifest\"""", "plays from its link for anyone", E2E),
 ("no picture sent", PD, "        json: { ...form, classId: form.visibility === \"class\" ? form.classId : null, ...(thumbnail ? { thumbnail } : {}) },", "        json: { ...form, classId: form.visibility === \"class\" ? form.classId : null, ...(thumbnail ? {} : {}) },", "on Explore with its picture", E2E),
 ("no manifest", APP, '        "display": "standalone",\n', "", "it has a manifest", E2E),
 ("other editors' classes count", PUB, "    return db.query(accounts.Course).filter(accounts.Course.app == APP_NAME)", "    return db.query(accounts.Course)", "another editor's classes are never offered", PY),
 # Home and My Games
 ("sheet sounds start empty", SE, "    sound: names.sounds?.[0],\n", "", "starts with one of the game's own sounds", E2E),
 ("icon by exact name only", GS, '        if str(s.get("name", "")).lower() == "icon" and s.get("frames"):', '        if str(s.get("name", "")) == "icon" and s.get("frames"):', "sprite named icon", PY),
 ("published not shown on My Games", APP, '        return jsonify(projects=[_summary(p, pubs.get(p.id)) for p in rows], used=_user_bytes(db, user.id),', '        return jsonify(projects=[_summary(p, None) for p in rows], used=_user_bytes(db, user.id),', "shows that a game is published", PY),
 ("clone shares the original", "src/editor/ProjectsPage.tsx", "      const copy: Project = { ...structuredClone(project), id: newId(),", "      const copy: Project = { ...structuredClone(project), id: project.id,", "clones a game", E2E),
 ("search does nothing", "src/editor/ProjectsPage.tsx", "  const shown = (list ?? []).filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()));", "  const shown = (list ?? []).filter((p) => p.name.length >= 0 || search === \"\");", "clones a game", E2E),
 # Phase 9c: the Steam kit
 ("player ignores autostart", PA, "    if (autostart && pythonReady && phase.kind === \"ready\") start();", "    if (autostart && pythonReady && phase.kind === \"loading\") start();", "plays from another site", E2E),
 ("kit opens without autostart", "src/store/steamKit.ts", '  win.loadURL("app://game/index.html?autostart");', '  win.loadURL("app://game/index.html");', "gives a build kit", E2E),
 ("kit without isolation", "src/store/steamKit.ts", '          "Cross-Origin-Embedder-Policy": "require-corp",\n', "", "gives a build kit", E2E),
 ("kit versions unpinned", "src/store/steamKit.ts", 'export const ELECTRON_VERSION = "44.7.0";', 'export const ELECTRON_VERSION = "^44.7.0";', "gives a build kit", E2E),
 # Phase 10: classes
 ("any teacher reads", CL, "    return a is not None and a.teacher_id == user.id", "    return a is not None", "…nor another teacher", PY),
 ("teacher reads anything", CL, "    if work is None:\n        return False", "    if work is None:\n        return is_teacher(user)", "aren't assignment work", PY),
 ("reader adds files", APP, "        p = _own_project(db, user, slug)\n        if not (1 <= len(asset_id) <= 32", "        p = _readable_project(db, user, slug)\n        if not (1 <= len(asset_id) <= 32", "nor add files to it", PY),
 ("not read only", APP, "readOnly=p.owner_id != user.id)", "readOnly=False)", "its teacher can open it — read only", PY),
 ("class open to all", CL, "    if course is None or teaching_only or not _enrolled(db, user, class_id):", "    if course is None or teaching_only:", "closed to students not in it", PY),
 ("other editors' classes", CL, "    return db.query(accounts.Course).filter(accounts.Course.app == APP_NAME)", "    return db.query(accounts.Course)", "another editor's class isn't here", PY),
 ("starter not a copy", CL, '        starter = copy_project(db, src, user, f"{title} (starter)")', "        starter = src", "is a copy", PY),
 ("starter on My Games", APP, "if p.id not in starters]", "if p.id or starters]", "kept off the teacher's My Games", PY),
 ("a copy every time", CL, "        if work is not None:\n            p = db.query(GameProject).filter_by(id=work.project_id).first()", "        if False:\n            p = db.query(GameProject).filter_by(id=work.project_id).first()", "the same game the second time", PY),
 ("turned in not kept", CL, '        v = _freeze(db, p, "turned-in", "Turned in")', '        v = _freeze(db, p, "auto", "Turned in")', "as turned in", PY),
 ("hidden can start", CL, "        if a.archived or (item and item.hidden):", "        if a.archived:", "…and can't be started", PY),
 ("archived turn in", CL, "        if a.archived:\n            return err(\"This assignment is closed. Ask your teacher.\", 403)", "        if False:\n            return err(\"This assignment is closed. Ask your teacher.\", 403)", "…and can't be turned in", PY),
 ("turned-in deletable", CL, "        if db.query(accounts.Submission).filter_by(assignment_id=a.id).first() is not None:", "        if False:", "can't be deleted", PY),
 ("comments never seen", CL, "                c.seen, changed = 1, True", "                changed = True", "then it isn't new", PY),
 ("score counts as turn in", CL, '                s = accounts.Submission(assignment_id=a.id, student_id=sid, snippet_slug=f"v{v.id}", times_submitted=0)', '                s = accounts.Submission(assignment_id=a.id, student_id=sid, snippet_slug=f"v{v.id}", times_submitted=1)', "without calling it turned in", PY),
 ("students duplicate", CL, "        user = _need_teacher(db)\n        p = _readable(db, user, slug)\n        if p.owner_id == user.id:", "        user = _need_user(db)\n        p = _readable(db, user, slug)\n        if p.owner_id == user.id:", "can't copy someone's game", PY),
 ("order ignored", CL, "            items[iid].position = n", "            items[iid].position = -n", "teacher's order", PY),
 ("class delete loses", CL, '{"archived": 1}, synchronize_session=False)', '{"archived": 0}, synchronize_session=False)', "deleting a class archives", PY),
 ("roster never shrinks", CL, "        if email not in found:\n            db.delete(row)", "        if email not in found:\n            pass", "drops a student who left", PY),
 ("typed into Classroom roster", CL, "        if course.course_id:\n            return err(\"This class's students come from Google Classroom. Add them", "        if False:\n            return err(\"This class's students come from Google Classroom. Add them", "can't be typed into", PY),
 ("forged callback", CL, '        if not expected or request.args.get("state") != expected:', "        if not expected:", "didn't start here is refused", PY),
 ("token in the clear", CL, "        link.refresh_token = _token_box().encrypt(refresh.encode()).decode()", "        link.refresh_token = refresh", "never stored as it came", PY),
 ("no due date posted", CL, '            "maxPoints": a.out_of,\n            **due,', '            "maxPoints": a.out_of,', "points and due date", PY),
 ("wrong grade sent", CL, 'body={"draftGrade": grade}', 'body={"draftGrade": sub.score_synced}', "Sync sends each score", PY),
 ("view shows a backup", UPJ, "        const backup = store.kind === \"view\" ? null : readBackup(id);", "        const backup = readBackup(id);", "a class:", E2E),
 ("badge not mirrored", "src/store/gameBadge.ts", "    const right = left.slice(0, BADGE_SIZE - half).reverse();", "    const right = left.slice(0, BADGE_SIZE - half);", "mirrored left to right"),
 ("badge changes each visit", "src/store/gameBadge.ts", "  const rnd = random(hash(id));", "  const rnd = random(Math.floor(Math.random() * 1e9));", "same every time"),
 # Phase 10b: XP
 ("run pays at once", RW, "        if busy < xp.RUN_EVERY_SECONDS:", "        if False:", "a run pays nothing before enough working time", PY),
 ("run twice in the time", RW, "        if runs.filter(accounts.XpAward.created_at > cutoff).first() is not None:", "        if False:", "not twice inside the time", PY),
 ("same code pays", RW, "        if last is not None and last.detail == code:", "        if False:", "nor for the same code again", PY),
 ("teachers earn", RW, "    return user is not None and not _is_teacher(user)", "    return user is not None", "a teacher's run pays nothing", PY),
 ("no working time", APP, '            session["busy"] = session.get("busy", 0) + min(t - last, BUSY_STEP_SECONDS)', '            session["busy"] = session.get("busy", 0)', "working time is counted", PY),
 ("penalty below zero", RW, "            moved = xp.penalty_for(amount, have.get(s.id, 0))", "            moved = amount", "never takes XP below 0", PY),
 ("XP to anyone", RW, "        if u is not None and u.id == sid:", "        if u is not None:", "someone not in the class", PY),
 ("hidden on the board", RW, "            if u is not None and not u.board_hidden:", "            if u is not None:", "who hides is off the board", PY),
 ("board for all", RW, "        if course is None or not (teaching or any(c.id == class_id for c in my_classes(db, user))):", "        if course is None:", "closed to anyone outside the class", PY),
 ("quest short of full", GR, "        return t is not None and t >= a.out_of", "        return t is not None and t >= a.out_of - 1", "short of full marks pays no quest", PY),
 ("score pays no quest", CL, "        paid = rewards.full_marks_xp(db, a, sid)", "        paid = 0", "full marks pays the quest reward", PY),
 ("reward pays no one", RW, "            paid = sum(1 for sid in students if full_marks_xp(db, a, sid))", "            paid = 0", "those who already have full marks", PY),
 ("any avatar", RW, "        avatar, why = xp.clean_avatar(wanted, xp.level_of(xp.total(db, user.id)))", "        avatar, why = xp.clean_avatar(wanted, 99)", "above the student's level is refused", PY),
 ("waiting photo public", RW, '        if photo.status != "approved":\n            viewer', '        if False:\n            viewer', "seen by nobody else", PY),
 ("photo before approval", RW, '            approved = _photo(db, user, "approved")\n            if approved is None:\n                return err("Your photo', '            approved = _photo(db, user, "pending")\n            if approved is None:\n                return err("Your photo', "isn't their avatar yet", PY),
 ("ask past tokens", RW, "        if free < item.cost:", "        if free < 0:", "without a token is refused", PY),
 ("any teacher decides", RW, '        row = db.query(accounts.ShopRequest).filter_by(id=request_id, teacher_id=user.id, status="pending").first()', '        row = db.query(accounts.ShopRequest).filter_by(id=request_id, status="pending").first()', "another teacher can't approve it", PY),
 ("approve spends nothing", RW, '.update({"tokens_used": accounts.User.tokens_used + row.cost}, synchronize_session=False))', '.update({"tokens_used": accounts.User.tokens_used + 0}, synchronize_session=False))', "approving spends the token", PY),
 ("off shelf offered", RW, "        q = q.filter_by(active=1)", "        q = q", "taken off the shelf isn't offered", PY),
 ("undo keeps XP", RW, '.delete(\n            synchronize_session=False)\n        row.undone = 1', '.count()\n        row.undone = 1', "Undo takes its XP back", PY),
 ("news shows runs", RW, '                  if a.source.split(":", 1)[0] != "run"]', "                  if True]", "runs don't", PY),
 ("toasts see nothing", XPP, "      const after = mark && mark.user === me.user!.id ? `?after=${mark.after}` : \"\";", '      const after = mark && mark.user === me.user!.id ? "" : "";', "XP: given by the teacher", E2E),
 ("run claimed at once", EP, "      }, RUN_COUNTS_MS);", "      }, RUN_COUNTS_MS / 50);", "claimed for XP", E2E),
 ("stop keeps the claim", EP, "    cancelClaim();\n    host?.stop();", "    host?.stop();", "claimed for XP", E2E),
 ("hash ignores scripts", RX, "  for (const s of p.scripts) parts.push(`s:${s.id}:${s.code}`);\n", "", "changes when the game's code changes"),
 ("no favicon", "index.html", '    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />\n', "", "carry GameIDE's mark", E2E),
 ("export without favicon", "vite.config.ts", '"play.html", "favicon.svg", ...built', '"play.html", ...built', "HTML5 export plays", E2E),
 # Phase 11a: notes, questions, tests
 ("notes leak", CL, '                                   "notes": notes.student_notes(a),', '                                   "notes": grades.notes_of(a),', "without the right choice marked", PY),
 ("teacher answers kept", NT, "        if user.id == a.teacher_id:\n            return jsonify(_answer_reply(key, accounts.QuizAnswer(response=response), practice=True))", "        if False:\n            return jsonify(_answer_reply(key, accounts.QuizAnswer(response=response), practice=True))", "practice, kept nowhere", PY),
 ("made-up tests kept", NT, '    results = [dict(r, points=real[r["label"]]) for r in _clean_results(data.get("results")) if r["label"] in real]', '    results = [dict(r, points=real.get(r["label"], r["points"])) for r in _clean_results(data.get("results"))]', "keeps only the notes' tests", PY),
 ("page's points kept", NT, '    results = [dict(r, points=real[r["label"]]) for r in _clean_results(data.get("results")) if r["label"] in real]', '    results = [dict(r) for r in _clean_results(data.get("results")) if r["label"] in real]', "keeps only the notes' tests", PY),
 ("own check counts", GR, '        assignment_id=assignment_id, kind="verified")}', '        assignment_id=assignment_id, kind="self")}', "counts toward no grade", PY),
 ("self XP repeats", NT, '"selftest:%d:%s" % (a.id, _label_key(r["label"]))', '"selftest:%d:%s:%d" % (a.id, _label_key(r["label"]), id(r))', "once each", PY),
 ("verify without turn-in", NT, '        if db.query(accounts.Submission).filter_by(assignment_id=a.id, student_id=student_id).first() is None:\n            return err("They haven\'t turned anything in.", 404)', "        if False:\n            return err(\"They haven't turned anything in.\", 404)", "only for someone who turned something in", PY),
 ("never stale", CL, '            stale = kind == "verified" and s is not None', "            stale = False and s is not None", "marked stale", PY),
 ("long uncleaned", NT, "            response = quiz.clean_html(response)\n            if not quiz.plain_text(response):", "            response = response\n            if not quiz.plain_text(response):", "cleaned as it's stored", PY),
 ("total ignores notes", GR, "    return round((score or 0) + (got or 0), 2)", "    return round(score or 0, 2)", "the questions' points and the total", PY),
 ("no notes-only full marks", GR, "    return most > 0 and got is not None and got >= most - 0.001", "    return False", "earning everything in the notes is full marks", PY),
 ("no all-answered bonus", NT, "        if asked <= have:", "        if False:", "pays its bonus", PY),
 ("notes copyable", "src/editor/app.css", ".notes-md code {\n  font-family: var(--mono, \"Ubuntu Mono\", monospace);\n  user-select: none;\n  -webkit-user-select: none;\n}", ".notes-md code {\n  font-family: var(--mono, \"Ubuntu Mono\", monospace);\n}", "notes: slides", E2E),
 ("slides cut code", QZ, "    } else if (fence === null && /^ {0,3}-{3,}\\s*$/.test(ln)) {", "    } else if (/^ {0,3}-{3,}\\s*$/.test(ln)) {", "never inside code"),
 ("examples are questions", QZ, '    if (fence === null && f && (lang === "quiz" || testKinds.includes(lang))) {', '    if (f && (lang === "quiz" || testKinds.includes(lang))) {', "an example in a fence"),
 ("uses matches a prefix", CK, "(?<![A-Za-z0-9_])${word.replace(/[.*+?^${}()|[\\]\\\\]/g, \"\\\\$&\")}(?![A-Za-z0-9_])", "(?<![A-Za-z0-9_])${word.replace(/[.*+?^${}()|[\\]\\\\]/g, \"\\\\$&\")}", "existence, events, code and counts"),
 ("count ignores object", CK, "      const n = room.instances.filter((i) => i.object === o.id).length;", "      const n = room.instances.filter((i) => i.object !== \"\" || o).length;", "existence, events, code and counts"),
 ("keys never held", CK, "    for (const k of c.hold) run.hold(k, true);", "", "holding a key"),
 ("errors ignored", CK, "      return errs.length ? { ok: false, detail: `The game stopped with an error: ${errs[0]}` } : { ok: true, detail: \"\" };", "      return { ok: errs.length >= 0, detail: \"\" };", "an error in the game fails"),
 ("question points drift", QZ, "    } else if ((m = POINTS.exec(s))) q.points = parseFloat(m[1]!);", "    } else if ((m = POINTS.exec(s))) q.points = 1;", "every question case"),
 ("tests points drift", CK, "      line = line.slice(0, m.index).trimEnd();", "      line = line.trimEnd();", "every tests case"),
 ("check all sends nothing", "src/notes/TeacherNotes.tsx", "        await api(`/api/assignments/${slug}/tests/verify`, { json: { student: w.student, results } });", "        void results;", "notes: slides", E2E),
 ("check my work can't play", EP, "{ state: () => gameStateRef.current, errors: checkErrors.current }", '{ state: () => "crashed" as GameState, errors: checkErrors.current }', "notes: slides", E2E),
 ("notes tab closed", EP, '      openedNotes.current = true;\n      setBottom("notes");', "      openedNotes.current = true;", "notes: slides", E2E),
 # Phase 11b: tutorials
 ("highlight shown", TUP, "            return !h;", "            return true;", "are read: a header"),
 ("one step only", TUP, "  const cut = slides(body);", "  const cut = slides(body).slice(0, 1);", "are read: a header"),
 ("steps free by default", TUP, '      locked: !/^(no|false|off)$/i.test(fields.locked ?? ""),', '      locked: /^(yes)$/i.test(fields.locked ?? ""),', "are read: a header"),
 ("any highlight goes", TUP, '    if (s.highlight && !targets.some((tg) =>', '    if (s.highlight && ![...targets, s.highlight].some((tg) =>', "say what's wrong with one"),
 ("Next never locked", TP, "  const open = !t.meta.locked || !step.checks.length || at < progress.step || passedNow;", "  const open = t.meta.locked || !step.checks.length || at < progress.step || passedNow;", "Your First Game, step by step", E2E),
 ("progress not kept", EP, '(t) => mutate((d) => void (d.tutorial = t), { history: "skip" })', "(t) => void t", "Your First Game, step by step", E2E),
 ("no spotlight", TP, "{step.highlight && spot && <Spotlight", "{step.highlight && !spot && <Spotlight", "Your First Game, step by step", E2E),
 ("tutorial code copyable", "src/editor/app.css", ".notes-md code {\n  font-family: var(--mono, \"Ubuntu Mono\", monospace);\n  user-select: none;\n  -webkit-user-select: none;\n}", ".notes-md code {\n  font-family: var(--mono, \"Ubuntu Mono\", monospace);\n}", "code can't be selected", E2E),
 ("private tutorial seen", TU, '    return t.visibility == "classes" and t.owner_id in _teachers_of(db, user)', "    return True", "private at first", PY),
 ("site by anyone", TU, '    if vis == "site" and not _is_admin(user) and not (t is not None and t.visibility == "site"):', "    if False:", "only an admin publishes", PY),
 ("step XP repeats", TU, '"tutstep:%s:%d" % (key, n)', '"tutstep:%s:%d:%d" % (key, n, id(body))', "…once", PY),
 ("unchecked steps pay", TU, '        if checks.blocks(steps[n], "check"):', "        if True:", "a step with no check pays nothing", PY),
 ("assigned tutorial for anyone", TU, "        return grades.notes_of(a) if mine or a.teacher_id == user.id else None", "        return grades.notes_of(a)", "pays only those who have it", PY),
 ("tutorial path escapes", TU, '    if not re.fullmatch(r"[a-z0-9-]{1,40}", name or ""):', "    if not name:", "a tutorial that isn't", PY),
 ("tutorial checks not graded", GR, '    for t in checks.tests(notes_of(a)) + checks.tests(notes_of(a), "check"):', "    for t in checks.tests(notes_of(a)):", "its checks are what Check all checks", PY),
 ("games forget their tutorial", APP, '"tutorial": gamestore.tutorial_of(p.data)}', '"tutorial": None}', "My Games knows a game's tutorial", PY),
 ("tutorials not served", APP, '    r = send_from_directory(DIST / "tutorials", name)', '    r = send_from_directory(DIST / "tutorial", name)', "the built-in tutorials are served", PY),
 ("delete leaves answer keys", CL, "accounts.ClassroomPost, accounts.QuizAnswer,\n                      accounts.QuizQuestion, accounts.TestResult,", "accounts.ClassroomPost, accounts.QuizAnswer,\n                      accounts.TestResult,", "notes and all", PY),
 ("class delete leaves events", CL, "(accounts.ClassItem, accounts.Enrollment, accounts.ClassEvent, accounts.Visit, ClassSettings)", "(accounts.ClassItem, accounts.Enrollment, accounts.Visit, ClassSettings)", "had a random event can be deleted", PY),
 ("SQLite ignores foreign keys", APP, '        conn.execute("PRAGMA foreign_keys=ON")', '        conn.execute("PRAGMA foreign_keys=OFF")', "enforces foreign keys", PY),
 ("dark cursor", "src/editor/app.css", "  border-left-color: var(--code-text, var(--text)) !important;\n  border-left-width: 2px !important;\n}", "  border-left-width: 2px !important;\n}", "cursor shows on the dark theme", E2E),
 ("menu won't close", "src/editor/ObjectEditor.tsx", "    window.addEventListener(\"keydown\", key);\n    window.addEventListener(\"pointerdown\", away);", "    void key;\n    void away;", "Add event menu closes", E2E),
 ("notes spotlight ignored", "src/notes/NotesPane.tsx", "      {highlight && spot && <Spotlight", "      {highlight && !spot && <Spotlight", "notes: slides", E2E),
 ("highlight in code taken", TUP, "          if (fence !== null) return true;\n", "", "code is left alone"),
 # Phase 9½: game feel
 ("particles stand still", FX, "      this.x[p] = this.x[p]! + this.vx[p]!;\n      this.y[p] = this.y[p]! + this.vy[p]!;", "      this.x[p] = this.x[p]!;\n      this.y[p] = this.y[p]!;", "a burst makes its particles"),
 ("particles live forever", FX, "      if (--this.life[p]! <= 0) {", "      if (--this.life[p]! < -1e9) {", "a burst makes its particles"),
 ("no particle cap", FX, "      if (this.count >= MAX_PARTICLES) this.remove(0);", "      if (this.count >= MAX_PARTICLES * 2) this.remove(0);", "never holds more than MAX_PARTICLES"),
 ("weather follows rooms", FX, "    this.clear();\n    this.weather = null;\n    this.darkness = 0;", "    this.clear();\n    this.darkness = 0;", "a new room is clear"),
 ("room wipes its creates", EN, "    if (commands?.room !== undefined) this.setRoom(commands.room);\n    else this.updateCamera();\n    this.effects.apply(commands?.fx);\n    this.effects.lights = commands?.lights ?? [];", "    this.effects.apply(commands?.fx);\n    this.effects.lights = commands?.lights ?? [];\n    if (commands?.room !== undefined) this.setRoom(commands.room);\n    else this.updateCamera();", "survives the room starting"),
 ("lights linger", EN, "    this.effects.lights = commands?.lights ?? [];", "    if (commands?.lights) this.effects.lights = commands.lights;", "shines for the step it is called in"),
 ("no hit pause", BRG, "    if (this.engine.effects.pauseLeft > 0) {", "    if (this.engine.effects.pauseLeft > 1e9) {", "hit_pause freezes the whole game"),
 ("pause eats keys", BRG, "      this.engine.effects.pauseLeft--;\n      return null;", "      this.engine.effects.pauseLeft--;\n      this.engine.beginStep();\n      return null;", "pressed during a hit pause"),
 ("flash forever", EN, "      if (st[b + F.FLASH]! > 0) st[b + F.FLASH] = st[b + F.FLASH]! - 1;", "", "counting down"),
 ("glow reads as outline", RT, '            return "#%06x" % int(_st[b + F.OUTLINE_COLOR]) if _st[b + F.OUTLINE] == kind else None', '            return "#%06x" % int(_st[b + F.OUTLINE_COLOR]) if _st[b + F.OUTLINE] else None', "outline and glow are fields"),
 ("tween runs slow", RT, "        k = min(1.0, t[5] / t[4])", "        k = min(1.0, t[5] / (t[4] + 1))", "lands exactly"),
 ("tweens the dead", RT, "        if isinstance(target, GameObject) and not target._alive:\n            del _tweens[key]", "        if False:\n            del _tweens[key]", "destroyed just stops"),
 ("out_quad is in_quad", RT, '    "out_quad": lambda t: 1 - (1 - t) ** 2,', '    "out_quad": lambda t: t * t,', "out_quad is fast then slow"),
 ("the say key skips", RT, '        go = _dlg_age > 0 and (keyboard_check_pressed("space")', '        go = (keyboard_check_pressed("space")', "doesn't also skip it"),
 ("fade jumps", RT, "        _fade[0] = _fade[1] + (_fade[2] - _fade[1]) * (_fade[3] / _fade[4])", "        _fade[0] = _fade[2]", "darkens step by step"),
 ("alpha leaks", RT, "        _color = 0xFFFFFF\n        _alpha = 1.0", "        _color = 0xFFFFFF", "starts each Draw event solid"),
 ("restart keeps tweens", RT, "    _tweens.clear()\n    dialogue_clear()", "    dialogue_clear()", "game_restart starts the feel over"),
 ("shaders at two precisions", FEEL, '  GlProgram.from({ vertex: VERTEX, fragment, name, preferredVertexPrecision: "highp", preferredFragmentPrecision: "highp" });', "  GlProgram.from({ vertex: VERTEX, fragment, name });", "game feel is drawn", E2E),
 ("no flash filter", PXR, "      filters.push(look.flash);", "", "game feel is drawn", E2E),
 ("no darkness", FEEL, "    this.screen.visible = fx.darkness > 0;", "    this.screen.visible = false;", "game feel is drawn", E2E),
 ("particles hidden", FEEL, "      l.container.visible = n > 0;", "      l.container.visible = false;", "game feel is drawn", E2E),
 ("no screen effect", PXR, "      const f = name ? screenFilter(name) : null;", "      const f = name ? screenFilter(name + \"-off\") : null;", "game feel is drawn", E2E),
 ("no tint", PXR, "      sp.tint = st[b + F.TINT]!;", "", "game feel is drawn", E2E),
 ("turn in does nothing", "src/editor/AssignmentBits.tsx", "            await api(`/api/projects/${encodeURIComponent(projectId)}/turn-in`, { json: {} });", "            void 0;", "a class:", E2E),
 ("no read-only bar", EP, '          {store.kind === "view" ? (', "          {store.kind !== store.kind ? (", "a class:", E2E),
]
only = sys.argv[1:]
# A name that matches no case would otherwise run nothing and still say
# "ALL SABOTAGES CAUGHT" — which happened once, after a typo.
unknown = [n for n in only if n not in {c[0] for c in CASES}]
if unknown:
    sys.exit(f"No sabotage case called: {unknown}")
bad = []
for name, f, old, new, test, *extra in CASES:
    runner = [r for r in extra[:1] if r != "vitest"]  # "vitest" just holds the place for extra pairs
    more = extra[1:]  # further (old, new) pairs in the same file
    if only and name not in only: continue
    p = ROOT / f; src = p.read_text()
    pairs = [(old, new), *more]
    counts = [src.count(o) for o, _ in pairs]
    if counts != [1] * len(pairs):
        print(f"!! {name}: pattern found {counts} times"); bad.append(name); continue
    broken = src
    for o, n in pairs:
        broken = broken.replace(o, n)
    p.write_text(broken)
    try:
        if runner == [PY]:
            # No bytecode cache: Python trusts a .pyc whose source has the same
            # size and modification second, and two sabotages of equal length
            # made within one second would run the first one's code twice.
            import os, shutil
            shutil.rmtree(ROOT.parent / "backend/__pycache__", ignore_errors=True)
            r = subprocess.run([str(ROOT.parent / "backend/.venv/bin/python"), str(ROOT.parent / "backend/tests/test_server.py")],
                               capture_output=True, text=True, env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"})
            out = r.stdout + r.stderr
            failed = any(l.startswith("FAIL") and test in l for l in out.splitlines())
            ran = "ok   " in out or "FAIL " in out
        else:
            cmd = ["npx", "playwright", "test", "-g", test] if runner == [E2E] else ["npx", "vitest", "run", "-t", test]
            r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
            out = r.stdout + r.stderr
            failed = r.returncode != 0 and "failed" in out
            ran = "passed" in out or "failed" in out
        print(f"{'ok  ' if failed else 'MISS'} {name}  ->  '{test}'" + ("" if ran else "  (no test matched!)"))
        if not failed: bad.append(name)
    finally:
        p.write_text(src)
print("ALL SABOTAGES CAUGHT" if not bad else f"NOT CAUGHT: {bad}")
