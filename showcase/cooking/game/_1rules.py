# script: rules
# Every number in Order Up! is here: how long things cook and how long they stay
# good, what a dish sells for, how patient each kind of customer is, the days, the
# upgrades. Change one here and the game, the bot in the tests and the star goals
# all follow.
#
# Times are in STEPS (60 a second), as the game counts them.

VIEW_W, VIEW_H = 1024, 576
FPS = 60
DAY_STEPS = 95 * FPS         # closing time: anyone still waiting goes home unserved
ARRIVE_UNTIL = 0.78          # customers arrive over this share of the day (so the last can be served)
DOOR_WAIT = 12 * FPS         # someone with no free seat waits at the door this long, then gives up
DAYS_EACH = 10               # days in each restaurant

# ---- the restaurant: four seats at the counter
SEATS = 4
SEAT_X = [215, 425, 635, 845]    # each customer's middle
DRAG_START = 12                  # pixels a press must move before it is a drag, not a tap
COUNTER_Y = 306                  # the top edge of the counter in both restaurants' pictures: customers stand behind it
PLATES = 3                       # plates (or bowls) to build dishes on
SHELF_SLOTS = 4                  # the pass: sides and drinks waiting to be served

# ---- food: how long each thing takes (cook) and how long it stays good once done
# (keep; None: it never spoils, as a drink doesn't). What's done goes to a plate
# ("plate": part of the dish) or the shelf (a side or a drink).
ITEMS = {
    "patty":     {"cook": 6.0 * FPS, "keep": 7.0 * FPS, "goes": "plate", "pics": ("patty_cooking", "patty_cooked", "patty_burnt"), "raw": "patty_raw"},
    "fries":     {"cook": 5.0 * FPS, "keep": 8.0 * FPS, "goes": "shelf", "pics": ("fries_raw", "fries", "fries_burnt"), "raw": "fries_raw"},
    "cola":      {"cook": 2.5 * FPS, "keep": None,      "goes": "shelf", "pics": ("cola", "cola", "cola"), "raw": "cola"},
    "orange":    {"cook": 2.5 * FPS, "keep": None,      "goes": "shelf", "pics": ("orange", "orange", "orange"), "raw": "orange"},
    "noodles":   {"cook": 5.0 * FPS, "keep": 7.0 * FPS, "goes": "plate", "pics": ("noodles_boiling", "noodles_boiling", "noodles_soggy"), "raw": "noodles_dry"},
    "dumplings": {"cook": 6.0 * FPS, "keep": 7.0 * FPS, "goes": "shelf", "pics": ("dumplings_raw", "dumplings", "dumplings_burnt"), "raw": "dumplings_raw"},
    "tea":       {"cook": 2.5 * FPS, "keep": None,      "goes": "shelf", "pics": ("tea", "tea", "tea"), "raw": "tea"},
    "iced_tea":  {"cook": 2.5 * FPS, "keep": None,      "goes": "shelf", "pics": ("iced_tea", "iced_tea", "iced_tea"), "raw": "iced_tea"},
}
DRINKS = ["cola", "orange", "tea", "iced_tea"]
FAST = 0.7                   # the "fast" upgrade: food cooks in 70% of the time (drinks pour as before)

# ---- what each part of a dish is called, and its picture
PART_PICS = {
    "bun": "bun_bottom", "top": "bun_top", "patty": "patty_cooked", "cheese": "cheese", "lettuce": "lettuce",
    "tomato": "tomato", "noodles": "noodles_dry", "broth": "broth_pot", "egg": "egg", "onion": "onion",
    "pork": "pork", "tofu": "tofu", "seaweed": "seaweed", "chilli": "chilli",
}
BURGER_TOPPINGS = ["cheese", "lettuce", "tomato"]
BOWL_TOPPINGS = ["egg", "onion", "pork", "tofu", "seaweed", "chilli"]

# ---- prices (coins)
PRICES = {"burger": 5, "bowl": 6, "topping": 1, "fries": 3, "dumplings": 4,
          "cola": 2, "orange": 2, "tea": 2, "iced_tea": 2}
TIP_MAX = 3                  # a tip for someone served at once; less the longer they waited
COMBO_STEP = 0.25            # each served-in-good-time customer in a row adds this much to tips…
COMBO_MAX = 2.0              # …up to twice the tip
COMBO_GOOD = 0.5             # "in good time": with at least half their patience left
STAR_SHARES = (0.40, 0.58, 0.85)  # coins for 1, 2 and 3 stars, as a share of the most the day could make
# (the teacher asked for "a little easier" on 2026-11-12: the first two came down from
# 0.45 and 0.65; the third stays where it was, so no part of a day got harder)
                                  # (every order paid for, each with the biggest plain tip, TIP_MAX).
                                  # A combo's bigger tips can make more than that: three stars want a
                                  # good run of them, the first two only a steady day.

# ---- customers: (picture number, name, patience in seconds, tips ×)
# (The teacher asked for "a little easier", 2026-11-12: patience was 30 s, food kept 2 s
# less before burning, stars at 45/65/85%, and day 10 had 19 customers.)
PATIENCE = 37.5 * FPS        # an ordinary customer's patience at the counter
CUSTOMERS = [
    (0, "builder",  1.00, 1.0),
    (1, "teen",     0.85, 1.0),
    (2, "grandpa",  1.30, 0.8),
    (3, "boss",     0.90, 1.3),
    (4, "kid",      0.75, 0.6),
    (5, "rider",    0.80, 1.2),
    (6, "critic",   0.90, 2.0),
    (7, "hiker",    1.10, 1.0),
]
CUSTOMER_FRAMES = ["calm", "happy", "impatient", "angry", "eating"]
IMPATIENT = 0.45             # patience left (share) when they start tapping their watch
EAT_STEPS = 50               # how long a served customer stays, happy, before leaving
WALK_STEPS = 24              # sliding in to a seat, or away

# ---- the two restaurants. Each cooker's slots name what cooks in them; a slot
# appears once its food is on the menu. "more" names the upgrade adding a slot.
# Sources are what you tap to put a part on a plate (from left to right).
RESTAURANTS = [
    {
        "key": "burger", "name": "Bun Run Burgers", "dish": "burger", "cook": 0, "plate": "plate",
        "cookers": [
            {"key": "grill", "x": 16, "slots": ["patty", "patty"], "more": ("slot_main", "patty"), "pic": "grill"},
            {"key": "fryer", "x": 290, "slots": ["fries"], "more": ("slot_side", "fries"), "pic": "fryer"},
            {"key": "fountain", "x": 830, "slots": ["cola", "orange"], "pic": "fountain"},
        ],
        "sources": ["bun", "top", "cheese", "lettuce", "tomato"],
        # The first day (from 0) each thing is on the menu: new food comes a little at a time.
        "intro": {"bun": 0, "top": 0, "patty": 0, "cola": 0, "cheese": 1, "fries": 2, "orange": 3, "lettuce": 4, "tomato": 6},
        "upgrades": [
            ("fast",      "Hot grill",          60,  "Patties and fries cook in 70% of the time."),
            ("slot_main", "Third grill spot",   80,  "Three patties on the grill at once."),
            ("slot_side", "Second fryer basket", 70, "Two lots of fries at once."),
            ("auto",      "Self-filling fountain", 90, "A drink pours again as soon as one's taken."),
            ("decor1",    "Potted plants",      50,  "Customers wait 15% longer."),
            ("decor2",    "Jukebox",            100, "Customers wait another 15% longer."),
            ("tips",      "Tip jar",            120, "Tips are half as big again."),
        ],
    },
    {
        "key": "noodle", "name": "Lantern Noodles", "dish": "bowl", "cook": 1, "plate": "bowl",
        "cookers": [
            {"key": "pot", "x": 16, "slots": ["noodles", "noodles"], "more": ("slot_main", "noodles"), "pic": "pot"},
            {"key": "steamer", "x": 290, "slots": ["dumplings"], "more": ("slot_side", "dumplings"), "pic": "steamer"},
            {"key": "teapot", "x": 830, "slots": ["tea", "iced_tea"], "pic": "teapot"},
        ],
        "sources": ["broth", "egg", "onion", "pork", "tofu", "seaweed", "chilli"],
        "intro": {"noodles": 0, "broth": 0, "tea": 0, "egg": 1, "dumplings": 2, "onion": 3, "iced_tea": 4,
                  "pork": 5, "tofu": 6, "seaweed": 7, "chilli": 8},
        "upgrades": [
            ("fast",      "Hotter burners",     60,  "Noodles and dumplings cook in 70% of the time."),
            ("slot_main", "Third noodle basket", 80, "Three lots of noodles at once."),
            ("slot_side", "Second steamer",     70,  "Two baskets of dumplings at once."),
            ("auto",      "Self-filling teapot", 90, "A drink pours again as soon as one's taken."),
            ("decor1",    "Paper lanterns",     50,  "Customers wait 15% longer."),
            ("decor2",    "A little fountain",  100, "Customers wait another 15% longer."),
            ("tips",      "Tip jar",            120, "Tips are half as big again."),
        ],
    },
]
DECOR = 1.15                 # each decor upgrade: patience ×
TIP_JAR = 1.5

# ---- the days: customers come more often and order more as the days go on
def day_plan(d):
    """Day d (from 0) of a restaurant: how many come, and how likely a side and a drink are, and how many toppings at most."""
    return {
        "customers": 5 + round(1.2 * d),          # 5 on day 1, 16 on day 10
        "side": 0.30 + 0.035 * d,
        "drink": 0.45 + 0.035 * d,
        "toppings": 0 if d == 0 else 1 if d < 4 else 2,
        "patience": 1.0 - 0.03 * d,               # a little less patient as word gets round how quick you are
    }

# ---- the screen
# Two rows on the counter's work surface, which runs from its top edge (COUNTER_Y) to
# its front at about y 515 in both pictures: cookers and the shelf at the back, the
# trays, plates and bin at the front. Lower, they stood off the front of the counter.
SHELF_X, SHELF_Y, SHELF_W, SHELF_H = 470, 330, 84, 92
PLATE_X, PLATE_W = 400, 140
SOURCE_X, SOURCE_Y, SOURCE_H = 12, 432, 86
BIN_X, BIN_Y, BIN_W, BIN_H = 900, 426, 100, 92
COOKER_Y, SLOT_W, SLOT_H = 316, 86, 108
COOK_POSES = ["ready", "flip", "carry", "cheer", "wipe", "worried"]
