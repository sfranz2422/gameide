"""
Can a level be finished? A route checker for the level maps.

It moves a box the size of the hero's collision box with the hero's own
physics — the numbers are read from game/_1config.py, so tuning the jump
re-checks every level — trying runs and jumps (held or tapped, steered
early or late, with or without the relic's second jump) from every place
it can stand, and collects every place it can reach. build.py then asks
the questions that make a level work:

  without the double jump: can the relic be reached? (else the level locks)
  with it: the key? with the key: the gate, the boss, the exit?

It is a model, not the game: no enemies, no knockback. Its answers are
"there is a way", which is what a broken map gets wrong.
"""
from pathlib import Path

TILE = 16
HALF_W, HEIGHT = 6, 38        # the hero's box around the feet (build.py: MASK)


def load_config(here):
    cfg = {}
    exec((here / "game" / "_1config.py").read_text(), cfg)
    return cfg


class Level:
    def __init__(self, rows, open_gate=False, broken_moss=True):
        self.rows, self.H, self.W = rows, len(rows), len(rows[0])
        solid = set()
        for r, row in enumerate(rows):
            for c, ch in enumerate(row):
                if ch in "#%" or (ch == "M" and not broken_moss):
                    solid.add((c, r))
                if ch == "D" and not open_gate:               # a gate is three tiles tall
                    solid.update({(c, r), (c, r - 1), (c, r - 2)})
        self.solid = solid
        self.planks = {(c, r) for r, row in enumerate(rows) for c, ch in enumerate(row) if ch == "="}
        self.water = {(c, r) for r, row in enumerate(rows) for c, ch in enumerate(row) if ch == "~"}

    def blocked(self, x, y):
        """The hero's box at feet (x, y) overlaps a solid tile (or leaves the map)."""
        x0, x1 = int((x - HALF_W) // TILE), int((x + HALF_W - 0.001) // TILE)
        y0, y1 = int((y - HEIGHT) // TILE), int((y - 0.001) // TILE)
        if x0 < 0 or x1 >= self.W or y1 >= self.H:
            return True
        for r in range(max(0, y0), y1 + 1):
            for c in range(x0, x1 + 1):
                if (c, r) in self.solid:
                    return True
        return False

    def wet(self, x, y):
        c0, c1 = int((x - HALF_W) // TILE), int((x + HALF_W - 0.001) // TILE)
        r = int((y - 1) // TILE)
        return any((c, r) in self.water for c in range(c0, c1 + 1))

    def plank_top(self, x, y, dy):
        if dy <= 0:
            return None
        top = int((y + dy) // TILE) * TILE
        if not (y <= top <= y + dy):
            return None
        r = top // TILE
        for px in (x - 5, x + 5):
            if (int(px // TILE), r) in self.planks:
                return top
        return None

    def standing(self, x, y):
        return self.blocked(x, y + 1) or self.plank_top(x, y, 1) is not None


def move_x(lv, x, y, dx):
    if dx == 0 or not lv.blocked(x + dx, y):
        return x + dx, dx != 0 and False
    step = 1 if dx > 0 else -1
    while not lv.blocked(x + step, y) and abs(step) <= abs(dx):
        x += step
    return x, True


def simulate(lv, cfg, x, y, steer, delay, hold, air_jump_at, drop=False, running=False):
    """
    One attempt from standing at (x, y): jump (unless hold == 0), steer
    `steer` (-1, 0, 1) from step `delay`, keep jump held for `hold` steps,
    second jump at step `air_jump_at` (or never). Returns where it lands, or
    None for water or nowhere in time. Also yields every point passed.
    """
    vx, vy = (steer * cfg["RUN_SPEED"] if running else 0.0), (-cfg["JUMP_SPEED"] if hold else 0.0)
    path = []
    drop_steps = 12 if drop else 0
    held_until = hold                     # jump is held until this step
    for t in range(240):
        d = steer if t >= delay else 0
        target = d * cfg["RUN_SPEED"]
        vx = min(vx + cfg["ACCEL"], target) if vx < target else max(vx - (cfg["ACCEL"] if d else cfg["DECEL"]), target)
        if air_jump_at is not None and t == air_jump_at:
            vy = -cfg["AIR_JUMP_SPEED"]
            held_until = t + 40           # the second jump is always held
        if vy < cfg["JUMP_CUT"] and t >= held_until:
            vy = cfg["JUMP_CUT"]
        x, hit = move_x(lv, x, y, vx)
        if hit:
            vx = 0
        vy = min(vy + cfg["GRAVITY"], cfg["MAX_FALL"])
        top = lv.plank_top(x, y, vy) if drop_steps <= 0 else None
        drop_steps -= 1
        if top is not None:
            y, vy = top, 0.0
        elif lv.blocked(x, y + vy):
            s = 1 if vy > 0 else -1
            while not lv.blocked(x, y + s):
                y += s
            landed = vy > 0
            vy = 0.0
            if landed:
                return (x, y), path
        else:
            y += vy
        path.append((x, y))
        if lv.wet(x, y) or y > lv.H * TILE:
            return None, path
        if t > 3 and vy == 0 and lv.standing(x, y):
            return (x, y), path
    return None, path


def runway(lv, x, y, back):
    """Room to get up to full speed: about three tiles of floor behind, going `back`."""
    for i in range(1, 7):
        bx = x + back * i * 8
        if lv.blocked(bx, y) or not lv.standing(bx, y):
            return False
    return True


def reachable(rows, start, cfg, double_jump=False, open_gate=False):
    """Every (column, row) cell the hero's feet can be in, from `start` (feet x, y)."""
    lv = Level(rows, open_gate=open_gate)
    seen_states, cells = set(), set()
    queue = [start]
    tries = []
    for steer in (-1, 0, 1):
        for delay in (0, 10):
            for hold in (0, 6, 40):                 # walk off / tap / full jump
                for air in ((None, 10, 18, 26) if double_jump and hold else (None,)):
                    tries.append((steer, delay, hold, air, False))
    # Running jumps: already at full speed, as after a run-up. Only from
    # where there is room behind to run (checked when they are tried).
    for steer in (-1, 1):
        for air in ((None, 10, 18, 26) if double_jump else (None,)):
            tries.append((steer, 0, 40, air, True))
    while queue:
        x, y = queue.pop()
        key = (round(x / 6), round(y))
        if key in seen_states:
            continue
        seen_states.add(key)
        cells.add((int(x // TILE), int((y - 1) // TILE)))
        # Walking: a few pixels each way, keeps standing positions dense.
        for d in (-1, 1):
            nx, hit = move_x(lv, x, y, d * 6)
            if not hit and lv.standing(nx, y):
                queue.append((nx, y))
        options = list(tries)
        if lv.plank_top(x, y, 1) is not None and not lv.blocked(x, y + 1):
            options.append(("drop", 0, 0, None, False))
        for steer, delay, hold, air, running in options:
            if steer == "drop":
                end, path = simulate(lv, cfg, x, y, 0, 0, 0, None, drop=True)
            elif running and not runway(lv, x, y, -steer):
                continue
            else:
                end, path = simulate(lv, cfg, x, y, steer, delay, hold, air, running=running)
            for px, py in path:
                cells.add((int(px // TILE), int((py - 1) // TILE)))
                cells.add((int(px // TILE), int((py - 20) // TILE)))   # the hero's middle touches things too
            if end is not None:
                queue.append(end)
    return cells


def find(rows, ch):
    return [(c, r) for r, row in enumerate(rows) for c, x in enumerate(row) if x == ch]


def check(rows, cfg):
    """
    The questions that make a level work, asked in the order the level is
    played: from the start without the relic; from the relic with its
    double jump; from the key with the gate open. Returns problems, in words.
    """
    problems = []
    feet = lambda cell: (cell[0] * TILE + TILE // 2, (cell[1] + 1) * TILE)
    near = lambda cells, t: any((t[0] + dc, t[1] + dr) in cells for dc in (-1, 0, 1) for dr in (-2, -1, 0, 1))
    (start,) = find(rows, "P")
    relics, keys, exits = find(rows, "R"), find(rows, "k"), find(rows, "X")
    plain = reachable(rows, feet(start), cfg)
    seen = set(plain)
    if relics and not near(plain, relics[0]):
        problems.append("the relic can't be reached from the start")
    if relics and keys and near(plain, keys[0]):
        problems.append("the key can be reached without the double jump (the relic is skippable)")
    if relics:
        jumping = reachable(rows, feet(relics[0]), cfg, double_jump=True)
        seen |= jumping
        if not near(jumping, start):
            problems.append("from the relic there is no way back to the start")
    else:
        jumping = plain
    if keys and not near(jumping, keys[0]):
        problems.append("the key can't be reached with the double jump")
    if exits and keys and near(jumping, exits[0]):
        problems.append("the exit can be reached without opening the gate")
    full = reachable(rows, feet(keys[0]) if keys else feet(start), cfg, double_jump=bool(relics), open_gate=True)
    seen |= full
    for ch, what in (("T", "the boss's trigger"), ("X", "the exit")):
        for t in find(rows, ch):
            if not near(full, t):
                problems.append(f"{what} can't be reached once the gate is open")
    for ch, what in (("C", "a checkpoint"), ("H", "the heart"), ("c", "a coin"), ("h", "a potion"), ("M", "a moss wall")):
        missing = [t for t in find(rows, ch) if not near(seen, t)]
        if missing:
            problems.append(f"{what} out of reach at {missing[:4]}")
    return problems
