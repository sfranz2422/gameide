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
CM, BS = "src/editor/codeMode.tsx", "src/blocks/blockState.ts"
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
 ("param renamed", RT, "def draw_text(x, y, text):\n    if _check_draw(\"draw_text\"):\n        _draw_list.append([\"text\", _draw_depth, x, y, str(text), _color])", "def draw_text(x, y, txt):\n    if _check_draw(\"draw_text\"):\n        _draw_list.append([\"text\", _draw_depth, x, y, str(txt), _color])", "matches runtime.py"),
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
 ("anyone reads any project", APP, "    if p.owner_id != user.id:\n        # Teachers", "    if False:\n        # Teachers", "someone else's project can't be read", PY),
 ("id hijack", APP, "            if p.owner_id != user.id:\n                # The id is someone else's", "            if False:\n                # The id is someone else's", "its id is taken", PY),
 ("replaced not kept", APP, '                _snapshot(db, p, "replaced", "Replaced by a save from another tab or computer")\n', "", "what it replaced is kept", PY),
 ("not unpacked", APP, '        if isinstance(data, dict) and set(data) == {"_packed"}:', "        if False:", "a packed body", PY),
 ("any file is a picture", "../backend/gamestore.py", "    return None\n\n\nclass GameProject", '    return "image/png"\n\n\nclass GameProject', "isn't a picture is refused", PY),
 ("asset overwritten", APP, '            return jsonify(ok=True) if existing.data == data else err("That picture id is already used.", 409)', "            return jsonify(ok=True)", "different bytes can't take", PY),
 ("no project size limit", APP, "        if size > gamestore.MAX_PROJECT_BYTES:", "        if size > gamestore.MAX_PROJECT_BYTES * 100:", "over the limit is refused, with the sizes", PY),
 ("never pruned", APP, "        if old:\n            db.query(GameVersion)", "        if old and False:\n            db.query(GameVersion)", "pruned to the newest", PY),
 ("snapshot every save", APP, "                if last_auto is None or (", "                if True or (", "within the interval", PY),
 ("restore not undoable", APP, '        _snapshot(db, p, "restore", f"Before going back', '        0 and _snapshot(db, p, "restore", f"Before going back', "keeps what was there before the restore", PY),
 ("polls count", APP, '    return not (request.method == "GET" and request.path.startswith("/api/"))', "    return True", "polling (a GET to /api/) is not activity", PY),
 ("teachers idle out", APP, '    if not uid or session.get("teacher"):', "    if not uid:", "a teacher is never signed out", PY),
 ("dev login on server", APP, 'DEV_LOGIN = os.environ.get("GAMEIDE_DEV_LOGIN") == "1" and not os.environ.get("DATABASE_URL")', 'DEV_LOGIN = os.environ.get("GAMEIDE_DEV_LOGIN") == "1"', "dev sign-in is off", PY),
 ("open redirect", APP, '    return nxt if nxt.startswith("/") and not nxt.startswith("//") else ""', '    return nxt if nxt.startswith("/") else ""', "never redirects off the site", PY),
 ("not isolated", APP, "        response.headers.setdefault(k, v)", "        pass", "cross-origin isolated", PY),
 ("deleted still listed", APP, "        rows = (db.query(GameProject).filter_by(owner_id=user.id).filter(GameProject.deleted_at.is_(None))", "        rows = (db.query(GameProject).filter_by(owner_id=user.id)", "a deleted project leaves the list", PY),
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
