# script: rules
# Every number in Squeeze is here. Money is in CENTS (whole numbers) everywhere,
# so the ledger adds up exactly: with dollars as decimals, $0.10 + $0.20 isn't
# $0.30 to a computer, and a student checking the sums would find a cent missing.

VIEW_W, VIEW_H = 1024, 576
DAYS = 30                    # a summer
START_MONEY = 2000           # $20.00 to start
START_REP = 0.3              # reputation, 0 (nobody trusts you) to 1 (the best on the block)

# ---- supplies: what a pack holds, and what it costs (cents), lowest and highest
# A day's prices are somewhere between, different each day (summer_plan).
SUPPLIES = [
    # key       name      pack  unit        low  high
    ("lemons", "Lemons",  12,  "lemons",    200, 320),
    ("sugar",  "Sugar",   20,  "scoops",    150, 240),
    ("ice",    "Ice",     60,  "cubes",     100, 160),
    ("cups",   "Cups",    25,  "cups",      100, 150),
]
SUPPLY_KEYS = [s[0] for s in SUPPLIES]
MAX_PACKS = 9                # packs of one thing in a morning
LEMON_DAYS = 3               # a lemon bought on day 1 is usable days 1, 2 and 3, and soft on day 4
ICE_KEPT_OVERNIGHT = 0.0     # without a cooler every cube has melted by morning
COOLER_KEPT_OVERNIGHT = 0.5  # ...with one, half are still there
ICE_MELT_LOW, ICE_MELT_HIGH = 0.05, 0.5   # the share of the ice melting over a day, at 55°F and at 100°F
COOLER_MELT = 0.5            # a cooler halves that

# ---- the recipe
CUPS_PER_PITCHER = 8
RECIPE_MAX = 8               # lemons and scoops a pitcher, cubes a cup, at most
PRICE_MIN, PRICE_MAX, PRICE_STEP = 25, 300, 5     # 25¢ to $3.00, in 5¢ steps
JUICER_SAVES = 0.75          # with a juicer, a pitcher needs three quarters of the lemons (squeezed harder)

# ---- places: a crowd (customers on a good day), rent (each day you're there),
# what it costs to start selling there, where feet are on its picture's path (ground),
# how rain changes the crowd, and who comes
# by (customer types, CUSTOMERS below; listed twice is twice as likely).
PLACES = [
    {"key": "park",     "name": "The Park",     "crowd": 70,  "rent": 0,    "unlock": 0,    "ground": 500,
     "rain": 0.40, "budget": (80, 220),  "types": [0, 1, 3, 5, 8, 9, 0, 3, 5, 11]},
    {"key": "beach",    "name": "The Beach",    "crowd": 105, "rent": 600,  "unlock": 2000, "ground": 520,
     "rain": 0.15, "budget": (90, 250),  "types": [4, 9, 3, 7, 4, 9, 0, 8]},
    {"key": "ballpark", "name": "The Ballpark", "crowd": 95,  "rent": 900,  "unlock": 4000, "ground": 522,
     "rain": 0.55, "budget": (110, 280), "types": [10, 10, 2, 7, 6, 3, 4, 1]},
    {"key": "downtown", "name": "Downtown",     "crowd": 120, "rent": 1300, "unlock": 6000, "ground": 520,
     "rain": 0.75, "budget": (110, 300), "types": [2, 2, 6, 11, 1, 4, 7, 5]},
]

# ---- customers: 12 kinds (the three customer sheets, four a sheet, in order).
# kid: likes it sweeter and has less to spend.
CUSTOMERS = [
    {"name": "jogger",      "kid": False, "budget": 1.0},
    {"name": "grandmother", "kid": False, "budget": 1.1},
    {"name": "office worker", "kid": False, "budget": 1.3},
    {"name": "skater",      "kid": True,  "budget": 0.6},
    {"name": "tourist",     "kid": False, "budget": 1.3},
    {"name": "dog walker",  "kid": False, "budget": 1.0},
    {"name": "builder",     "kid": False, "budget": 1.1},
    {"name": "teenager",    "kid": True,  "budget": 0.8},
    {"name": "parent",      "kid": False, "budget": 1.0},
    {"name": "beach-goer",  "kid": False, "budget": 0.9},
    {"name": "fan",         "kid": False, "budget": 1.2},
    {"name": "mail carrier", "kid": False, "budget": 0.9},
]

# ---- who stops, and what they think
THIRST_LOW, THIRST_HIGH = 55, 100   # °F: nobody's thirsty below the first; everyone above the second
THIRSTY_ENOUGH = 0.15               # thirst below this: they walk past without a look
NOTICE = 0.6                        # the chance someone looking notices your stand...
NOTICE_SIGN = 0.15                  # ...more with a sign...
NOTICE_REP = 0.2                    # ...and more the better you're known (times reputation)
PAY_BASE, PAY_THIRST = 0.45, 0.65   # what they'd pay: budget x (PAY_BASE + PAY_THIRST x thirst)...
PAY_REP = 0.3                       # ...x (0.85 + PAY_REP x reputation)
PINK_FANS = 0.35                    # the share of customers who love pink lemonade...
PINK_PAYS = 1.25                    # ...and will pay this much more for it
QUEUE_MAX = 6                       # nobody joins a queue longer than this...
QUEUE_SECOND_STAND = 4              # ...four more with a second stand
RIVAL_STEALS = 0.4                  # a rival cheaper than you takes this share of those who'd buy

# A taste is off when the recipe is this far from what they like (lemons, sugar, ice).
TASTE_SLACK = 2
# What each verdict does to your reputation.
REP_CHANGE = {"perfect": 0.006, "love": 0.010, "sour": -0.006, "sweet": -0.006, "watery": -0.006,
              "warm": -0.004, "pricey": -0.002, "thirsty": -0.004}
VERDICTS = ["perfect", "love", "sour", "sweet", "watery", "warm", "pricey", "thirsty"]
VERDICT_WORDS = {"perfect": "Perfect!", "love": "Love the pink!", "sour": "Too sour", "sweet": "Too sweet",
                 "watery": "Watery", "warm": "Not cold enough", "pricey": "Too pricey", "thirsty": "Sold out!"}
# Which thought bubble picture each verdict shows (the bubble sheet's order).
BUBBLE = {"sour": 0, "sweet": 1, "watery": 2, "warm": 2, "pricey": 3, "perfect": 4, "love": 4, "thirsty": 5}

# ---- crowd: how temperature and sky change it
CROWD_TEMP_LOW, CROWD_TEMP_HIGH = 0.4, 1.6      # at 60°F and at 100°F and above
SKY_CROWD = {"sunny": 1.0, "cloudy": 0.85}       # rain is each place's own "rain"
CROWD_REP_BASE, CROWD_REP = 0.7, 0.6             # x (0.7 + 0.6 x reputation)
SIGN_CROWD = 1.15
PARADE_CROWD = 2.5                               # downtown on parade day

# ---- the weather: a summer arc, noise, and events
TEMP_MID, TEMP_ARC, TEMP_NOISE = 74, 12, 6       # °F: the middle of summer is TEMP_MID + TEMP_ARC
RAIN_CHANCE, CLOUD_CHANCE = 0.12, 0.25
FORECAST_TEMP_ERROR = 4                          # forecasts are this many °F out, at most
HEAT_WAVE_DAYS, HEAT_WAVE_EXTRA = 3, 12
RAINY_WEEK_DAYS = 4
RIVAL_CHANCE = 0.2                               # days a rival sets up beside you (from day 4)
RIVAL_PRICE = (50, 80)                           # what they charge, cents

# ---- upgrades: (key, name, cost, what it does)
UPGRADES = [
    ("cooler", "Cooler",           1500, "Ice melts half as fast, and half lasts the night"),
    ("sign",   "Big sign",         2000, "More people notice your stand"),
    ("juicer", "Juicer",           2500, "A pitcher needs fewer lemons"),
    ("pink",   "Pink lemonade",    3000, "Some customers love it, and pay more"),
    ("second", "Second stand",     5000, "Serve twice as fast; a longer queue"),
]

# ---- the day on the street
DAY_STEPS = 4800             # 80 seconds at 1x
SPAWN_UNTIL = 0.9            # customers stop coming at nine tenths of the day
WALK = 1.6                   # pixels a step a customer walks
SERVE_STEPS = 40             # pouring one cup
PITCHER_STEPS = 100          # making a pitcher
DRINK_STEPS = 70             # drinking, by the stand, before they say what they think
SPEEDS = [1, 2, 4]
STAND_X = 560                # the stand's middle
DECIDE_X = 330               # where a passer-by decides whether to stop
QUEUE_GAP = 44               # between people in the queue
OWNER_LIFT = 45              # you stand this far above the stand's foot: your lower half behind the counter, your hat under the awning

# ---- the end of the summer: names for how you did, by money at the end
RANKS = [(0, "Sour Start"), (4000, "Squeezer"), (15000, "Lemon Pro"), (40000, "Lemonade Tycoon"), (80000, "Lemon Legend")]


def money(cents):
    """Cents as dollars, the way a price tag says it: 125 -> "$1.25"; minus in front."""
    sign = "-" if cents < 0 else ""
    cents = abs(int(cents))
    return f"{sign}${cents // 100}.{cents % 100:02d}"


def rank_of(cents):
    out = RANKS[0][1]
    for at, name in RANKS:
        if cents >= at:
            out = name
    return out
