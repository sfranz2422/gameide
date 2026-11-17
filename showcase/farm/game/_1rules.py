# script: rules
# Every number in Cloverbrook is here: the map, the crops and how long they take,
# what things cost and sell for, the levels and what each one opens, the orders.
# Change one here and the game, the build's map and the tests all follow.
#
# TIME IS REAL: crops keep growing while the game is closed (the teacher's choice,
# 2026-11-16), so grow times are seconds of the real clock, and the save keeps
# when each field was planted. Plant wheat in class, it's ready next lesson.

VIEW_W, VIEW_H = 1024, 576
FPS = 60

# ---- the map: isometric diamonds (Gemini drew it that way; the teacher chose to
# match, 2026-11-17). Tile (gx, gy)'s middle is at
#   x = ORIGIN_X + (gx - gy) * TILE_W / 2,   y = ORIGIN_Y + (gx + gy) * TILE_H / 2
TILE_W, TILE_H = 128, 64
MAP_W, MAP_H = 20, 20                       # tiles
ORIGIN_X = MAP_H * TILE_W // 2              # so tile (0, MAP_H) touches the left edge
ORIGIN_Y = 160                              # room above the top corner for tall things
WORLD_W = (MAP_W + MAP_H) * TILE_W // 2
WORLD_H = ORIGIN_Y + (MAP_W + MAP_H) * TILE_H // 2 + 96

# ---- crops: grow is seconds (real time); seed is coins to plant; yield is how many
# a field gives; xp for each harvest; sell is coins each at the barn; level opens it.
CROPS = {
    "wheat":   {"name": "Wheat",    "grow": 60,  "seed": 0, "yield": 2, "xp": 1, "sell": 1,  "level": 1},
    "corn":    {"name": "Corn",     "grow": 180, "seed": 2, "yield": 2, "xp": 2, "sell": 3,  "level": 2},
    "carrot":  {"name": "Carrots",  "grow": 420, "seed": 4, "yield": 2, "xp": 3, "sell": 5,  "level": 3},
    "pumpkin": {"name": "Pumpkins", "grow": 900, "seed": 8, "yield": 2, "xp": 5, "sell": 12, "level": 5},
}
STAGES = 4                                  # pictures of a growing crop: sprouts, young, nearly, ready

# ---- money and levels
START_COINS = 60
# XP needed to REACH each level (index 0 is level 1). Past the end, each level wants
# LEVEL_STEP more than the last.
LEVEL_XP = [0, 10, 25, 50, 90, 150, 230, 340, 480, 660, 900]
LEVEL_STEP = 300
LEVEL_COINS = 20                            # a present each new level

# ---- fields
START_FIELDS = [(7, 6), (8, 6), (9, 6), (7, 7), (8, 7), (9, 7)]
FIELD_COST = 30                             # the first one bought; each after costs FIELD_COST_STEP more
FIELD_COST_STEP = 15
FIELDS_PER_LEVEL = 2                        # most fields: len(START_FIELDS) + this × level

# ---- the barn
BARN_SPACE = 50                             # how many things it holds

# ---- orders on the board: each wants a few things, and pays coins and XP
ORDER_SLOTS = 3                             # at level 1; one more every ORDER_SLOT_LEVELS levels…
ORDER_SLOT_LEVELS = 2
ORDER_SLOTS_MOST = 6                        # …up to this many
ORDER_WAIT = 30                             # seconds before a new order fills an empty slot
ORDER_PAY = 1.6                             # coins: this × what the things would sell for, plus ORDER_TIP
ORDER_TIP = 3
ORDER_XP = 1.0                              # XP: this × what harvesting them gave

# ---- the farm as it starts: (kind, gx, gy). Buildings stand with their top corner
# at (gx, gy) and cover FOOTPRINT tiles each way. Fields are in START_FIELDS.
FOOTPRINT = {"barn": 2, "house": 2, "silo": 1, "board": 1, "truck": 1, "stand": 1}
START_FARM = [
    ("house", 3, 3), ("barn", 3, 7), ("silo", 2, 10), ("board", 7, 3), ("truck", 8, 3), ("stand", 10, 4),
]
DECOR = [
    ("oak", 1, 1), ("pine", 0, 4), ("pine", 1, 6), ("oak", 0, 9), ("pine", 1, 13), ("oak", 3, 16), ("pine", 8, 18),
    ("oak", 12, 1), ("pine", 15, 0), ("oak", 17, 3), ("pine", 18, 7), ("oak", 16, 11), ("pine", 18, 15), ("oak", 13, 17),
    ("boulder", 12, 9), ("boulder", 5, 14), ("bush", 6, 1), ("bush", 11, 12), ("bush", 2, 18), ("stump", 14, 6),
    ("pond", 14, 13), ("grass_flowers", 10, 15), ("grass_flowers", 5, 11), ("bush", 16, 18),
]
# The dirt road: from the farm's gate to the map's edge, a tile at a time.
ROAD = [(6, y) for y in range(2, 20)] + [(x, 5) for x in range(7, 12)]
