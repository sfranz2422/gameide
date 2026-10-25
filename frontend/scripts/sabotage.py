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
 ("param renamed", RT, "def draw_text(x, y, text):\n    if _check_draw(\"draw_text\"):\n        _draw.append([\"text\", _draw_depth, x, y, str(text), _color])", "def draw_text(x, y, txt):\n    if _check_draw(\"draw_text\"):\n        _draw.append([\"text\", _draw_depth, x, y, str(txt), _color])", "matches runtime.py"),
 ("undocumented function", RT, '    "show_debug",\n]', '    "show_debug", "point_distance2",\n]\npoint_distance2 = lambda a, b: 0', "matches runtime.py"),
 ("default differs", RT, 'def mouse_check(button="left"):', 'def mouse_check(button="right"):', "matches runtime.py"),
 ("property undocumented", "src/catalog/api.ts", '  { name: "depth", description: "Lower depth draws on top." },\n', "", "only properties"),
 ("far edge inclusive", "src/engine/spatialHash.ts", "    const cx1 = Math.max(cx0, Math.ceil(right / cs) - 1);\n    const cy1 = Math.max(cy0, Math.ceil(bottom / cs) - 1);\n    const r = this.ranges;", "    const cx1 = Math.floor(right / cs);\n    const cy1 = Math.floor(bottom / cs);\n    const r = this.ranges;", "far edge as exclusive"),
 ("duplicates", "src/engine/spatialHash.ts", "          if (stamps[s] === stamp) continue;", "", "once per query"),
 ("remove leaves it", "src/engine/spatialHash.ts", "          bucket[i] = bucket[bucket.length - 1]!;\n          bucket.pop();", "", "moves and removes"),
 ("no mirror swap", "src/engine/sprites.ts", "  out.left = l < r ? l : r;\n  out.right = l < r ? r : l;", "  out.left = l;\n  out.right = r;", "mirror when the scale"),
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
 ("no isolation", "vite.config.ts", '  "Cross-Origin-Embedder-Policy": "credentialless",', "", "stopped at its line", E2E),
]
only = sys.argv[1:]
bad = []
for name, f, old, new, test, *extra in CASES:
    runner = extra[:1]
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
