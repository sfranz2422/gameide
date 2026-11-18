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
MAP_W, MAP_H = 70, 70                       # 40 × 40 at first: the teacher asked for 75% more each way (2026-11-18)
MID = MAP_W // 2
ORIGIN_X = MAP_H * TILE_W // 2
ORIGIN_Y = 220                              # room above the top corner for tall towers
WORLD_W = (MAP_W + MAP_H) * TILE_W // 2
WORLD_H = ORIGIN_Y + (MAP_W + MAP_H) * TILE_H // 2 + 120
GROUND_STRIP = 2048                         # the ground picture's strips (Ground draws them; the build cuts them)
GROUND_STRIPS = -(-WORLD_W // GROUND_STRIP)

# How far out the view is (the teacher's ask: "zoomed out just a little, or an option to
# zoom out"): 1 is as drawn; the - and + buttons (and the Q and E keys) step through these.
ZOOMS = [0.55, 0.7, 0.85, 1.0]
ZOOM_START = 0.55                           # as far out as it goes (the teacher's ask)
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
START_BUILDINGS = [("keep", MID - 2, MID - 2), ("builder_hut", MID - 5, MID - 3), ("builder_hut", MID + 3, MID - 3),
                   ("gold_mine", MID - 6, MID + 2), ("farm", MID + 3, MID + 2)]

# ---- what grows on the land: trees and rocks, cleared for a little gold or food
OBSTACLES = {
    "oak":     {"name": "Oak tree",  "pays": "gold", "cost": 100, "xp": 5},
    "pine":    {"name": "Pine tree", "pays": "gold", "cost": 120, "xp": 5},
    "bush":    {"name": "Bush",      "pays": "food", "cost": 60,  "xp": 3},
    "boulder": {"name": "Boulder",   "pays": "food", "cost": 200, "xp": 8},
    "stump":   {"name": "Stump",     "pays": "gold", "cost": 80,  "xp": 4},
}
START_OBSTACLES = 100                            # scattered over a new kingdom
OBSTACLES_MOST = 120
OBSTACLE_EVERY = 8 * 3600                        # a new one grows every 8 hours (real time), up to the most
OBSTACLE_SEED = 77

# ---- renown: XP from everything built (the square root of its seconds, as a long
# build is worth more but not hugely more), cleared and later won
RENOWN_XP = [0, 30, 80, 150, 250, 380, 540, 740, 980, 1260]
RENOWN_STEP = 320                                # after that, each level this much more than the last
CANCEL_BACK = 0.5                                # a cancelled build gives back half its price

# ---- phase 2: the army
# Troops, trained in the barracks on the real clock (more barracks, faster) and kept in the
# army camps (each a number of "room"; a troop takes its `space`). Each kind opens at a
# barracks level. `wants` is what a troop goes for first: "any" building (not walls),
# "defense" (towers, ballistas, trebuchets), "loot" (where gold and food are kept) or
# "walls"; with none of those left, the nearest building of any kind. Speed is tiles a
# second, reach is tiles from the building's edge (melee 0.6), damage is a second.
TROOPS = {
    "footman":  {"name": "Footman",    "barracks": 1, "space": 1, "cost": 25,  "time": 20,  "hp": 45,  "damage": 8,
                 "speed": 1.0, "reach": 0.6, "wants": "any",     "about": "A sword and a shield: sturdy, and cheap."},
    "archer":   {"name": "Archer",     "barracks": 2, "space": 1, "cost": 50,  "time": 25,  "hp": 20,  "damage": 7,
                 "speed": 1.2, "reach": 3.5, "wants": "any",     "about": "Shoots from behind the walls. Easily hurt."},
    "brute":    {"name": "Man-at-arms", "barracks": 3, "space": 5, "cost": 250, "time": 120, "hp": 300, "damage": 11,
                 "speed": 0.6, "reach": 0.6, "wants": "defense", "about": "Heavy armour: walks straight for the defenses."},
    "raider":   {"name": "Raider",     "barracks": 4, "space": 1, "cost": 40,  "time": 30,  "hp": 25,  "damage": 11,
                 "speed": 1.8, "reach": 0.6, "wants": "loot",    "about": "Fast, and after the gold and food: double damage there."},
    "sapper":   {"name": "Sapper",     "barracks": 5, "space": 2, "cost": 600, "time": 60,  "hp": 20,  "damage": 0,
                 "speed": 1.5, "reach": 0.4, "wants": "walls",   "about": "Runs at the walls with a powder keg: walls burst open."},
    "knight":   {"name": "Knight",     "barracks": 6, "space": 6, "cost": 900, "time": 180, "hp": 500, "damage": 35,
                 "speed": 1.6, "reach": 0.7, "wants": "any",     "about": "On horseback: fast, strong, and hard to stop."},
    "ram":      {"name": "Battering ram", "barracks": 7, "space": 10, "cost": 2000, "time": 300, "hp": 1400, "damage": 60,
                 "speed": 0.5, "reach": 0.6, "wants": "defense", "about": "Rolls slowly up to a defense and smashes it."},
}
LOOT_DOUBLE = 2.0                 # a raider's damage on where gold and food are kept
SAPPER_BLAST = 150                # a sapper's keg: this many times a footman's blow (1,200), on walls within a tile and a half
TRAIN_QUEUE_MOST = 40             # troops waiting to be trained, at most

# What each defense does in battle: seconds between shots, how far the shot spreads
# (tiles; 0 is one troop), and the nearest it can shoot (a trebuchet can't hit what's close).
DEFENSE_SHOTS = {
    "archer_tower": {"every": 0.8, "splash": 0,   "least": 0, "shot": "arrow"},
    "ballista":     {"every": 1.6, "splash": 0,   "least": 0, "shot": "bolt"},
    "trebuchet":    {"every": 4.0, "splash": 1.5, "least": 4, "shot": "stone"},
}
SHOT_SPEED = 9                    # tiles a second
DEFENSES = list(DEFENSE_SHOTS)
LOOT_KINDS = ["keep", "gold_mine", "farm", "treasury", "granary"]

# ---- battles
BATTLE_TIME = 180                 # seconds
BATTLE_TICK = 1 / 30              # the battle is worked out 30 times a second
DEPLOY_GAP = 1                    # troops are put down at least this many tiles from any building or wall
WALL_DETOUR = 10                  # how many tiles' walk a wall is worth: further round than that, troops break through
STAR_HALF = 50                    # % of the buildings knocked down for the first star; the keep the second; all of them the third

# ---- the campaign: computer villages, each a little tougher. `keep` is the village's
# keep level (its buildings' levels follow it), `towers`/`ballistas`/`trebuchets` its
# defenses, `ring` the walls round it (0: none; 1: round the keep; 2: two rings), and
# its loot, all of it to win (it's not there again once taken).
CAMPAIGN = [
    {"name": "Thornby",       "keep": 1, "towers": 1, "ballistas": 0, "trebuchets": 0, "ring": 0, "gold": 500,    "food": 500},
    {"name": "Ashford",       "keep": 1, "towers": 2, "ballistas": 0, "trebuchets": 0, "ring": 0, "gold": 800,    "food": 800},
    {"name": "Millbrook",     "keep": 2, "towers": 2, "ballistas": 1, "trebuchets": 0, "ring": 1, "gold": 1500,   "food": 1500},
    {"name": "Redwater",      "keep": 2, "towers": 2, "ballistas": 2, "trebuchets": 0, "ring": 1, "gold": 2500,   "food": 2500},
    {"name": "Hollin Ford",   "keep": 3, "towers": 3, "ballistas": 2, "trebuchets": 0, "ring": 1, "gold": 4000,   "food": 4000},
    {"name": "Crowmere",      "keep": 3, "towers": 3, "ballistas": 2, "trebuchets": 1, "ring": 1, "gold": 6000,   "food": 6000},
    {"name": "Stonegate",     "keep": 4, "towers": 4, "ballistas": 2, "trebuchets": 1, "ring": 2, "gold": 9000,   "food": 9000},
    {"name": "Wolfden",       "keep": 4, "towers": 4, "ballistas": 3, "trebuchets": 1, "ring": 2, "gold": 13000,  "food": 13000},
    {"name": "Blackmoor",     "keep": 5, "towers": 5, "ballistas": 3, "trebuchets": 1, "ring": 2, "gold": 18000,  "food": 18000},
    {"name": "Kingsbridge",   "keep": 5, "towers": 5, "ballistas": 3, "trebuchets": 2, "ring": 2, "gold": 25000,  "food": 25000},
    {"name": "Harrowfell",    "keep": 6, "towers": 5, "ballistas": 4, "trebuchets": 2, "ring": 2, "gold": 34000,  "food": 34000},
    {"name": "Grimshaw",      "keep": 6, "towers": 6, "ballistas": 4, "trebuchets": 2, "ring": 2, "gold": 45000,  "food": 45000},
    {"name": "Dunmore",       "keep": 7, "towers": 6, "ballistas": 4, "trebuchets": 3, "ring": 2, "gold": 60000,  "food": 60000},
    {"name": "Ravenscar",     "keep": 7, "towers": 7, "ballistas": 5, "trebuchets": 3, "ring": 2, "gold": 80000,  "food": 80000},
    {"name": "Ironhold",      "keep": 8, "towers": 7, "ballistas": 5, "trebuchets": 3, "ring": 2, "gold": 105000, "food": 105000},
    {"name": "Dragonsmoor",   "keep": 9, "towers": 8, "ballistas": 6, "trebuchets": 4, "ring": 2, "gold": 140000, "food": 140000},
]
CAMPAIGN_XP = 8                   # renown for each new star, times the village's number
