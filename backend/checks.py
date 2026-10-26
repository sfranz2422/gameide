"""
The tests in an assignment's notes (```tests) and the checks in a tutorial's
steps (```check): one test per line, in GameIDE's check language —

    object Player exists                     also sprite, room, sound, font, script, tileset
    Player has sprite
    Player has event step                    the event's name as the editor shows it
    Player.step uses keyboard_check          or "Player uses …", or "uses …" anywhere; "avoids …"
    room Level1 has 3 Coin                   or "has at least 3 Coin"
    game runs 2 seconds without errors
    after 1 second holding right, Player.x increased
    after 2 seconds, instance_number("Coin") < 15
    # a comment

Each is worth 1 point, or "(2 points)" at the end of its line says so.

THE CHECKS RUN IN A BROWSER, NEVER HERE — the server never runs a game
(frontend/src/checks/checks.ts runs them). All the server needs is what a
block holds: each line's label and its points, for the points an assignment
is worth and for paying a student's own check only for a test that's really
there. checks.ts reads a block exactly as this does; the server checks run
both on the same cases (frontend/src/checks/check-cases.json).
"""
import re

FENCE = re.compile(r"^ {0,3}(`{3,}|~{3,})(.*)$")
POINTS = re.compile(r"\s*\((\d{1,4}(?:\.\d{1,2})?)\s*points?\)\s*$", re.I)


def blocks(md, kind="tests"):
    """The text of every ```<kind> block in some markdown, in order."""
    out, lines, i = [], str(md or "").replace("\r\n", "\n").split("\n"), 0
    while i < len(lines):
        f = FENCE.match(lines[i])
        if f and f.group(2).strip().lower() == kind:
            fence, body, i = f.group(1), [], i + 1
            while i < len(lines):
                g = FENCE.match(lines[i])
                if g and g.group(1)[0] == fence[0] and len(g.group(1)) >= len(fence) and not g.group(2).strip():
                    break
                body.append(lines[i])
                i += 1
            out.append("\n".join(body))
        i += 1
    return out


def parse(body):
    """[{label, points}] for one block: every line that isn't blank or a comment."""
    out = []
    for raw in str(body or "").split("\n"):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        points = 1.0
        m = POINTS.search(line)
        if m:
            points = float(m.group(1))
            line = line[:m.start()].rstrip()
        line = " ".join(line.split())
        if line:
            out.append({"label": line, "points": points})
    return out


def tests(md, kind="tests"):
    """Every test in some markdown, each label once (the first wins)."""
    seen, out = set(), []
    for body in blocks(md, kind):
        for t in parse(body):
            if t["label"] not in seen:
                seen.add(t["label"])
                out.append(t)
    return out
