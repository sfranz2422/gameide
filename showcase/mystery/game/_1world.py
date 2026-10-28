# script: world
# Where everything is: the rooms, the things in them you can click, where
# you can walk, the people, and the items. Coordinates are pixels in the
# room picture, which is 320 x 144 (the top of the screen).
#
# A spot is something you can click:
#   box    its rectangle (x1, y1, x2, y2)
#   stand  where Robin walks to before doing anything with it
#   face   which way Robin turns to it: "left", "right", "front", "back"
#   exit   (room, x, y): walking through it goes there
#   actor  a person standing there, drawn from their sprite
#   when   shown only while this is true: "flag", "not:flag", "item:x", "no:x"

ROOM_H = 144

ACTORS = {
    "robin":   {"name": "Robin", "color": "#ffe14d", "sprite": "robin",
                "poses": {"walk": [0, 1, 2, 3, 4, 5], "front": 6, "back": 7, "side": 8, "talk": 9, "reach": 10}},
    "glorbin": {"name": "Ms. Glorbin", "color": "#9cf06a", "sprite": "glorbin",
                "poses": {"stand": 0, "talk": 1, "alien": 2, "alien_talk": 3}},
    "hoover":  {"name": "Principal Hoover", "color": "#8ecbff", "sprite": "hoover",
                "poses": {"asleep": 0, "awake": 1, "talk": 2}},
    "gus":     {"name": "Gus", "color": "#ffae57", "sprite": "gus", "poses": {"stand": 0, "talk": 1}},
    "dot":     {"name": "Dot", "color": "#ff8ad8", "sprite": "dot", "poses": {"asleep": 0, "awake": 1, "talk": 2}},
}

# What you can carry: its name, and its picture in the items sprite.
ITEMS = {
    "camera": ("camera", 0), "batteries": ("batteries", 1), "carton": ("empty milk carton", 2),
    "sample": ("carton of Sleepy Joe", 3), "hotsauce": ("hot sauce", 4), "ice": ("block of ice", 5),
    "keycard": ("alien keycard", 6), "roofkey": ("roof key", 7), "photo": ("photo", 8),
    "notepad": ("notepad", 9), "tinfoil": ("tinfoil", 10),
}

ROOMS = {
    "newsroom": {
        "name": "The Newsroom", "pic": "r01-newsroom",
        "walk": [(8, 106), (312, 106), (318, 143), (2, 143)], "scale": (106, 0.85, 143, 1.0),
        "spots": [
            {"id": "shelf_camera", "name": "camera", "box": (40, 40, 62, 58), "stand": (52, 112), "face": "back", "when": "not:took_camera"},
            {"id": "board", "name": "bulletin board", "box": (86, 18, 150, 72), "stand": (118, 112), "face": "back"},
            {"id": "computer", "name": "computer", "box": (168, 50, 206, 86), "stand": (188, 114), "face": "back"},
            {"id": "desk", "name": "desk", "box": (160, 86, 244, 106), "stand": (204, 118), "face": "back"},
            {"id": "door", "name": "door", "box": (274, 28, 306, 106), "stand": (288, 112), "face": "right", "exit": ("hallway", 30, 122)},
        ],
    },
    "hallway": {
        "name": "The Hallway", "pic": "r02-hallway",
        "walk": [(4, 106), (316, 106), (318, 143), (2, 143)], "scale": (106, 0.85, 143, 1.0),
        "spots": [
            {"id": "door_news", "name": "newsroom door", "box": (6, 28, 34, 106), "stand": (24, 114), "face": "left", "exit": ("newsroom", 276, 120)},
            {"id": "lockers", "name": "lockers", "box": (42, 30, 104, 102), "stand": (72, 114), "face": "back"},
            {"id": "trophies", "name": "trophy case", "box": (110, 40, 150, 92), "stand": (130, 114), "face": "back"},
            {"id": "door_cafe", "name": "cafeteria door", "box": (158, 28, 188, 106), "stand": (173, 112), "face": "back", "exit": ("cafeteria", 30, 122)},
            {"id": "door_office", "name": "office door", "box": (196, 28, 226, 106), "stand": (211, 112), "face": "back", "exit": ("office", 30, 122)},
            {"id": "fountain", "name": "water fountain", "box": (232, 66, 250, 98), "stand": (241, 114), "face": "back"},
            {"id": "door_base", "name": "basement door", "box": (256, 28, 284, 106), "stand": (270, 112), "face": "back", "exit": ("basement", 30, 122)},
            {"id": "stairs", "name": "stairs to the roof", "box": (290, 16, 318, 106), "stand": (300, 114), "face": "right", "exit": ("roof", 30, 122)},
        ],
    },
    "cafeteria": {
        "name": "The Cafeteria", "pic": "r03-cafeteria",
        "walk": [(4, 108), (316, 108), (318, 143), (2, 143)], "scale": (108, 0.85, 143, 1.0),
        "spots": [
            {"id": "door_hall", "name": "door to the hallway", "box": (4, 28, 30, 106), "stand": (20, 116), "face": "left", "exit": ("hallway", 173, 120)},
            {"id": "tables", "name": "tables", "box": (36, 84, 96, 106), "stand": (66, 116), "face": "back"},
            {"id": "dot", "name": "Dot", "actor": "dot", "at": (118, 108), "box": (104, 78, 134, 108), "stand": (118, 120), "face": "back"},
            {"id": "food", "name": "Sleepy Joes", "box": (164, 66, 202, 92), "stand": (184, 114), "face": "back"},
            {"id": "glorbin", "name": "Ms. Glorbin", "actor": "glorbin", "at": (222, 100), "box": (208, 54, 236, 100), "stand": (222, 114), "face": "back", "when": "not:glorbin_away"},
            {"id": "cartons", "name": "milk cartons", "box": (248, 64, 278, 96), "stand": (262, 114), "face": "back"},
            {"id": "door_kitchen", "name": "kitchen door", "box": (288, 28, 316, 106), "stand": (300, 114), "face": "right", "exit": ("kitchen", 30, 122)},
        ],
    },
    "kitchen": {
        "name": "The Kitchen", "pic": "r04-kitchen",
        "walk": [(4, 108), (316, 108), (318, 143), (2, 143)], "scale": (108, 0.85, 143, 1.0),
        "spots": [
            {"id": "door_cafe", "name": "door to the cafeteria", "box": (4, 28, 30, 106), "stand": (20, 116), "face": "left", "exit": ("cafeteria", 290, 120)},
            {"id": "pot", "name": "giant pot", "box": (56, 48, 122, 106), "stand": (90, 116), "face": "back"},
            {"id": "crate", "name": "crate", "box": (136, 70, 182, 106), "stand": (160, 116), "face": "back"},
            {"id": "freezer", "name": "freezer", "box": (196, 18, 252, 106), "stand": (224, 114), "face": "back"},
            {"id": "panel", "name": "glowing panel", "box": (268, 38, 302, 72), "stand": (285, 114), "face": "back"},
        ],
    },
    "office": {
        "name": "The Principal's Office", "pic": "r05-office",
        "walk": [(4, 108), (316, 108), (318, 143), (2, 143)], "scale": (108, 0.85, 143, 1.0),
        "spots": [
            {"id": "door_hall", "name": "door to the hallway", "box": (4, 28, 30, 106), "stand": (20, 116), "face": "left", "exit": ("hallway", 211, 120)},
            {"id": "catphoto", "name": "photo of a cat", "box": (78, 36, 102, 60), "stand": (90, 114), "face": "back"},
            {"id": "radio", "name": "clock radio", "box": (124, 62, 146, 76), "stand": (135, 116), "face": "back"},
            {"id": "keys", "name": "keys", "box": (152, 66, 168, 76), "stand": (160, 116), "face": "back"},
            {"id": "intercom", "name": "intercom", "box": (176, 54, 194, 76), "stand": (185, 116), "face": "back"},
            {"id": "hoover", "name": "Principal Hoover", "actor": "hoover", "at": (238, 106), "box": (220, 60, 258, 106), "stand": (220, 118), "face": "right"},
            {"id": "window", "name": "window", "box": (270, 16, 312, 70), "stand": (290, 114), "face": "back"},
        ],
    },
    "basement": {
        "name": "The Basement", "pic": "r06-basement",
        "walk": [(4, 108), (316, 108), (318, 143), (2, 143)], "scale": (108, 0.85, 143, 1.0),
        "spots": [
            {"id": "stairs_up", "name": "stairs up", "box": (4, 18, 30, 106), "stand": (20, 116), "face": "left", "exit": ("hallway", 270, 120)},
            {"id": "boiler", "name": "boiler", "box": (38, 18, 110, 106), "stand": (90, 118), "face": "back"},
            {"id": "bucket", "name": "mop bucket", "box": (124, 90, 146, 106), "stand": (135, 118), "face": "back"},
            {"id": "gus", "name": "Gus", "actor": "gus", "at": (176, 112), "box": (160, 62, 192, 112), "stand": (150, 120), "face": "right"},
            {"id": "hamradio", "name": "ham radio", "box": (208, 58, 240, 84), "stand": (224, 116), "face": "back"},
            {"id": "foilshelf", "name": "shelf of tinfoil", "box": (266, 26, 312, 82), "stand": (288, 114), "face": "back"},
        ],
    },
    "roof": {
        "name": "The Roof", "pic": "r07-roof",
        "walk": [(4, 110), (316, 110), (318, 143), (2, 143)], "scale": (110, 0.85, 143, 1.0),
        "spots": [
            {"id": "door_down", "name": "door downstairs", "box": (4, 38, 30, 108), "stand": (20, 118), "face": "left", "exit": ("hallway", 300, 120)},
            {"id": "telescope", "name": "telescope", "box": (76, 38, 142, 108), "stand": (110, 120), "face": "back"},
            {"id": "antenna", "name": "antenna", "box": (216, 8, 252, 108), "stand": (234, 120), "face": "back"},
            {"id": "moon", "name": "moon", "box": (268, 8, 302, 40), "stand": (280, 120), "face": "back"},
        ],
    },
    "mothership": {
        "name": "The Mothership", "pic": "r08-mothership",
        "walk": [(4, 110), (316, 110), (318, 143), (2, 143)], "scale": (110, 0.85, 143, 1.0),
        "spots": [
            {"id": "machine", "name": "Sleepy Sauce machine", "box": (36, 18, 112, 108), "stand": (100, 120), "face": "back"},
            {"id": "spacewindow", "name": "window", "box": (128, 8, 192, 60), "stand": (160, 118), "face": "back"},
            {"id": "commander", "name": "Ms. Glorbin", "actor": "glorbin", "at": (220, 112), "box": (204, 62, 238, 112), "stand": (196, 120), "face": "right"},
            {"id": "controls", "name": "controls", "box": (252, 40, 304, 82), "stand": (278, 118), "face": "back"},
        ],
    },
}

# The newspaper at the end (pic_newspaper, 150 x 200): where the headline
# and the photo go on it.
NEWS_X, NEWS_W = 85, 150
NEWS_HEAD_Y = 14
NEWS_PHOTO = (NEWS_X + 22, 46, NEWS_X + 128, 128)
