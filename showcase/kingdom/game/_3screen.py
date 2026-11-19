# script: screen
# The isometric map's arithmetic, and words, panels and icons for the screen.
# Every picture is a sprite named as the build names it, with the middle of the
# ground diamond it stands on as its origin: so a building's picture drawn at the
# middle of its footprint stands on it. (Cloverbrook's, with its own sizes.)
import math

INK, SHADOW, GOLD, DIM, MINT, RED = "#ffffff", "#141414", "#f2c94c", "#e4ddd0", "#9fe0a0", "#ff6b5f"
FOOD = "#c9e27a"
PANEL, EDGE = "#2c2a26", "#b49b6a"          # dark slate and worn brass: plainer than Cloverbrook's


# ---- the map

def tile_xy(gx, gy):
    """The middle of tile (gx, gy) in the world (fractions too: a 2 × 2 building's middle)."""
    return ORIGIN_X + (gx - gy) * TILE_W / 2, ORIGIN_Y + (gx + gy) * TILE_H / 2


def tile_frac(x, y):
    """The tile a world point is on, in fractions (a troop can stand anywhere on one)."""
    a = (x - ORIGIN_X) / (TILE_W / 2)
    b = (y - ORIGIN_Y) / (TILE_H / 2)
    return (a + b) / 2, (b - a) / 2


def tile_at(x, y):
    """The tile a world point is on, or None off the map."""
    a = (x - ORIGIN_X) / (TILE_W / 2)
    b = (y - ORIGIN_Y) / (TILE_H / 2)
    gx, gy = math.floor((a + b) / 2 + 0.5), math.floor((b - a) / 2 + 0.5)
    return (gx, gy) if on_map(gx, gy) else None


def building_xy(kind, gx, gy):
    """Where a building stands: the middle of its footprint (its top corner at gx, gy)."""
    half = (BUILDINGS[kind]["size"] - 1) / 2
    return tile_xy(gx + half, gy + half)


def bubble(b):
    """A mine's or farm's "ready to collect" bubble, or None: from BUBBLE_FROM of what it
    holds (or BUBBLE_LEAST), above the building, where (world) and how big (world units for
    BUBBLE_R on the screen: the same size at any zoom; drawn in the world, it was a speck at
    the starting zoom and nobody knew to collect), and whether it's full (it's stopped filling)."""
    if not maker(b):
        return None
    n = waiting(b)
    hold = stat(b["kind"], "hold", b["level"]) if b["level"] else 0
    if n <= 0 or n < min(hold * BUBBLE_FROM, BUBBLE_LEAST):
        return None
    x, y = building_xy(b["kind"], b["gx"], b["gy"])
    z = zoom()
    return {"x": x, "y": y - info(b["kind"])["size"] * TILE_H / 2 - 60 / z, "r": BUBBLE_R / z, "full": n >= hold}


def bubble_hit(r, wx, wy):
    """The building whose bubble is at a world point (a tap on it collects), or None."""
    for b in r["buildings"]:
        bb = bubble(b)
        if bb and (wx - bb["x"]) ** 2 + (wy - bb["y"]) ** 2 <= (bb["r"] * 1.3) ** 2:
            return b
    return None


def diamond(x, y, colour, alpha=1.0, tiles=1, outline=False):
    """A tile's diamond, filled or outlined, centred on (x, y)."""
    w, h = TILE_W * tiles / 2, TILE_H * tiles / 2
    draw_set_alpha(alpha)
    draw_set_color(colour)
    if outline:
        for a, b in (((x, y - h), (x + w, y)), ((x + w, y), (x, y + h)), ((x, y + h), (x - w, y)), ((x - w, y), (x, y - h))):
            draw_line(a[0], a[1], b[0], b[1], 3)
    else:
        draw_triangle(x, y - h, x + w, y, x, y + h)
        draw_triangle(x, y - h, x, y + h, x - w, y)
    draw_set_alpha(1)


def zoom():
    """How far in the view is now, from what the engine shows (view_width is how much of
    the room is on screen). Read from the engine, not the Realm's setting: the title isn't
    zoomed, and scaling the pointer by the Realm's zoom there missed the Play button."""
    return VIEW_W / view_width if view_width else 1


def to_screen(x, y):
    """A point in the world, on the screen (Draw GUI's pixels): zoomed out, the world is
    drawn smaller but the bar and windows aren't."""
    return (x - view_x) * zoom(), (y - view_y) * zoom()


def gui_mouse():
    """The pointer on the screen (the HUD and panels), not in the world."""
    return to_screen(mouse_x, mouse_y)


# ---- words and panels

def text(x, y, words, colour=INK, size=16, align="left", width=None):
    """Words with a shadow, so they read on a busy picture (TEXT_SCALE bigger than asked)."""
    size = round(size * TEXT_SCALE)
    draw_set_font("Lilita", size)
    draw_set_halign(align)
    draw_set_color(SHADOW)
    draw_text(x + 2, y + 2, words, width)
    draw_set_color(colour)
    draw_text(x, y, words, width)
    draw_set_halign("left")


def plain(x, y, words, colour="#5a3a1c", size=14, align="left"):
    """Words with no shadow, for a light card: dark words with a dark shadow on cream
    looked doubled (the seed bar's "free", 2026-11-17)."""
    draw_set_font("Lilita", size)
    draw_set_halign(align)
    draw_set_color(colour)
    draw_text(x, y, words)
    draw_set_halign("left")


def panel(x1, y1, x2, y2, alpha=0.95):
    draw_set_alpha(alpha)
    draw_set_color(PANEL)
    draw_rect(x1, y1, x2, y2)
    draw_set_alpha(1)
    draw_set_color(EDGE)
    draw_rect(x1, y1, x2, y2, True)
    draw_rect(x1 + 1, y1 + 1, x2 - 1, y2 - 1, True)


def icon(name, x, y, size=48, alpha=1.0):
    """One of the icons (drawn 64 across), `size` pixels across, its middle at (x, y)."""
    draw_sprite_ext(f"icon_{name}", 0, x, y, size / 64, size / 64, 0, "white", alpha)


def clock_words(seconds):
    s = int(math.ceil(seconds))
    if s >= 3600:
        return f"{s // 3600}h {s % 3600 // 60}m"
    if s >= 60:
        return f"{s // 60}m {s % 60:02d}s"
    return f"{s}s"


def tier(level):
    """Which of a building's three pictures: levels 1-3, 4-6, then 7 on."""
    return 1 if level <= TIERS[0] else 2 if level <= TIERS[1] else 3


def big_number(n):
    """12345 -> "12,345": the kingdom's numbers grow long."""
    return f"{int(n):,}"
