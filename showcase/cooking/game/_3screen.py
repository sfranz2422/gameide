# script: screen
# Words, panels and pictures, shared by every screen. Every picture is a sprite
# named as its picture is (build.py), so pic("patty_cooked", x, y) draws one.
INK, SHADOW, GOLD, RED, MINT, DIM = "#ffffff", "#2a1a10", "#ffd23f", "#ff6b5f", "#9ff0c0", "#d9d2bf"
PANEL, PANEL_EDGE = "#3d2a1c", "#ffcf7a"
FOOD_SIZE = 72                # food pictures are this square (build.py)

# How tall each part sits in a stacked burger (pixels at full size): the pictures
# are drawn from the side, so a bun is thicker than a slice of cheese.
LAYER = {"bun": 16, "patty": 13, "cheese": 5, "lettuce": 7, "tomato": 8, "top": 0}


def text(x, y, words, colour=INK, size=16, align="left"):
    """Words with a shadow, so they read on a busy picture."""
    draw_set_font("Ubuntu", size)
    draw_set_halign(align)
    draw_set_color(SHADOW)
    draw_text(x + 2, y + 2, words)
    draw_set_color(colour)
    draw_text(x, y, words)
    draw_set_halign("left")


def panel(x1, y1, x2, y2, alpha=0.88, fill=PANEL):
    draw_set_alpha(alpha)
    draw_set_color(fill)
    draw_rect(x1, y1, x2, y2)
    draw_set_alpha(1)
    draw_set_color(PANEL_EDGE)
    draw_rect(x1, y1, x2, y2, True)


def pic(name, x, y, size=1.0, alpha=1.0, frame=0, flip=False):
    """A picture with its middle at (x, y)."""
    draw_sprite_ext(name, frame, x, y, -size if flip else size, size, 0, "white", alpha)


def draw_dish(parts, dish, x, y, size=1.0):
    """A dish as built so far, standing on (x, y): a burger stacked from its bottom bun up,
    or a bowl with what's in it and its toppings on top."""
    if dish == "burger":
        h = 0
        for p in parts:
            pic(PART_PICS[p], x, y - (h + 14) * size, size)
            h += LAYER[p]
        return
    full = "noodles" in parts and "broth" in parts
    pic("noodles_bowl" if full else "bowl", x, y - 26 * size, size)
    if not full:
        if "broth" in parts:
            pic("broth_pot", x - 14 * size, y - 30 * size, size * 0.5)
        if "noodles" in parts:
            pic("noodles_dry", x + 14 * size, y - 30 * size, size * 0.5)
    tops = [p for p in parts if p in BOWL_TOPPINGS]
    for i, p in enumerate(tops):
        pic(PART_PICS[p], x + (i - (len(tops) - 1) / 2) * 30 * size, y - 60 * size, size * 0.6)


def item_pic(item):
    """A side or drink, ready."""
    return ITEMS[item]["pics"][1]


def stars_row(x, y, n, size=0.6, of=3):
    for i in range(of):
        pic("star" if i < n else "star_empty", x + i * 34 * size / 0.6, y, size)


def coins_words(n):
    return f"{n} coin" + ("" if n == 1 else "s")
