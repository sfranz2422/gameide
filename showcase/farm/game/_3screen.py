# script: screen
# The isometric map's arithmetic, and words, panels and icons for the screen.
# Every picture is a sprite named as the build names it, with the middle of the
# ground diamond it stands on as its origin: so pic("barn", x, y) stands the barn
# on the tile whose middle is (x, y).
import math

INK, SHADOW, GOLD, DIM, MINT, RED = "#ffffff", "#2a1a08", "#ffd23f", "#f3e8cc", "#9ff0a0", "#ff6b5f"
PANEL, EDGE = "#5a3a1c", "#ffd98a"


# ---- the map

def tile_xy(gx, gy):
    """The middle of tile (gx, gy) in the world (fractions too: a 2 × 2 building's middle)."""
    return ORIGIN_X + (gx - gy) * TILE_W / 2, ORIGIN_Y + (gx + gy) * TILE_H / 2


def tile_at(x, y):
    """The tile a world point is on, or None off the map."""
    a = (x - ORIGIN_X) / (TILE_W / 2)
    b = (y - ORIGIN_Y) / (TILE_H / 2)
    gx, gy = math.floor((a + b) / 2 + 0.5), math.floor((b - a) / 2 + 0.5)
    return (gx, gy) if on_map(gx, gy) else None


def building_xy(kind, gx, gy):
    """Where a building stands: the middle of its footprint (its top corner at gx, gy)."""
    half = (FOOTPRINT[kind] - 1) / 2
    return tile_xy(gx + half, gy + half)


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


def gui_mouse():
    """The pointer on the screen (the HUD and panels), not in the world."""
    return mouse_x - view_x, mouse_y - view_y


# ---- words and panels

def text(x, y, words, colour=INK, size=16, align="left", width=None):
    """Words with a shadow, so they read on a busy picture."""
    draw_set_font("Ubuntu", size)
    draw_set_halign(align)
    draw_set_color(SHADOW)
    draw_text(x + 2, y + 2, words, width)
    draw_set_color(colour)
    draw_text(x, y, words, width)
    draw_set_halign("left")


def plain(x, y, words, colour="#5a3a1c", size=14, align="left"):
    """Words with no shadow, for a light card: dark words with a dark shadow on cream
    looked doubled (the seed bar's "free", 2026-11-17)."""
    draw_set_font("Ubuntu", size)
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


def crop_icon(item):
    return item              # the crops' icons are named for them: icon_wheat, icon_corn…
