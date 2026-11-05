# script: data
# The numbers of the game, all in one place: who's who, what things do, what's
# for sale, and what each quest says. Change a number here and the game follows.

VIEW_W, VIEW_H = 640, 360
LANTERNS_TO_LIGHT = 4

# A hero's first numbers, then what each level adds. Skills are learned at a level.
HEROES = {
    "wren": {"name": "Wren", "hp": 34, "mp": 8, "atk": 8, "mag": 2, "dfn": 4, "spd": 7,
             "grow": {"hp": 7, "mp": 2, "atk": 2, "mag": 0.4, "dfn": 1.0, "spd": 0.5},
             "skills": {2: "quick_cut", 4: "cleave", 8: "hero_strike"}, "weapon": "short_sword", "armour": "tunic"},
    "pip": {"name": "Pip", "hp": 24, "mp": 18, "atk": 4, "mag": 8, "dfn": 3, "spd": 6,
            "grow": {"hp": 4, "mp": 4, "atk": 0.6, "mag": 2, "dfn": 0.6, "spd": 0.4},
            "skills": {1: "mend", 3: "ember", 6: "glow", 9: "blaze"}, "weapon": "oak_staff", "armour": "robe"},
    "bram": {"name": "Bram", "hp": 46, "mp": 6, "atk": 10, "mag": 1, "dfn": 7, "spd": 3,
             "grow": {"hp": 9, "mp": 1, "atk": 2.4, "mag": 0.2, "dfn": 1.4, "spd": 0.3},
             "skills": {1: "smash", 7: "quake"}, "weapon": "hammer", "armour": "apron"},
}

# power multiplies the stat; kind says who it reaches.
SKILLS = {
    "quick_cut": {"name": "Quick Cut", "mp": 2, "kind": "foe", "stat": "atk", "power": 1.4, "says": "A fast cut for one foe."},
    "cleave": {"name": "Cleave", "mp": 4, "kind": "foes", "stat": "atk", "power": 0.9, "says": "Swings at every foe."},
    "hero_strike": {"name": "Hero Strike", "mp": 7, "kind": "foe", "stat": "atk", "power": 2.6, "says": "A huge blow for one foe."},
    "mend": {"name": "Mend", "mp": 3, "kind": "ally", "stat": "mag", "power": 2.2, "says": "Heals one friend."},
    "glow": {"name": "Glow", "mp": 7, "kind": "allies", "stat": "mag", "power": 1.5, "says": "Heals everyone a little."},
    "ember": {"name": "Ember", "mp": 3, "kind": "foe", "stat": "mag", "power": 1.8, "says": "Fire for one foe."},
    "blaze": {"name": "Blaze", "mp": 8, "kind": "foes", "stat": "mag", "power": 1.5, "says": "Fire for every foe."},
    "smash": {"name": "Smash", "mp": 2, "kind": "foe", "stat": "atk", "power": 1.6, "says": "A heavy hit for one foe."},
    "quake": {"name": "Quake", "mp": 5, "kind": "foes", "stat": "atk", "power": 1.1, "says": "Shakes every foe."},
}

ITEMS = {
    "potion": {"name": "Potion", "price": 12, "heal": 30, "says": "Heals 30 HP."},
    "ether": {"name": "Ether", "price": 30, "mana": 15, "says": "Gives back 15 MP."},
    "bread": {"name": "Bread", "price": 6, "heal": 12, "says": "Heals 12 HP. Fresh this morning."},
    "herb": {"name": "Moonherb", "price": 0, "says": "The baker wants these."},
    "ember_shard": {"name": "Ember Shard", "price": 0, "says": "Warm to the touch. A lantern would take this."},
    "mine_key": {"name": "Foreman's Key", "price": 0, "says": "Heavy, and it smells of old tea. It fits the mine's lift."},
    "glow_crystal": {"name": "Glow Crystal", "price": 0, "says": "Warm and orange. The shopkeeper wants these."},
    "lily": {"name": "Marsh Lily", "price": 0, "says": "Pale, and smells of rain. Sedge wants these."},
}

GEAR = {
    "short_sword": {"name": "Short Sword", "slot": "weapon", "atk": 0, "price": 0, "who": ("wren",)},
    "iron_sword": {"name": "Iron Sword", "slot": "weapon", "atk": 5, "price": 80, "who": ("wren",)},
    "oak_staff": {"name": "Oak Staff", "slot": "weapon", "mag": 0, "price": 0, "who": ("pip",)},
    "ash_staff": {"name": "Ash Staff", "slot": "weapon", "mag": 4, "price": 70, "who": ("pip",)},
    "hammer": {"name": "Hammer", "slot": "weapon", "atk": 0, "price": 0, "who": ("bram",)},
    "tunic": {"name": "Tunic", "slot": "armour", "dfn": 0, "price": 0, "who": ("wren",)},
    "robe": {"name": "Robe", "slot": "armour", "dfn": 0, "price": 0, "who": ("pip",)},
    "apron": {"name": "Apron", "slot": "armour", "dfn": 0, "price": 0, "who": ("bram",)},
    "leather": {"name": "Leather Armour", "slot": "armour", "dfn": 3, "price": 50, "who": ("wren", "pip", "bram")},
    "great_sword": {"name": "Great Sword", "slot": "weapon", "atk": 9, "price": 170, "who": ("wren",)},
    "silver_staff": {"name": "Silver Staff", "slot": "weapon", "mag": 8, "price": 150, "who": ("pip",)},
    "war_hammer": {"name": "War Hammer", "slot": "weapon", "atk": 7, "price": 130, "who": ("bram",)},
    "foreman_hammer": {"name": "Foreman's Hammer", "slot": "weapon", "atk": 5, "price": 0, "who": ("bram",)},
    "iron_armour": {"name": "Iron Armour", "slot": "armour", "dfn": 6, "price": 140, "who": ("wren", "pip", "bram")},
    "moon_sword": {"name": "Moon Sword", "slot": "weapon", "atk": 14, "price": 300, "who": ("wren",)},
    "fen_staff": {"name": "Fen Staff", "slot": "weapon", "mag": 13, "price": 280, "who": ("pip",)},
    "great_maul": {"name": "Great Maul", "slot": "weapon", "atk": 12, "price": 260, "who": ("bram",)},
    "scale_armour": {"name": "Scale Armour", "slot": "armour", "dfn": 10, "price": 260, "who": ("wren", "pip", "bram")},
    "drowned_mail": {"name": "Drowned Mail", "slot": "armour", "dfn": 8, "price": 0, "who": ("wren", "pip", "bram")},
    "cat_ring": {"name": "Silver Ring", "slot": "armour", "dfn": 2, "spd": 3, "price": 0, "who": ("wren", "pip", "bram")},
}

# A foe's moves: (what it's called, how hard, "one" or "all"). It picks at random, in proportion.
FOES = {
    "thornling": {"name": "Thornling", "hp": 14, "atk": 6, "dfn": 1, "spd": 4, "xp": 6, "gold": 4, "moves": [("Prickle", 1.0, "one")]},
    "bat": {"name": "Big-Ear Bat", "hp": 10, "atk": 5, "dfn": 0, "spd": 9, "xp": 5, "gold": 3, "moves": [("Bite", 1.0, "one")]},
    "shroom": {"name": "Cross Mushroom", "hp": 20, "atk": 6, "dfn": 2, "spd": 2, "xp": 8, "gold": 6, "moves": [("Bonk", 1.0, "one"), ("Spores", 0.6, "all")]},
    "thornback": {"name": "Thornback", "hp": 80, "atk": 11, "dfn": 3, "spd": 5, "xp": 60, "gold": 60, "boss": True,
                  "moves": [("Gore", 1.2, "one"), ("Gore", 1.2, "one"), ("Bramble Storm", 0.7, "all")]},
    "beetle": {"name": "Cave Beetle", "hp": 26, "atk": 11, "dfn": 7, "spd": 5, "xp": 13, "gold": 9, "moves": [("Pinch", 1.0, "one")]},
    "rockling": {"name": "Rockling", "hp": 34, "atk": 12, "dfn": 5, "spd": 3, "xp": 16, "gold": 11, "moves": [("Thump", 1.0, "one"), ("Pebbles", 0.6, "all")]},
    "mole": {"name": "Lantern Mole", "hp": 30, "atk": 14, "dfn": 3, "spd": 8, "xp": 18, "gold": 16, "moves": [("Pickaxe", 1.1, "one")]},
    # "charge": every so many of its turns it glows, and its next turn is this. Defend!
    "golem": {"name": "Ashdeep Golem", "hp": 190, "atk": 17, "dfn": 7, "spd": 2, "xp": 150, "gold": 150, "boss": True, "charge": (3, "Molten Burst", 1.5),
              "moves": [("Slam", 1.2, "one"), ("Slam", 1.2, "one"), ("Rockfall", 0.7, "all")]},
    "slime": {"name": "Bog Slime", "hp": 46, "atk": 16, "dfn": 5, "spd": 3, "xp": 24, "gold": 16, "moves": [("Ooze", 1.0, "one"), ("Splash", 0.6, "all")]},
    "frog": {"name": "Rust Frog", "hp": 40, "atk": 18, "dfn": 10, "spd": 7, "xp": 28, "gold": 20, "moves": [("Spear", 1.1, "one")]},
    # "ghost": steel only does a third. Pip's fire does it all.
    "wisp": {"name": "Pale Wisp", "hp": 26, "atk": 17, "dfn": 2, "spd": 10, "xp": 30, "gold": 22, "ghost": True, "moves": [("Scorch", 1.0, "one")]},
    # "shield": every so many of its turns it raises this, and steel does a third until fire breaks it.
    "knight": {"name": "Drowned Knight", "hp": 230, "atk": 22, "dfn": 9, "spd": 4, "xp": 280, "gold": 220, "boss": True, "shield": 3,
               "moves": [("Rusty Cleave", 1.2, "one"), ("Rusty Cleave", 1.2, "one"), ("Tide of Mud", 0.7, "all")]},
}

# What each foe on the map brings to a fight, by the name of its object.
MAP_GROUPS = {
    "Thornling": ["thornling", "thornling"],
    "Bat": ["bat", "bat", "thornling"],
    "Shroom": ["shroom", "bat"],
    "Thornback": ["thornback"],
    "Beetle": ["beetle", "beetle"],
    "Rockling": ["rockling", "beetle"],
    "Mole": ["mole", "rockling"],
    "Golem": ["golem"],
    "Slime": ["slime", "slime"],
    "Frog": ["frog", "slime"],
    "Wisp": ["wisp", "wisp"],
    "Knight": ["knight"],
}

# Later goods come in with each lantern lit: the road's a bit safer, so the carts get through.
SHOP = {"Goods": ["potion", "ether", "bread", "iron_sword", "ash_staff", "leather"],
        "After a lantern": ["great_sword", "silver_staff", "war_hammer", "iron_armour"],
        "After two lanterns": ["moon_sword", "fen_staff", "great_maul", "scale_armour"]}
INN_PRICE = 8
BEETLES_FOR_MARTA = 6
SLIMES_FOR_DOT = 6
LILIES_FOR_SEDGE = 5
SLUICES = 3

# The picture behind a battle, by the room it started in.
BATTLE_BACK = {"Town": "back_fields", "Forest": "back_forest", "Mine": "back_mine", "MineDeep": "back_mine", "Marsh": "back_marsh", "Chapel": "back_marsh"}

# Each quest: its title, then what to do at each stage. A quest's stage is kept in S["quests"].
QUESTS = {
    "thorn_road": {"title": "The Thorn Road", "main": True, "stages": [
        "Find what's wrong in Whisper Wood, north of town.",
        "Bring the Ember Shard back to Oona.",
    ]},
    "herbs": {"title": "Five Moonherbs", "stages": ["Pick 5 Moonherbs in Whisper Wood for Dot."]},
    "cat": {"title": "Where's Mittens?", "stages": ["Find Mittens in Whisper Wood, and tell Tam."]},
    "ember_mine": {"title": "The Ashdeep Ember", "main": True, "stages": [
        "Ask Bram the smith about the old mine.",
        "Find Jory in the Ashdeep Mine, east of town.",
        "Find the foreman's key for the mine's lift.",
        "Take the lift down. Find what's glowing.",
        "Bring the second Ember Shard back to Oona.",
    ]},
    "crystals": {"title": "Four Glow Crystals", "stages": ["Bring 4 Glow Crystals from the mine to Hob."]},
    "beetles": {"title": "The Inn's Beetles", "stages": ["Beat 6 Cave Beetles in the mine for Marta."]},
    "ember_marsh": {"title": "The Drowned Light", "main": True, "stages": [
        "Go south to the Mistfen and find Sedge.",
        "Turn the three old sluices to drain the fen.",
        "Cross the causeway. Find what's drowned there.",
        "Bring the third Ember Shard back to Oona.",
    ]},
    "lilies": {"title": "Five Marsh Lilies", "stages": ["Pick 5 Marsh Lilies in the Mistfen for Sedge."]},
    "slimes": {"title": "Slime in the Well", "stages": ["Beat 6 Bog Slimes in the Mistfen for Dot."]},
    "next": {"title": "To be continued", "main": True, "stages": ["More of the valley comes in the next chapter."]},
}
