# script: screen
# Words, panels and icons, shared by every screen. Every thing's picture is a
# sprite called icon_<key> (build.py), with its middle as its origin.
import math

INK, SHADOW, GOLD, DIM, MINT, RED = "#ffffff", "#2a1a3a", "#ffd23f", "#d8d0ea", "#9ff0c0", "#ff7a6a"
PANEL_X = 680               # the collection's panel, right of the world and the bench
WORLD_H = 226               # the little world, along the top on the left
CELL = 66                   # a collection slot
COLS, ROWS = 5, 6           # the collection shows a group in this many slots


def text(x, y, words, colour=INK, size=16, align="left", width=None):
    """Words with a shadow, so they read on a busy picture."""
    draw_set_font("Ubuntu", size)
    draw_set_halign(align)
    draw_set_color(SHADOW)
    draw_text(x + 2, y + 2, words, width)
    draw_set_color(colour)
    draw_text(x, y, words, width)
    draw_set_halign("left")


def panel(x1, y1, x2, y2, alpha=0.92, fill="#3a2a5a", edge="#c8b8ff"):
    draw_set_alpha(alpha)
    draw_set_color(fill)
    draw_rect(x1, y1, x2, y2)
    draw_set_alpha(1)
    draw_set_color(edge)
    draw_rect(x1, y1, x2, y2, True)


def group_colour(group):
    return next(c for g, _, c in GROUPS if g == group)


def icon(key, x, y, size=1.0, alpha=1.0, angle=0):
    """A thing's icon with its middle at (x, y); size 1 is ICON pixels across."""
    draw_sprite_ext(f"icon_{key}", 0, x, y, size, size, angle, "white", alpha)


def tile(key, x, y, w, lit=False):
    """A thing in a slot: a soft square in its group's colour, gold-edged when it makes
    nothing more, and its name under it."""
    draw_set_alpha(0.35 if not lit else 0.6)
    draw_set_color(group_colour(group_of(key)))
    draw_rect(x + 3, y + 3, x + w - 3, y + w - 3)
    draw_set_alpha(1)
    if is_final(key):
        draw_set_color(GOLD)
        draw_rect(x + 3, y + 3, x + w - 3, y + w - 3, True)
        draw_rect(x + 4, y + 4, x + w - 4, y + w - 4, True)
    icon(key, x + w / 2, y + w / 2 - 6, (w - 22) / ICON)
    text(x + w / 2, y + w - 17, name_of(key), INK, 10, "center")


def medal(x, y, r, colour, got):
    """An achievement's badge: a round medal with a ribbon, grey until it's earned."""
    c = colour if got else "#6a6478"
    draw_set_color("#c0392b" if got else "#4a4458")
    draw_triangle(x - r * 0.6, y, x - r * 0.1, y, x - r * 0.5, y + r * 1.6)
    draw_triangle(x + r * 0.6, y, x + r * 0.1, y, x + r * 0.5, y + r * 1.6)
    draw_set_color(GOLD if got else "#8a8498")
    draw_circle(x, y, r)
    draw_set_color(c)
    draw_circle(x, y, r * 0.78)
    draw_set_color("#ffffff")
    draw_set_alpha(0.35)
    draw_circle(x - r * 0.25, y - r * 0.3, r * 0.22)
    draw_set_alpha(1)
