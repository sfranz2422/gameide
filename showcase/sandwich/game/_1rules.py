# script: rules
# Every number in Stack Shack is here: the breads, every layer you can put on a
# sandwich, how a stack balances, the bites, and the secret recipes. Change one
# here and the game, the pictures the build draws and the tests all follow.

VIEW_W, VIEW_H = 1024, 576
FPS = 60

# ---- the sandwich, at full size (pixels)
LAYER_W = 240               # every layer picture is this wide (a bread slice's width)
PLATE_X, PLATE_Y = 690, 500 # the middle of the plate on the counter; the bottom slice sits on it
STACK_ROOM = 360            # how tall a sandwich can grow on screen before the view zooms out
SQUASH = 0.36               # every layer is seen from a little above: its picture (drawn from above)
                            # is squashed to this share of its height, with a side as deep as it's thick
FILL_W = 1.06               # a filling's width, as a share of a slice's: a little wider, so
                            # lettuce and tomato poke out at the sides as they do in a real one

# ---- the breads: a loaf to choose and cut, then a bottom slice and a top slice.
# thick: how much height a slice adds to the stack (and how deep its side is drawn);
# pic_h: how tall the build's stand-in is, if the teacher's picture is missing.
BREADS = [
    {"key": "white",     "name": "White Bread",   "thick": 26, "pic_h": 40},
    {"key": "brown",     "name": "Wholemeal",     "thick": 26, "pic_h": 40},
    {"key": "baguette",  "name": "Baguette",      "thick": 26, "pic_h": 40},
    {"key": "sourdough", "name": "Sourdough",     "thick": 26, "pic_h": 44},
    {"key": "brioche",   "name": "Brioche",       "thick": 26, "pic_h": 44},
    {"key": "rye",       "name": "Dark Rye",      "thick": 26, "pic_h": 40},
]

# ---- everything that goes between the slices.
# kind: which tab of plates it's on. thick: height added to the stack. pic_h: its
# picture's height. slip: extra wobble when it lands (wet and round things slide).
# colour: for the Rainbow recipe. unlock: recipes to find before it's on the shelf.
# A sauce is a layer too (squiggled on the top), so recipes and bites treat it the same.
LAYERS = {
    # meat (and the other things a sandwich is built round)
    "chicken":    {"name": "Chicken",      "kind": "meat",   "thick": 18, "pic_h": 30, "meat": True},
    "beef":       {"name": "Roast Beef",   "kind": "meat",   "thick": 18, "pic_h": 30, "meat": True},
    "ham":        {"name": "Ham",          "kind": "meat",   "thick": 15, "pic_h": 28, "meat": True},
    "turkey":     {"name": "Turkey",       "kind": "meat",   "thick": 18, "pic_h": 30, "meat": True},
    "salami":     {"name": "Salami",       "kind": "meat",   "thick": 12,  "pic_h": 24, "meat": True, "colour": "red"},
    "bacon":      {"name": "Bacon",        "kind": "meat",   "thick": 12,  "pic_h": 24, "meat": True, "crunchy": True},
    "fish":       {"name": "Fish",         "kind": "meat",   "thick": 24, "pic_h": 34, "meat": True},
    "patty":      {"name": "Burger",       "kind": "meat",   "thick": 27, "pic_h": 36, "meat": True},
    "egg":        {"name": "Fried Egg",    "kind": "meat",   "thick": 15, "pic_h": 30, "slip": 10, "colour": "yellow"},
    "tofu":       {"name": "Tofu",         "kind": "meat",   "thick": 21, "pic_h": 32},
    # vegetables
    "lettuce":    {"name": "Lettuce",      "kind": "veg",    "thick": 12,  "pic_h": 34, "crunchy": True, "colour": "green"},
    "tomato":     {"name": "Tomato",       "kind": "veg",    "thick": 12,  "pic_h": 26, "slip": 8, "colour": "red"},
    "cucumber":   {"name": "Cucumber",     "kind": "veg",    "thick": 10,  "pic_h": 24, "crunchy": True, "colour": "green"},
    "onion":      {"name": "Red Onion",    "kind": "veg",    "thick": 9,  "pic_h": 22, "colour": "purple"},
    "pickles":    {"name": "Pickles",      "kind": "veg",    "thick": 9,  "pic_h": 22, "crunchy": True, "colour": "green"},
    "pepper":     {"name": "Green Pepper", "kind": "veg",    "thick": 9,  "pic_h": 24, "crunchy": True, "colour": "green"},
    "olives":     {"name": "Olives",       "kind": "veg",    "thick": 9,  "pic_h": 20, "slip": 6},
    "jalapeno":   {"name": "Jalapenos",    "kind": "veg",    "thick": 9,  "pic_h": 20, "spicy": True, "colour": "green"},
    "avocado":    {"name": "Avocado",      "kind": "veg",    "thick": 14,  "pic_h": 26, "slip": 8, "colour": "green"},
    "mushroom":   {"name": "Mushrooms",    "kind": "veg",    "thick": 10,  "pic_h": 22},
    # cheese and the silly things
    "cheddar":    {"name": "Cheddar",      "kind": "more",   "thick": 8,  "pic_h": 30, "cheese": True, "colour": "orange"},
    "swiss":      {"name": "Swiss",        "kind": "more",   "thick": 8,  "pic_h": 26, "cheese": True, "colour": "yellow"},
    "mozzarella": {"name": "Mozzarella",   "kind": "more",   "thick": 10,  "pic_h": 24, "cheese": True},
    "pb":         {"name": "Peanut Butter","kind": "more",   "thick": 5,  "pic_h": 18, "sweet": True},
    "jelly":      {"name": "Grape Jelly",  "kind": "more",   "thick": 5,  "pic_h": 18, "slip": 6, "sweet": True, "colour": "purple"},
    "chips":      {"name": "Chips",        "kind": "more",   "thick": 15, "pic_h": 28, "crunchy": True, "unlock": 1},
    "banana":     {"name": "Banana",       "kind": "more",   "thick": 12,  "pic_h": 24, "slip": 8, "sweet": True, "colour": "yellow", "unlock": 2},
    "pancake":    {"name": "Pancake",      "kind": "more",   "thick": 24, "pic_h": 32, "sweet": True, "unlock": 4},
    "marshmallow":{"name": "Marshmallows", "kind": "more",   "thick": 21, "pic_h": 30, "sweet": True, "unlock": 6},
    "gummy":      {"name": "Gummy Worms",  "kind": "more",   "thick": 15, "pic_h": 28, "sweet": True, "slip": 10, "unlock": 8},
    # sauces: no picture of their own on the sandwich, a squiggle in their colour
    "ketchup":    {"name": "Ketchup",      "kind": "sauce",  "thick": 3, "pic_h": 0, "ink": "#d62a1e", "colour": "red"},
    "mustard":    {"name": "Mustard",      "kind": "sauce",  "thick": 3, "pic_h": 0, "ink": "#f2c41a", "colour": "yellow"},
    "mayo":       {"name": "Mayo",         "kind": "sauce",  "thick": 3, "pic_h": 0, "ink": "#fbf6e4"},
    "hot":        {"name": "Hot Sauce",    "kind": "sauce",  "thick": 3, "pic_h": 0, "ink": "#ef4d14", "spicy": True, "colour": "red"},
    "bbq":        {"name": "BBQ Sauce",    "kind": "sauce",  "thick": 3, "pic_h": 0, "ink": "#6b2c14"},
    "pesto":      {"name": "Pesto",        "kind": "sauce",  "thick": 3, "pic_h": 0, "ink": "#4f9a2a", "colour": "green", "unlock": 3},
}
TABS = [("meat", "Meat"), ("veg", "Veggies"), ("more", "Cheese & More"), ("sauce", "Sauces")]

# ---- the meal: a side and a drink beside the plate (each optional)
SIDES = {"fries": "Fries", "soup": "Tomato Soup", "pickle_spear": "Pickle", "chips_side": "Chips"}
DRINKS = {"lemonade": "Lemonade", "iced_tea": "Iced Tea", "milk": "Milk", "juice": "Orange Juice"}
SIDE_BITES = 3              # bites to finish a side
SIPS = 3                    # sips to finish a drink

# ---- dropping and balancing
DROP_STEPS = 16             # a tapped layer falls for this long before it lands
JITTER = 8                  # a tapped layer lands up to this far off the middle of the one below
SUPPORT = 0.8               # a layer holds what's on it while their middle stays within this share of its half-width…
HEAVY = 390                 # …and less the heavier the pile above: by half under this much stack (pixels of thickness)
WOBBLE = 0.012              # how far a stack leans in its wobble for each pixel its weight is off-centre (radians at the top)
TUMBLE_STEPS = 70           # how long fallen layers take to fall off the screen

# ---- eating
BITES = 5                   # bites to eat a sandwich, right to left (the build cuts a picture for each)
SAUCE_DOTS = 40             # the most points a squiggle keeps


# ---- what's in a sandwich, for the recipes (s is what summary() in the stack script returns:
# s["bread"] the bread's key, s["fill"] every layer between the slices, bottom first)

def has(s, *keys):
    return all(k in s["fill"] for k in keys)


def only(s, *keys):
    """Exactly these things between the slices (as many of each as you like), nothing else."""
    return set(s["fill"]) == set(keys)


def count(s, key):
    return s["fill"].count(key)


def of_kind(s, kind):
    """How many DIFFERENT things of this kind are in it."""
    return len({k for k in s["fill"] if LAYERS[k]["kind"] == kind})


def meats(s):
    return len({k for k in s["fill"] if LAYERS[k].get("meat")})


def colours(s):
    return {LAYERS[k]["colour"] for k in s["fill"] if "colour" in LAYERS[k]}


# ---- the secret recipes, in the book's order. A sandwich can find several at once.
RECIPES = [
    {"name": "Just Bread",           "hint": "Nothing in the middle. Nothing at all.",
     "test": lambda s: len(s["fill"]) == 0},
    {"name": "The BLT",              "hint": "Bacon, a leaf and a slice of red.",
     "test": lambda s: has(s, "bacon", "lettuce", "tomato")},
    {"name": "PB&J",                 "hint": "The lunchbox classic: one nutty, one fruity, nothing else.",
     "test": lambda s: only(s, "pb", "jelly")},
    {"name": "Sunrise Stack",        "hint": "Breakfast: an egg, bacon and orange cheese.",
     "test": lambda s: has(s, "egg", "bacon", "cheddar")},
    {"name": "Plain Ham and Cheese", "hint": "Ham, one cheese, and nothing else at all.",
     "test": lambda s: has(s, "ham") and len(set(s["fill"])) == 2 and any(LAYERS[k].get("cheese") for k in s["fill"])},
    {"name": "The Club",             "hint": "Turkey, bacon, lettuce, tomato and a white sauce.",
     "test": lambda s: has(s, "turkey", "bacon", "lettuce", "tomato", "mayo")},
    {"name": "Fish Friday",          "hint": "Something from the sea, something green, something creamy.",
     "test": lambda s: has(s, "fish", "lettuce", "mayo")},
    {"name": "Burger in Disguise",   "hint": "A patty, cheese, pickles, ketchup and mustard.",
     "test": lambda s: has(s, "patty", "cheddar", "pickles", "ketchup", "mustard")},
    {"name": "Garden Party",         "hint": "Five different vegetables, and no meat.",
     "test": lambda s: of_kind(s, "veg") >= 5 and meats(s) == 0},
    {"name": "Dragon's Breath",      "hint": "Jalapenos, hot sauce and green peppers. Brave.",
     "test": lambda s: has(s, "jalapeno", "hot", "pepper")},
    {"name": "Cheese Tower",         "hint": "Six cheeses high, and nothing but cheese.",
     "test": lambda s: len(s["fill"]) >= 6 and all(LAYERS[k].get("cheese") for k in s["fill"])},
    {"name": "Rye Reuben-ish",       "hint": "Roast beef and holey cheese on the dark bread.",
     "test": lambda s: s["bread"] == "rye" and has(s, "beef", "swiss")},
    {"name": "Green Machine",        "hint": "Turkey, avocado and lettuce.",
     "test": lambda s: has(s, "turkey", "avocado", "lettuce")},
    {"name": "Mushroom Melt",        "hint": "Mushrooms, Swiss and roast beef.",
     "test": lambda s: has(s, "mushroom", "swiss", "beef")},
    {"name": "Tofu Garden",          "hint": "Tofu, avocado and cucumber, and no meat.",
     "test": lambda s: has(s, "tofu", "avocado", "cucumber") and meats(s) == 0},
    {"name": "Salami Stack",         "hint": "Three slices of salami, and no other meat.",
     "test": lambda s: count(s, "salami") >= 3 and meats(s) == 1},
    {"name": "Meat Mountain",        "hint": "Five different meats.",
     "test": lambda s: meats(s) >= 5},
    {"name": "Caprese",              "hint": "Mozzarella, tomato and the green sauce.",
     "test": lambda s: has(s, "mozzarella", "tomato", "pesto")},
    {"name": "Crunch Time",          "hint": "Ham, cheddar and a layer of something from a bag.",
     "test": lambda s: has(s, "ham", "cheddar", "chips")},
    {"name": "The King's Breakfast", "hint": "Peanut butter met a banana... and some bacon.",
     "test": lambda s: has(s, "pb", "banana", "bacon")},
    {"name": "Fishy Business",       "hint": "Fish and peanut butter. Why?",
     "test": lambda s: has(s, "fish", "pb")},
    {"name": "Rainbow",              "hint": "Something red, orange, yellow, green and purple.",
     "test": lambda s: colours(s) >= {"red", "orange", "yellow", "green", "purple"}},
    {"name": "Sauce Boss",           "hint": "Five different sauces on one sandwich.",
     "test": lambda s: of_kind(s, "sauce") >= 5},
    {"name": "Brunch Stack",         "hint": "Bacon and an egg with something you'd pour syrup on.",
     "test": lambda s: has(s, "pancake", "bacon", "egg")},
    {"name": "Fluffernutter",        "hint": "Peanut butter and something fluffy.",
     "test": lambda s: has(s, "pb", "marshmallow")},
    {"name": "Sweet Tooth",          "hint": "Four different sweet things, and no meat.",
     "test": lambda s: len({k for k in s["fill"] if LAYERS[k].get("sweet")}) >= 4 and meats(s) == 0},
    {"name": "Worm Burger",          "hint": "A burger patty with some wriggly company.",
     "test": lambda s: has(s, "patty", "gummy")},
    {"name": "Skyscraper",           "hint": "Twenty layers between the slices, and eat it all.",
     "test": lambda s: len(s["fill"]) >= 20},
]
