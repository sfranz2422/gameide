# script: screen
# Words, ribbons, plates and the sandwich itself, shared by every screen. Every
# picture is a sprite named as the build names it, with its middle as its origin:
#   layer_<key>  bottom_<bread>  top_<bread>   (one frame per bite: frame 1 has one bite gone)
#   loaf_<bread>  bottle_<sauce>  side_<side> (a frame per bite)  drink_<drink>  kitchen  book
import math

INK, SHADOW, GOLD, RED, CREAM, DIM = "#ffffff", "#5a2a10", "#ffd23f", "#e8432e", "#fff4dc", "#f3e2c0"
SUN_1, SUN_2 = "#ffb42a", "#ffc94d"      # the sunburst's two yellows
RIBBONS = ["#c2329a", "#3a6fd0", "#d8432b", "#2f9a54", "#8e44c8", "#e08a1a"]


def text(x, y, words, colour=INK, size=16, align="left", width=None):
    """Words with a shadow, so they read on a busy picture."""
    draw_set_font("Ubuntu", size)
    draw_set_halign(align)
    draw_set_color(SHADOW)
    draw_text(x + 2, y + 2, words, width)
    draw_set_color(colour)
    draw_text(x, y, words, width)
    draw_set_halign("left")


def panel(x1, y1, x2, y2, alpha=0.92, fill="#7a3a16", edge="#ffd98a"):
    draw_set_alpha(alpha)
    draw_set_color(fill)
    draw_rect(x1, y1, x2, y2)
    draw_set_alpha(1)
    draw_set_color(edge)
    draw_rect(x1, y1, x2, y2, True)
    draw_rect(x1 + 1, y1 + 1, x2 - 1, y2 - 1, True)


def sunburst(cx, cy, t, rays=16):
    """The turning rays behind the title and the bread: two yellows."""
    draw_set_color(SUN_1)
    draw_rect(0, 0, VIEW_W, VIEW_H)
    draw_set_color(SUN_2)
    turn = t * 0.003
    for i in range(rays):
        a1 = turn + i * 2 * math.pi / rays
        a2 = a1 + math.pi / rays
        draw_triangle(cx, cy, cx + 1400 * math.cos(a1), cy + 1400 * math.sin(a1),
                      cx + 1400 * math.cos(a2), cy + 1400 * math.sin(a2))
    # a soft glow in the middle
    for r, a in ((260, 0.12), (170, 0.16), (90, 0.2)):
        draw_set_alpha(a)
        draw_set_color("#fff8d8")
        draw_circle(cx, cy, r)
    draw_set_alpha(1)


def ribbon(cx, cy, wide, words, colour, size=17):
    """A banner with notched tails, the look of the bread and filling names."""
    h = size * 1.7
    x1, x2 = cx - wide / 2, cx + wide / 2
    top, bottom = cy - h / 2 + 7, cy + h / 2 + 7
    for sx, tip in ((x1, -1), (x2, 1)):
        out, notch = sx + tip * 26, sx + tip * 14
        for shade, a in ((colour, 1), ("#000000", 0.35)):
            draw_set_color(shade)
            draw_set_alpha(a)
            draw_triangle(sx, top, out, top, notch, (top + bottom) / 2)
            draw_triangle(sx, top, notch, (top + bottom) / 2, sx, bottom)
            draw_triangle(sx, bottom, notch, (top + bottom) / 2, out, bottom)
    draw_set_alpha(1)
    draw_set_color(colour)
    draw_rect(x1, cy - h / 2, x2, cy + h / 2)
    draw_set_color("#ffffff")
    draw_set_alpha(0.25)
    draw_rect(x1, cy - h / 2 + 2, x2, cy - h / 2 + 6)
    draw_set_alpha(1)
    draw_set_color("#3a1030")
    draw_rect(x1, cy - h / 2, x2, cy + h / 2, True)
    text(cx, cy - size * 0.62, words, INK, size, "center")


def round_plate(cx, cy, r, lit=False):
    """One of the shelf's plates."""
    draw_set_alpha(0.25)
    draw_set_color("#000000")
    draw_ellipse(cx - r + 4, cy - r + 8, cx + r + 4, cy + r + 10)
    draw_set_alpha(1)
    draw_set_color("#fffdf7" if not lit else "#fff6c8")
    draw_circle(cx, cy, r)
    draw_set_color("#e4ddd0")
    draw_circle(cx, cy, r * 0.78, True)
    draw_set_color("#c9bfae")
    draw_circle(cx, cy, r, True)


def big_plate(cx, cy, w):
    """The plate on the counter that the sandwich stands on."""
    draw_set_alpha(0.25)
    draw_set_color("#000000")
    draw_ellipse(cx - w / 2 + 6, cy - w * 0.1 + 10, cx + w / 2 + 6, cy + w * 0.1 + 14)
    draw_set_alpha(1)
    draw_set_color("#fffdf7")
    draw_ellipse(cx - w / 2, cy - w * 0.1, cx + w / 2, cy + w * 0.1)
    draw_set_color("#e2dbcf")
    draw_ellipse(cx - w * 0.36, cy - w * 0.065, cx + w * 0.36, cy + w * 0.065, True)
    draw_set_color("#c9bfae")
    draw_ellipse(cx - w / 2, cy - w * 0.1, cx + w / 2, cy + w * 0.1, True)


def pic(name, x, y, size=1.0, alpha=1.0, frame=0, angle=0):
    """A picture with its middle at (x, y)."""
    draw_sprite_ext(name, frame, x, y, size, size, angle, "white", alpha)


def layer_sprite(s, layer):
    k = layer["k"]
    if k in ("bottom", "top"):
        return f"{k}_{s['bread']}"
    return f"layer_{k}"


def draw_sauce(layer, x, y, scale, edge=1.0):
    """A squiggle in the sauce's colour across the top; past the bitten edge, nothing."""
    dots = layer.get("dots", [])
    keep = -LAYER_W / 2 + LAYER_W * edge - LAYER_W * 0.09   # the round bite reaches a little past the edge
    draw_set_color(LAYERS[layer["k"]]["ink"])
    for a, b in zip(dots, dots[1:]):
        if a[0] > keep or b[0] > keep:
            break
        draw_line(x + a[0] * scale, y + a[1] * scale, x + b[0] * scale, y + b[1] * scale, max(2, 7 * scale))
    for d in dots:
        if d[0] <= keep:
            draw_circle(x + d[0] * scale, y + d[1] * scale, max(1, 3.5 * scale))


def draw_layer(s, layer, x, y, scale, frame=0, angle=0, alpha=1.0):
    """One layer with its slot's middle at (x, y)."""
    if LAYERS.get(layer["k"], {}).get("kind") == "sauce":
        draw_sauce(layer, x, y, scale, 1 - frame / BITES)
    else:
        draw_sprite_ext(layer_sprite(s, layer), frame, x, y, scale, scale, angle, "white", alpha)


def draw_sandwich(s, cx, base_y, scale=1.0, sway=0.0, upto=None):
    """The sandwich standing on (cx, base_y), bottom slice first. sway leans it (a wobble):
    each layer moves sideways by sway times its height. upto: draw only that many layers."""
    if s["bites"] >= BITES:
        return
    y = base_y
    h = 0
    layers = s["layers"] if upto is None else s["layers"][:upto]
    for layer in layers:
        t = thick(s, layer)
        x = cx + (layer["dx"] + sway * (h + t / 2)) * scale
        draw_layer(s, layer, x, y - t / 2 * scale, scale, s["bites"])
        y -= t * scale
        h += t


def stack_scale(s, room=STACK_ROOM, most=1.0):
    """How big to draw a sandwich so it fits `room` pixels of height."""
    return min(most, room / max(1, height(s) + 70))     # 70: the top layer's face, seen from above


def layer_name(k):
    if k in ("bottom", "top"):
        return "Bread"
    return LAYERS[k]["name"]
