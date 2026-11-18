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
MAP_W, MAP_H = 30, 30                       # tiles (phase 4: the valley; the farm is the 20 × 20 at the top, HOME)
HOME = 20
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
ROAD = [(6, y) for y in range(2, MAP_H)] + [(x, 5) for x in range(7, 12)]

# ---- phase 4: the valley. The farm (HOME × HOME tiles) is open from the start; the
# rest of the map is LAND to buy, a plot at a time, each wild with trees and rocks
# (the same for everyone: WILD_SEED) that tools clear. Tiles are a plot's from its top
# corner (gx, gy), w along gx and h along gy.
LAND = [
    {"name": "Pine Wood",     "gx": 20, "gy": 3,  "w": 10, "h": 5,  "level": 5,  "cost": 250,  "wild": "woods"},
    {"name": "Clover Meadow", "gx": 0,  "gy": 20, "w": 5,  "h": 10, "level": 6,  "cost": 300,  "wild": "meadow"},
    {"name": "Fox Hill",      "gx": 20, "gy": 8,  "w": 10, "h": 6,  "level": 7,  "cost": 400,  "wild": "woods"},
    {"name": "Mirror Lake",   "gx": 10, "gy": 20, "w": 5,  "h": 10, "level": 8,  "cost": 500,  "wild": "shore"},
    {"name": "Old Road",      "gx": 5,  "gy": 20, "w": 5,  "h": 10, "level": 9,  "cost": 650,  "wild": "meadow"},
    {"name": "Stony Ridge",   "gx": 20, "gy": 14, "w": 10, "h": 6,  "level": 10, "cost": 800,  "wild": "rocks"},
    {"name": "Deep Wood",     "gx": 15, "gy": 20, "w": 5,  "h": 10, "level": 11, "cost": 1000, "wild": "woods"},
    {"name": "Sunny Fields",  "gx": 20, "gy": 20, "w": 10, "h": 5,  "level": 12, "cost": 1300, "wild": "meadow"},
    {"name": "Far Rocks",     "gx": 20, "gy": 25, "w": 10, "h": 5,  "level": 13, "cost": 1600, "wild": "rocks"},
]
LAND_XP = 10                                # XP for each plot bought
# How thick the wild is (the share of tiles with something on), and what grows there.
WILD = {
    "woods":  {"thick": 0.5,  "kinds": {"pine": 5, "oak": 3, "stump": 1, "bush": 1}},
    "meadow": {"thick": 0.3,  "kinds": {"bush": 3, "grass_flowers": 3, "oak": 2, "boulder": 1}},
    "shore":  {"thick": 0.3,  "kinds": {"bush": 2, "oak": 2, "boulder": 1, "grass_flowers": 1}},
    "rocks":  {"thick": 0.45, "kinds": {"boulder": 6, "stump": 1, "pine": 1}},
}
WILD_SEED = 2026
# Clearing: what each wild thing needs (one used up), and what clearing one pays. The
# farm's own trees and rocks (DECOR) clear the same way; the pond stays.
CLEAR = {"oak": "axe", "pine": "axe", "stump": "shovel", "bush": "shovel", "grass_flowers": "shovel", "boulder": "pickaxe"}
CLEAR_XP = 2
CLEAR_COINS = 4
# Tools and building materials: kept in their own box in the barn (they take no room).
KIT = {
    "axe":     {"name": "Axe"},
    "pickaxe": {"name": "Pickaxe"},
    "shovel":  {"name": "Shovel"},
    "nails":   {"name": "Nails"},
    "planks":  {"name": "Planks"},
    "paint":   {"name": "Paint"},
}
START_KIT = {"axe": 3, "pickaxe": 2, "shovel": 3}   # a new farm's, and an older save's when it loads
# Now and then a harvest or a collection finds something for the kit, as likely as
# DROP_CHANCE; which one, by these weights.
DROP_CHANCE = 0.08
DROPS = {"axe": 3, "shovel": 3, "pickaxe": 2, "nails": 2, "planks": 2, "paint": 2}
# A bigger barn: BARN_STEP more room for (BARN_NEEDS + how many times it's grown) each
# of nails, planks and paint.
BARN_STEP = 40
BARN_NEEDS = 2
BARN_XP = 10

# The train: it waits at the station with TRAIN_WAGONS wagons, each wanting something
# from the barn and bringing something for the kit in return. Loaded (or sent off), it's
# away TRAIN_AWAY seconds (real time) and comes back with new wagons.
STATION = (21, 1)                           # the station's top corner (2 × 2)
# The railway runs along the station's front row: Gemini's station has its own track
# there, so the train stops on it.
RAIL_GY = STATION[1] + 1
RAIL = [(gx, RAIL_GY) for gx in range(HOME, MAP_W)]
TRAIN_LEVEL = 6
TRAIN_WAGONS = 3
TRAIN_AWAY = 900
TRAIN_ROLL = 4                              # seconds the train takes to roll in or out
TRAIN_PARK = 25                             # the engine's tile along the railway, stopped
TRAIN_XP = 2                                # XP for each thing loaded
TRAIN_PRIZES = {"axe": 3, "shovel": 3, "pickaxe": 1, "nails": 3, "planks": 3, "paint": 3}

# Places that come with their land (one of each, never moved): a fishing dock by the
# lake, which catches fish like an animal home (baited with corn), and the mine, a
# factory digging up what's below with lunch for the miners.
LAKE = [(gx, gy) for gx in range(10, 15) for gy in range(23, 29)
        if (gx, gy) not in ((10, 23), (14, 23), (10, 28), (14, 28))]
SITES = {
    "dock": {"name": "Fishing dock", "land": 3, "gx": 11, "gy": 21,
             "animal": "fish", "feed": "corn", "makes": "fish", "time": 600},
    "mine": {"name": "Mine", "land": 5, "gx": 24, "gy": 16, "makes": {
        "nails":   {"needs": {"bread": 2}, "time": 600},
        "pickaxe": {"needs": {"corn_bread": 1, "bread": 1}, "time": 900},
        "gold":    {"needs": {"cheese": 1, "bread": 2}, "time": 1200}}},
}
# The orchard: fruit trees, planted a tile each, as many as you like (each of a kind
# dearer than the last). They fruit on the clock, again and again.
TREES = {
    "apple_tree":  {"name": "Apple tree",  "fruit": "apple",  "grow": 1200, "yield": 3, "xp": 3, "level": 7,  "cost": 50, "step": 10},
    "cherry_tree": {"name": "Cherry tree", "fruit": "cherry", "grow": 1800, "yield": 3, "xp": 4, "level": 11, "cost": 80, "step": 15},
}
GOODS.update({
    "fish":         {"name": "Fish",         "sell": 22, "xp": 4},
    "gold":         {"name": "Gold",         "sell": 90, "xp": 10},
    "apple":        {"name": "Apples",       "sell": 6,  "xp": 2},
    "cherry":       {"name": "Cherries",     "sell": 9,  "xp": 3},
    "apple_juice":  {"name": "Apple juice",  "sell": 30, "xp": 6},
    "cherry_juice": {"name": "Cherry juice", "sell": 40, "xp": 7},
})
FACTORIES["juice_press"] = {"name": "Juice press", "level": 9, "cost": 520, "makes": {
    "apple_juice":  {"needs": {"apple": 3}, "time": 300},
    "cherry_juice": {"needs": {"cherry": 3}, "time": 420}}}
FOOTPRINT.update({"station": 2, "dock": 2, "mine": 2, "juice_press": 2, "apple_tree": 1, "cherry_tree": 1})
START_FARM.append(("station",) + STATION)
MINE_XP = 3                                 # XP for each tool or material the mine digs up

# ---- phase 5: achievements, the week's event, the seasons
# Achievements: each counts one thing the farm does (`tally`, in the rules where it
# happens), in three tiers; a tier reached is collected for its prize. "land" and
# "houses" are counted from the farm itself, so an older save's land counts already.
ACHIEVEMENTS = {
    "crops":    {"name": "Green thumb",      "about": "Harvest crops",          "icon": "wheat",   "goals": [50, 250, 1000]},
    "orders":   {"name": "Order up",         "about": "Fill orders",            "icon": "order",   "goals": [10, 50, 200]},
    "animal":   {"name": "Animal friend",    "about": "Collect from animals",   "icon": "egg",     "goals": [20, 100, 400]},
    "made":     {"name": "Busy factories",   "about": "Make goods",             "icon": "bread",   "goals": [20, 100, 400]},
    "cleared":  {"name": "Clearing the way", "about": "Clear trees and rocks",  "icon": "axe",     "goals": [10, 50, 150]},
    "land":     {"name": "Landowner",        "about": "Buy land",               "icon": "land",    "goals": [1, 4, 9]},
    "houses":   {"name": "Town builder",     "about": "Build houses",           "icon": "house",   "goals": [2, 6, 15]},
    "visitors": {"name": "Friendly stand",   "about": "Serve visitors",         "icon": "people",  "goals": [10, 50, 200]},
    "wagons":   {"name": "All aboard",       "about": "Load train wagons",      "icon": "train",   "goals": [6, 30, 120]},
    "fruit":    {"name": "Orchard keeper",   "about": "Pick fruit",             "icon": "apple",   "goals": [30, 150, 600]},
    "fish":     {"name": "Gone fishing",     "about": "Catch fish",             "icon": "fish",    "goals": [10, 50, 200]},
    "mine":     {"name": "Down the mine",    "about": "Dig in the mine",        "icon": "gold",    "goals": [5, 25, 100]},
}
AWARD_COINS = [25, 75, 200]                 # a tier's prize, by tier
AWARD_XP = [10, 30, 80]

# The week's event: from EVENT_LEVEL, one a week (weeks start Monday, the real
# clock's), chosen among those the farm can already do as the week begins and kept all
# week. Three goals, each with a prize, counted from the week's start.
EVENT_LEVEL = 4
EVENTS = {
    "harvest_fair": {"name": "Harvest fair",   "about": "Harvest crops",         "stat": "crops",    "goals": [60, 150, 300]},
    "market_week":  {"name": "Market week",    "about": "Fill orders",           "stat": "orders",   "goals": [6, 15, 30]},
    "bake_off":     {"name": "Bake-off",       "about": "Make goods",            "stat": "made",     "goals": [12, 30, 60]},
    "animal_week":  {"name": "Animal week",    "about": "Collect from animals",  "stat": "animal",   "goals": [15, 40, 80]},
    "clean_up":     {"name": "Big clean-up",   "about": "Clear trees and rocks", "stat": "cleared",  "goals": [8, 20, 40]},
    "train_week":   {"name": "Full steam",      "about": "Load train wagons",    "stat": "wagons",   "goals": [6, 15, 30]},
    "fruit_week":   {"name": "Orchard days",   "about": "Pick fruit",            "stat": "fruit",    "goals": [30, 75, 150]},
    "derby":        {"name": "Fishing derby",  "about": "Catch fish",            "stat": "fish",     "goals": [8, 20, 40]},
}
EVENT_PRIZES = [
    {"coins": 40,  "xp": 10, "kit": {"axe": 1, "shovel": 1}},
    {"coins": 100, "xp": 25, "kit": {"nails": 1, "planks": 1, "paint": 1}},
    {"coins": 250, "xp": 60, "kit": {"pickaxe": 2, "nails": 2, "planks": 2, "paint": 2}},
]
WEEK = 7 * 86400
WEEK_START = 4 * 86400                      # the real clock's 0 was a Thursday: weeks start on Monday

# The seasons follow the real calendar (the school's, in the north). Orders wanting
# what's in season pay SEASON_PAY times as much; the farm takes on the season's tint,
# and its weather (snow, falling leaves, now and then a shower).
SEASONS = {
    "spring": {"name": "Spring", "months": [3, 4, 5],   "likes": ["strawberry", "egg", "carrot", "jam"],
               "tint": "#ffd8f0", "tint_alpha": 0.06, "weather": "rain"},
    "summer": {"name": "Summer", "months": [6, 7, 8],   "likes": ["corn", "cherry", "cherry_juice", "cream"],
               "tint": "#fff2b0", "tint_alpha": 0.06, "weather": None},
    "autumn": {"name": "Autumn", "months": [9, 10, 11], "likes": ["pumpkin", "apple", "apple_juice", "pie"],
               "tint": "#ff9a3c", "tint_alpha": 0.10, "weather": "leaves"},
    "winter": {"name": "Winter", "months": [12, 1, 2],  "likes": ["wool", "sweater", "cookies", "milk"],
               "tint": "#cfe4ff", "tint_alpha": 0.16, "weather": "snow"},
}
SEASON_PAY = 1.5
SHOWER_EVERY = 1800                         # spring: a shower for the first SHOWER_LONG seconds of every this many
SHOWER_LONG = 300
