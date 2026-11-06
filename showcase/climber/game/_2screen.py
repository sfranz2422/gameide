# script: screen
# Who's who, and the words on the screen.

# The climbers to pick from, in the order of their pictures.
CLIMBERS = [
    ("red", "Red Jacket"), ("teal", "Teal Parka"), ("purple", "Ski Suit"), ("orange", "Earmuffs"),
    ("penguin", "Penguin"), ("bear", "Polar Bear"), ("fox", "Snow Fox"), ("yeti", "Yeti"),
]
LEDGE_OBJECT = {"rock": "RockLedge", "ice": "IceLedge", "crumble": "CrumbleLedge", "plank": "Plank", "block": "IceBlock"}


def words(x, y, text, size=18, color="white", align="left"):
    """Text with a dark edge, so it reads on snow and on sky alike."""
    draw_set_font("Ubuntu", size)
    draw_set_halign(align)
    draw_set_color("#10202c")
    for dx, dy in ((-2, 0), (2, 0), (0, -2), (0, 2), (2, 2)):
        draw_text(x + dx, y + dy, text)
    draw_set_color(color)
    draw_text(x, y, text)
    draw_set_halign("left")


def make_ledge(e):
    """A ledge from the mountain's plan: its kind's object, its size, and where it rests."""
    o = instance_create(e["x"], e["y"], LEDGE_OBJECT[e["kind"]])
    o.half = e["w"] / 2
    o.home_x, o.home_y = o.x, o.y
    o.plan_i = e["i"]
    if e["kind"] in ("rock", "ice"):
        o.sprite = f'{e["kind"]}_{e["w"]}'
    return o
