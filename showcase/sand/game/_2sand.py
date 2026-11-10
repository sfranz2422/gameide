# script: sand
# The rules: what a pour is, when a tube is done, when the level is. solve.py
# (the build's checker) pours by exactly these rules, and the build tries the two
# side by side, so change one and change both.
import math

VIEW_W, VIEW_H = 1024, 576
COLOURS = {
    "R": "#e5473b", "O": "#f39a2b", "Y": "#f4d23c", "G": "#4cae4f", "C": "#3cc6d0",
    "B": "#3a6fd8", "P": "#8a4fd0", "K": "#f27fb8", "W": "#f2ece0", "N": "#8a5a35",
}
HIDDEN_COLOUR = "#4a4252"

# How a tube is drawn: its mouth is the sprite's origin, and its sand goes up
# from SAND_BOTTOM, LAYER_H a layer.
LAYER_H = 30
SAND_BOTTOM = 140
LIFT = 20              # how far a picked-up tube rises
ROW_Y = (120, 330)     # where the mouths are, for one row or two
ONE_ROW = 7            # more tubes than this and they go in two rows


def top_run(sand):
    """The colour on top, and how many layers of it there are in a row."""
    if not sand:
        return None, 0
    colour = sand[-1]
    n = 0
    for c in reversed(sand):
        if c != colour:
            break
        n += 1
    return colour, n


def can_pour(src, dst):
    """Sand goes onto the same colour, or into an empty tube, and only if there's room."""
    colour, n = top_run(src)
    if n == 0 or len(dst) >= CAP:
        return False
    return not dst or dst[-1] == colour


def pour_amount(src, dst):
    """How many layers go: the whole run of one colour, or as much as fits."""
    colour, n = top_run(src)
    return min(n, CAP - len(dst))


def pour(src, dst):
    """Moves the sand (both are lists, changed in place). Says how many layers went."""
    k = pour_amount(src, dst)
    for _ in range(k):
        dst.append(src.pop())
    return k


def tube_done(sand):
    return len(sand) == CAP and len(set(sand)) == 1


def all_done(tubes):
    return all(not t.sand or tube_done(t.sand) for t in tubes)


def useful_pours(tubes):
    """Every pour that changes something: one colour poured into an empty tube doesn't."""
    out = []
    for a in tubes:
        colour, n = top_run(a.sand)
        for b in tubes:
            if a is not b and can_pour(a.sand, b.sand) and not (not b.sand and n == len(a.sand)):
                out.append((a, b))
    return out


def stars_for(pours, par, extra_tube):
    """Three near par, two for a fair few more, one for finishing. The extra tube costs the third."""
    stars = 3 if pours <= round(par * 1.2) + 1 else 2 if pours <= round(par * 1.6) + 2 else 1
    return min(stars, 2) if extra_tube else stars


def points_for(par, stars):
    """Bigger levels are worth more."""
    return 10 * par * stars


def spots(n):
    """Where n tubes' mouths go: one row, or two with the extra tube in the top one."""
    if n <= ONE_ROW:
        rows = [n]
    else:
        rows = [(n + 1) // 2, n // 2]
    out = []
    for r, count in enumerate(rows):
        gap = min(120, 900 / count)
        y = ROW_Y[r] if len(rows) == 2 else 190
        for k in range(count):
            out.append((VIEW_W / 2 + (k - (count - 1) / 2) * gap, y))
    return out


def shown_layers(sand, drain=0.0, drain_colour=None, pending=0.0):
    """
    What a tube shows mid-pour, as (colour, how much of a layer) from the bottom.
    The pour has already happened in .sand; drain is sand still to leave this tube
    on screen, pending is sand still to arrive.
    """
    out = [[c, 1.0] for c in sand]
    left = drain
    while left > 1e-9:
        out.append([drain_colour, min(1.0, left)])
        left -= 1.0
    left = pending
    while left > 1e-9 and out:
        take = min(out[-1][1], left)
        out[-1][1] -= take
        left -= take
        if out[-1][1] <= 1e-9:
            out.pop()
    return [(c, k) for c, k in out]


GO_STEPS = 16          # to carry a tube over, and to bring it back
FLOW_STEPS = 14        # for each layer of sand to run
TILT = 100             # how far a pouring tube tips, in degrees


def surface_y(tube):
    """Where the sand's top is in an upright tube: where pouring sand lands."""
    return tube.y + SAND_BOTTOM - len(tube.sand) * LAYER_H + tube.pending * LAYER_H


def pour_place(src, dst):
    """
    Where a pouring tube's mouth goes, and which way it tips: it leans back the way
    it came, so it never swings across the tube it pours into, and a tube at
    either end of a row is only ever poured into from the middle's side.
    """
    from_left = src.home_x < dst.home_x
    return dst.home_x + (-10 if from_left else 10), dst.home_y - 36, -TILT if from_left else TILT
