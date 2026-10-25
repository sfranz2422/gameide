"""
The house rule, made repeatable: every check must have been watched to fail.

Each case below breaks one thing a test guards (a one-line edit to the
source), runs only the test that should notice, confirms it FAILS, and puts
the source back. Run it after changing a test or the code it guards:

    python3 scripts/sabotage.py                 # every case
    python3 scripts/sabotage.py "gravity sign"  # just these

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
]
only = sys.argv[1:]
bad = []
for name, f, old, new, test in CASES:
    if only and name not in only: continue
    p = ROOT / f; src = p.read_text()
    if src.count(old) != 1:
        print(f"!! {name}: pattern found {src.count(old)} times"); bad.append(name); continue
    p.write_text(src.replace(old, new))
    try:
        r = subprocess.run(["npx", "vitest", "run", "-t", test], cwd=ROOT, capture_output=True, text=True)
        out = r.stdout + r.stderr
        failed = r.returncode != 0 and "failed" in out
        ran = "passed" in out or "failed" in out
        print(f"{'ok  ' if failed else 'MISS'} {name}  ->  '{test}'" + ("" if ran else "  (no test matched!)"))
        if not failed: bad.append(name)
    finally:
        p.write_text(src)
print("ALL SABOTAGES CAUGHT" if not bad else f"NOT CAUGHT: {bad}")
