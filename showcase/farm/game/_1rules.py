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
    "sugarcane": {"name": "Sugarcane", "grow": 1200, "seed": 6, "yield": 2, "xp": 4, "sell": 8, "level": 8},
    "strawberry": {"name": "Strawberries", "grow": 600, "seed": 5, "yield": 3, "xp": 4, "sell": 7, "level": 11},
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
BARN_SPACE = 80                             # how many things it holds (50 in phase 1; goods need room too)

# ---- phase 2: animals, and the goods made from what's grown.
# Everything made that isn't a crop: what it's called, what it sells for, and the XP
# for collecting one.
GOODS = {
    "chicken_feed": {"name": "Chicken feed", "sell": 3,   "xp": 1},
    "cow_feed":     {"name": "Cow feed",     "sell": 6,   "xp": 2},
    "sheep_feed":   {"name": "Sheep feed",   "sell": 6,   "xp": 2},
    "egg":          {"name": "Eggs",         "sell": 8,   "xp": 3},
    "milk":         {"name": "Milk",         "sell": 14,  "xp": 4},
    "wool":         {"name": "Wool",         "sell": 20,  "xp": 5},
    "bread":        {"name": "Bread",        "sell": 6,   "xp": 2},
    "corn_bread":   {"name": "Corn bread",   "sell": 18,  "xp": 4},
    "pie":          {"name": "Pumpkin pie",  "sell": 30,  "xp": 7},
    "cookies":      {"name": "Cookies",      "sell": 26,  "xp": 6},
    "cream":        {"name": "Cream",        "sell": 20,  "xp": 4},
    "cheese":       {"name": "Cheese",       "sell": 32,  "xp": 6},
    "butter":       {"name": "Butter",       "sell": 50,  "xp": 8},
    "sugar":        {"name": "Sugar",        "sell": 20,  "xp": 4},
    "yarn":         {"name": "Yarn",         "sell": 46,  "xp": 7},
    "sweater":      {"name": "Sweater",      "sell": 100, "xp": 12},
    "jam":          {"name": "Jam",          "sell": 52,  "xp": 8},
}
# Animal homes: each holds ANIMALS_EACH animals. Feed one (a feed from the barn) and it
# makes its good after `time` seconds; collect it, and it's hungry again.
ANIMALS_EACH = 3
HOMES = {
    "coop":      {"name": "Chicken coop", "animal": "chicken", "feed": "chicken_feed", "makes": "egg",  "time": 240, "level": 4, "cost": 100},
    "cowshed":   {"name": "Cow shed",     "animal": "cow",     "feed": "cow_feed",     "makes": "milk", "time": 480, "level": 6, "cost": 220},
    "sheep_pen": {"name": "Sheep pen",    "animal": "sheep",   "feed": "sheep_feed",   "makes": "wool", "time": 720, "level": 9, "cost": 360},
}
# Factories: each makes things from what's in the barn, one at a time, with a queue of
# FACTORY_QUEUE (finished ones wait in it until collected).
FACTORY_QUEUE = 3
FACTORIES = {
    "feed_mill":    {"name": "Feed mill",    "level": 3,  "cost": 80,  "makes": {
        "chicken_feed": {"needs": {"wheat": 2, "corn": 1}, "time": 60},
        "cow_feed":     {"needs": {"corn": 2, "carrot": 1}, "time": 120},
        "sheep_feed":   {"needs": {"wheat": 2, "carrot": 1}, "time": 120}}},
    "bakery":       {"name": "Bakery",       "level": 4,  "cost": 140, "makes": {
        "bread":      {"needs": {"wheat": 3}, "time": 180},
        "corn_bread": {"needs": {"corn": 2, "egg": 1}, "time": 300},
        "pie":        {"needs": {"pumpkin": 1, "wheat": 2, "egg": 1}, "time": 600},
        "cookies":    {"needs": {"wheat": 2, "sugar": 1, "egg": 1}, "time": 480}}},
    "dairy":        {"name": "Dairy",        "level": 7,  "cost": 260, "makes": {
        "cream":  {"needs": {"milk": 1}, "time": 180},
        "cheese": {"needs": {"milk": 2}, "time": 360},
        "butter": {"needs": {"milk": 2, "cream": 1}, "time": 480}}},
    "sugar_mill":   {"name": "Sugar mill",   "level": 8,  "cost": 300, "makes": {
        "sugar": {"needs": {"sugarcane": 2}, "time": 300}}},
    "weaving_mill": {"name": "Weaving mill", "level": 10, "cost": 420, "makes": {
        "yarn":    {"needs": {"wool": 2}, "time": 360},
        "sweater": {"needs": {"yarn": 2}, "time": 720}}},
    "jam_kitchen":  {"name": "Jam kitchen",  "level": 11, "cost": 480, "makes": {
        "jam": {"needs": {"strawberry": 3, "sugar": 1}, "time": 480}}},
}
ORDER_GOODS_MOST = 3                        # an order wants at most this many of a made good

# ---- phase 3: the town. Houses bring people; people need room in the town, which
# community buildings make (BASE_ROOM to start). A house whose people have no room
# stands empty, and only a lived-in house pays rent (every `every` seconds, real
# time, collected by tapping it). As many houses as you like, each of a kind dearer
# than the last; one of each community building.
BASE_ROOM = 20
HOUSES = {
    "cottage":    {"name": "Cottage",     "level": 5,  "cost": 120, "step": 40,  "people": 6,  "rent": 12, "every": 600,  "xp": 6},
    "family_house": {"name": "Family house", "level": 7, "cost": 260, "step": 80,  "people": 12, "rent": 26, "every": 900,  "xp": 10},
    "townhouse":  {"name": "Townhouse",   "level": 10, "cost": 480, "step": 140, "people": 20, "rent": 46, "every": 1200, "xp": 16},
    "manor":      {"name": "Manor",       "level": 13, "cost": 800, "step": 220, "people": 32, "rent": 80, "every": 1800, "xp": 24},
}
RENT_XP = 1                                 # XP for each rent collected
COMMUNITY = {
    "fountain":  {"name": "Fountain",  "level": 5,  "cost": 150,  "room": 20,  "xp": 10},
    "park":      {"name": "Park",      "level": 6,  "cost": 220,  "room": 30,  "xp": 14},
    "school":    {"name": "School",    "level": 8,  "cost": 400,  "room": 50,  "xp": 20},
    "cafe":      {"name": "Café",      "level": 10, "cost": 600,  "room": 60,  "xp": 26},
    "town_hall": {"name": "Town hall", "level": 12, "cost": 900,  "room": 80,  "xp": 34},
    "library":   {"name": "Library",   "level": 14, "cost": 1200, "room": 100, "xp": 40},
}
# Roads: a tile at a time, anywhere free; townspeople walk along them (the farm's dirt
# road too). One townsperson out walking for every WALKER_PEOPLE people, up to WALKERS_MOST.
ROAD_COST = 2
ROAD_LEVEL = 5
WALKER_PEOPLE = 6
WALKERS_MOST = 10
WALK_STEPS = 40                             # steps of the game to walk one tile
PEOPLE = ["girl", "boy", "woman", "grandpa"]    # the townspeople's pictures
# Visitors: townspeople come to the farm stand wanting one thing, and pay well for it.
# One may wait for every VISITOR_PEOPLE people (one at least, once anyone lives in town).
VISITOR_PEOPLE = 20
VISITORS_MOST = 4
VISITOR_WAIT = 90                           # seconds before the next one comes
VISITOR_PAY = 2.0                           # coins: this × what the things sell for, plus ORDER_TIP
VISITOR_XP = 2                              # XP for each thing they take

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
FOOTPRINT = {"barn": 2, "house": 2, "silo": 1, "board": 1, "truck": 1, "stand": 1,
             "coop": 2, "cowshed": 2, "sheep_pen": 2, "feed_mill": 2, "bakery": 2, "dairy": 2,
             "sugar_mill": 2, "weaving_mill": 2, "jam_kitchen": 2,
             "cottage": 2, "family_house": 2, "townhouse": 2, "manor": 2,
             "fountain": 2, "park": 2, "school": 2, "cafe": 2, "town_hall": 2, "library": 2}
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
