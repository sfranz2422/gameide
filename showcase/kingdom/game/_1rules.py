# script: rules
# Every number in Highmoor is here: the map, the buildings and every level of each,
# what they cost, how long they take, what they make, hold and do. Change one here and
# the game, the build's pictures and the tests all follow.
#
# TIME IS REAL (the teacher's choice, as in Cloverbrook): building, upgrading and the
# mines' gold all run on the real clock, so they carry on while the game is closed.

VIEW_W, VIEW_H = 1024, 576
FPS = 60

# ---- the map: isometric diamonds, as Cloverbrook's, but smaller tiles (a wall is one
# tile, the keep four by four). Tile (gx, gy)'s middle is at
#   x = ORIGIN_X + (gx - gy) * TILE_W / 2,   y = ORIGIN_Y + (gx + gy) * TILE_H / 2
TILE_W, TILE_H = 64, 32
MAP_W, MAP_H = 40, 40
ORIGIN_X = MAP_H * TILE_W // 2
ORIGIN_Y = 220                              # room above the top corner for tall towers
WORLD_W = (MAP_W + MAP_H) * TILE_W // 2
WORLD_H = ORIGIN_Y + (MAP_W + MAP_H) * TILE_H // 2 + 120

# How far out the view is (the teacher's ask: "zoomed out just a little, or an option to
# zoom out"): 1 is as drawn; the - and + buttons (and the Q and E keys) step through these.
ZOOMS = [0.55, 0.7, 0.85, 1.0]
ZOOM_START = 0.85
TEXT_SCALE = 1.25                           # every word bigger than it's written (the teacher's ask; Lilita One runs small)

RESOURCES = ["gold", "food"]
START_GOLD, START_FOOD = 1000, 1000

# ---- the buildings. Each has a footprint (tiles across), what it's paid for in
# ("pays"), the Build window's tab ("group"), how many the keep allows at each keep
# level ("count", keep levels 1 to 10), and, level by level (1 up to its last):
#   cost  what that level costs (in "pays")
#   time  seconds it takes (real time)
#   keep  the keep level needed first
#   hp    how much a raid must do to knock it down (phase 2)
# and what each kind does at that level (rate, hold, damage…). A level's lists are
# all the same length: that's how many levels it has.
BUILDINGS = {
    # -- the economy
    "keep": {"name": "Keep", "size": 4, "pays": "gold", "group": "economy",
             "about": "The heart of your kingdom. Each level allows more buildings, and better ones.",
             "count": [1] * 10,
             "cost": [0, 1000, 4000, 15000, 40000, 90000, 180000, 320000, 520000, 800000],
             "time": [0, 60, 900, 3600, 7200, 14400, 21600, 28800, 36000, 43200],
             "keep": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
             "hp":   [1500, 1800, 2200, 2700, 3300, 4000, 4800, 5700, 6700, 8000],
             "store": [2500, 4000, 7000, 12000, 22000, 36000, 52000, 72000, 95000, 125000]},   # gold and food each
    "gold_mine": {"name": "Gold mine", "size": 3, "pays": "food", "group": "economy",
                  "about": "Digs gold, a little every minute. Tap it to collect.",
                  "count": [1, 2, 3, 4, 5, 6, 6, 7, 7, 7],
                  "cost": [150, 300, 700, 1400, 3000, 7000, 14000, 28000, 50000, 80000],
                  "time": [10, 60, 300, 900, 1800, 3600, 7200, 10800, 14400, 21600],
                  "keep": [1, 1, 2, 2, 3, 3, 4, 5, 6, 7],
                  "hp":   [400, 440, 480, 520, 580, 640, 700, 780, 860, 960],
                  "rate": [600, 900, 1200, 1500, 1900, 2300, 2800, 3300, 3900, 4500],      # gold an hour
                  "hold": [1000, 2000, 3500, 5000, 8000, 12000, 18000, 25000, 35000, 50000]},
    "farm": {"name": "Farm", "size": 3, "pays": "gold", "group": "economy",
             "about": "Grows food, a little every minute. Tap it to collect.",
             "count": [1, 2, 3, 4, 5, 6, 6, 7, 7, 7],
             "cost": [150, 300, 700, 1400, 3000, 7000, 14000, 28000, 50000, 80000],
             "time": [10, 60, 300, 900, 1800, 3600, 7200, 10800, 14400, 21600],
             "keep": [1, 1, 2, 2, 3, 3, 4, 5, 6, 7],
             "hp":   [400, 440, 480, 520, 580, 640, 700, 780, 860, 960],
             "rate": [600, 900, 1200, 1500, 1900, 2300, 2800, 3300, 3900, 4500],           # food an hour
             "hold": [1000, 2000, 3500, 5000, 8000, 12000, 18000, 25000, 35000, 50000]},
    "treasury": {"name": "Treasury", "size": 3, "pays": "food", "group": "economy",
                 "about": "Keeps your gold. More levels, more gold kept.",
                 "count": [1, 1, 2, 2, 2, 3, 3, 4, 4, 4],
                 "cost": [300, 750, 1500, 3000, 6000, 12000, 25000, 50000, 100000, 200000],
                 "time": [10, 300, 900, 1800, 3600, 7200, 14400, 21600, 28800, 36000],
                 "keep": [1, 1, 2, 3, 3, 4, 5, 6, 7, 8],
                 "hp":   [500, 600, 700, 800, 950, 1100, 1300, 1500, 1750, 2000],
                 "store": [1500, 3000, 6000, 12000, 25000, 45000, 75000, 110000, 160000, 220000]},
    "granary": {"name": "Granary", "size": 3, "pays": "gold", "group": "economy",
                "about": "Keeps your food. More levels, more food kept.",
                "count": [1, 1, 2, 2, 2, 3, 3, 4, 4, 4],
                "cost": [300, 750, 1500, 3000, 6000, 12000, 25000, 50000, 100000, 200000],
                "time": [10, 300, 900, 1800, 3600, 7200, 14400, 21600, 28800, 36000],
                "keep": [1, 1, 2, 3, 3, 4, 5, 6, 7, 8],
                "hp":   [500, 600, 700, 800, 950, 1100, 1300, 1500, 1750, 2000],
                "store": [1500, 3000, 6000, 12000, 25000, 45000, 75000, 110000, 160000, 220000]},
    "builder_hut": {"name": "Builder's hut", "size": 2, "pays": "gold", "group": "economy",
                    "about": "Each hut is a builder: one more thing built or upgraded at a time.",
                    "count": [5] * 10,         # the price climbs instead (BUILDER_COSTS)
                    "cost": [0], "time": [0], "keep": [1], "hp": [250]},
    # -- the defenses (they fight in phase 2)
    "archer_tower": {"name": "Archer tower", "size": 3, "pays": "gold", "group": "defense",
                     "about": "Archers shoot at raiders, near or far.",
                     "count": [1, 1, 2, 2, 3, 3, 4, 5, 6, 7],
                     "cost": [1000, 2000, 5000, 10000, 20000, 40000, 80000, 150000, 250000, 400000],
                     "time": [60, 900, 2700, 7200, 14400, 21600, 28800, 36000, 43200, 50400],
                     "keep": [1, 2, 3, 4, 5, 5, 6, 7, 8, 9],
                     "hp":   [400, 450, 520, 600, 690, 790, 900, 1020, 1150, 1300],
                     "damage": [11, 15, 19, 25, 30, 35, 42, 48, 56, 65],    # a second
                     "range": [9, 9, 9, 9, 9, 9.5, 9.5, 10, 10, 10]},       # tiles
    "ballista": {"name": "Ballista", "size": 3, "pays": "gold", "group": "defense",
                 "about": "A giant crossbow: hard-hitting bolts at one raider at a time.",
                 "count": [0, 2, 2, 2, 3, 3, 4, 5, 5, 6],
                 "cost": [250, 1000, 4000, 16000, 30000, 60000, 120000, 200000, 320000, 500000],
                 "time": [60, 900, 2700, 7200, 14400, 21600, 28800, 36000, 43200, 50400],
                 "keep": [2, 2, 3, 4, 5, 6, 7, 8, 8, 9],
                 "hp":   [420, 470, 520, 570, 620, 670, 740, 820, 900, 1000],
                 "damage": [9, 11, 15, 19, 25, 31, 40, 48, 56, 64],
                 "range": [8, 8, 8, 8, 8, 8, 8, 8, 8, 8]},
    "trebuchet": {"name": "Trebuchet", "size": 3, "pays": "gold", "group": "defense",
                  "about": "Throws stones far over walls: they hit everyone where they land. Can't hit anyone close.",
                  "count": [0, 0, 1, 1, 1, 2, 2, 3, 3, 4],
                  "cost": [8000, 32000, 120000, 400000, 800000, 1200000, 1600000, 2000000],
                  "time": [3600, 7200, 14400, 28800, 43200, 57600, 72000, 86400],
                  "keep": [3, 4, 5, 6, 7, 8, 9, 10],
                  "hp":   [400, 450, 500, 550, 600, 650, 700, 800],
                  "damage": [4, 5, 6, 7, 9, 11, 13, 15],
                  "range": [11, 11, 11, 11, 11, 11, 11, 11]},
    # -- the army (it marches in phase 2)
    "barracks": {"name": "Barracks", "size": 3, "pays": "food", "group": "army",
                 "about": "Trains soldiers. Each level trains a new kind.",
                 "count": [1, 2, 2, 3, 3, 3, 4, 4, 4, 4],
                 "cost": [200, 1000, 2500, 5000, 10000, 80000, 240000, 700000, 1500000, 2000000],
                 "time": [10, 900, 3600, 7200, 14400, 28800, 43200, 57600, 72000, 86400],
                 "keep": [1, 1, 1, 2, 3, 4, 5, 6, 7, 8],
                 "hp":   [250, 290, 330, 370, 420, 470, 520, 580, 650, 730]},
    "army_camp": {"name": "Army camp", "size": 4, "pays": "food", "group": "army",
                  "about": "Where your soldiers wait. More levels, room for more.",
                  "count": [1, 1, 2, 2, 3, 3, 4, 4, 4, 4],
                  "cost": [250, 2500, 10000, 100000, 250000, 750000, 2250000, 3000000],
                  "time": [300, 3600, 10800, 28800, 43200, 64800, 86400, 108000],
                  "keep": [1, 2, 3, 4, 5, 6, 8, 9],
                  "hp":   [250, 270, 290, 310, 330, 350, 400, 500],
                  "room": [20, 30, 35, 40, 45, 50, 55, 60]},
    # -- walls: one tile each, many of them, upgraded at once (no builder)
    "wall": {"name": "Wall", "size": 1, "pays": "gold", "group": "walls",
             "about": "Slows raiders down: they must break through, or go round.",
             "count": [0, 25, 50, 75, 100, 125, 175, 225, 250, 275],
             "cost": [50, 1000, 5000, 10000, 30000, 75000, 200000, 500000, 1000000, 1500000],
             "time": [0] * 10,
             "keep": [2, 2, 3, 4, 5, 6, 7, 8, 9, 10],
             "hp":   [300, 500, 700, 900, 1400, 2000, 2500, 3000, 3500, 4000]},
}
GROUPS = [("economy", "Economy"), ("defense", "Defense"), ("army", "Army"), ("walls", "Walls")]
BUILDER_COSTS = [0, 0, 2500, 10000, 40000]       # the 1st, 2nd … 5th builder's hut (two come with the keep)
TIERS = [3, 6]                                   # a building's picture: levels 1-3, 4-6 and 7 on

# ---- a new kingdom: the keep in the middle, two builders, a mine and a farm
START_BUILDINGS = [("keep", 18, 18), ("builder_hut", 15, 17), ("builder_hut", 23, 17),
                   ("gold_mine", 14, 22), ("farm", 23, 22)]

# ---- what grows on the land: trees and rocks, cleared for a little gold or food
OBSTACLES = {
    "oak":     {"name": "Oak tree",  "pays": "gold", "cost": 100, "xp": 5},
    "pine":    {"name": "Pine tree", "pays": "gold", "cost": 120, "xp": 5},
    "bush":    {"name": "Bush",      "pays": "food", "cost": 60,  "xp": 3},
    "boulder": {"name": "Boulder",   "pays": "food", "cost": 200, "xp": 8},
    "stump":   {"name": "Stump",     "pays": "gold", "cost": 80,  "xp": 4},
}
START_OBSTACLES = 34                             # scattered over a new kingdom
OBSTACLES_MOST = 40
OBSTACLE_EVERY = 8 * 3600                        # a new one grows every 8 hours (real time), up to the most
OBSTACLE_SEED = 77

# ---- renown: XP from everything built (the square root of its seconds, as a long
# build is worth more but not hugely more), cleared and later won
RENOWN_XP = [0, 30, 80, 150, 250, 380, 540, 740, 980, 1260]
RENOWN_STEP = 320                                # after that, each level this much more than the last
CANCEL_BACK = 0.5                                # a cancelled build gives back half its price
