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
        # The open floor only: not under the desks on the left, nor the bin in the corner.
        "walk": [(92, 118), (300, 118), (316, 126), (318, 143), (24, 143), (24, 128), (84, 128)], "scale": (118, 0.9, 143, 1.05),
        "spots": [
            {"id": "computer", "name": "computer", "box": (112, 50, 144, 84), "stand": (128, 124), "face": "back"},
            {"id": "board", "name": "bulletin board", "box": (164, 20, 229, 69), "stand": (196, 124), "face": "back"},
            {"id": "desk", "name": "desk", "box": (170, 72, 252, 118), "stand": (210, 126), "face": "back"},
            {"id": "bookshelf", "name": "bookshelf", "box": (256, 30, 300, 118), "stand": (278, 124), "face": "back"},
            {"id": "shelf_camera", "name": "camera", "box": (268, 14, 292, 30), "stand": (282, 124), "face": "back", "when": "not:took_camera"},
            {"id": "door", "name": "door", "box": (304, 18, 320, 130), "stand": (300, 126), "face": "right", "exit": ("hallway", 296, 124)},
        ],
    },
    "hallway": {
        "name": "The Hallway", "pic": "r02-hallway",
        "walk": [(4, 110), (316, 110), (318, 143), (2, 143)], "scale": (110, 0.85, 143, 1.05),
        "spots": [
            {"id": "stairs", "name": "stairs to the roof", "box": (0, 20, 36, 106), "stand": (22, 114), "face": "left", "exit": ("roof", 45, 130)},
            {"id": "door_cafe", "name": "cafeteria door", "box": (70, 42, 100, 106), "stand": (85, 114), "face": "back", "exit": ("cafeteria", 60, 104)},
            {"id": "lockers", "name": "lockers", "box": (106, 46, 160, 108), "stand": (133, 116), "face": "back"},
            {"id": "trophies", "name": "trophy case", "box": (164, 42, 210, 73), "stand": (187, 116), "face": "back"},
            {"id": "fountain", "name": "water fountain", "box": (189, 76, 209, 102), "stand": (199, 116), "face": "back"},
            {"id": "door_office", "name": "office door", "box": (214, 42, 246, 106), "stand": (230, 114), "face": "back", "exit": ("office", 296, 124)},
            {"id": "door_base", "name": "basement door", "box": (276, 40, 310, 106), "stand": (293, 114), "face": "back", "exit": ("basement", 28, 130)},
            {"id": "door_news", "name": "way to the newsroom", "box": (311, 40, 320, 143), "stand": (312, 126), "face": "right", "exit": ("newsroom", 296, 126)},
        ],
    },
    "cafeteria": {
        "name": "The Cafeteria", "pic": "r03-cafeteria",
        "walk": [(20, 100), (95, 100), (108, 84), (136, 84), (128, 118), (186, 118), (180, 143), (10, 143)],
        "scale": (84, 0.65, 143, 1.05),
        "spots": [
            {"id": "door_hall", "name": "door to the hallway", "box": (38, 34, 68, 96), "stand": (55, 102), "face": "left", "exit": ("hallway", 85, 116)},
            {"id": "door_kitchen", "name": "kitchen door", "box": (108, 40, 128, 80), "stand": (120, 86), "face": "back", "exit": ("kitchen", 284, 126)},
            {"id": "tables", "name": "tables", "box": (136, 64, 320, 88), "stand": (150, 118), "face": "right"},
            {"id": "dot", "name": "Dot", "actor": "dot", "at": (150, 108), "box": (136, 78, 166, 108), "stand": (150, 120), "face": "back"},
            {"id": "food", "name": "Sleepy Joes", "box": (190, 116, 320, 142), "stand": (178, 130), "face": "right"},
            {"id": "glorbin", "name": "Ms. Glorbin", "actor": "glorbin", "at": (200, 112), "box": (186, 60, 214, 112), "stand": (170, 120), "face": "right", "when": "not:glorbin_away"},
            {"id": "cartons", "name": "milk cartons", "box": (58, 112, 110, 138), "stand": (84, 128), "face": "front"},
        ],
    },
    "kitchen": {
        "name": "The Kitchen", "pic": "r04-kitchen",
        "walk": [(64, 120), (300, 120), (318, 143), (78, 143)], "scale": (120, 0.9, 143, 1.05),     # not over the crates bottom left
        "spots": [
            {"id": "pot", "name": "giant pot", "box": (70, 50, 118, 94), "stand": (95, 128), "face": "back"},
            {"id": "crate", "name": "crate", "box": (113, 93, 162, 130), "stand": (138, 134), "face": "back"},
            {"id": "panel", "name": "glowing panel", "box": (168, 56, 192, 74), "stand": (180, 124), "face": "back"},
            {"id": "keypad", "name": "keypad", "box": (204, 60, 216, 75), "stand": (212, 124), "face": "back"},
            {"id": "freezer", "name": "freezer", "box": (220, 38, 260, 116), "stand": (240, 124), "face": "back"},
            {"id": "door_cafe", "name": "door to the cafeteria", "box": (282, 34, 306, 124), "stand": (292, 126), "face": "right", "exit": ("cafeteria", 120, 88)},
        ],
    },
    "office": {
        "name": "The Principal's Office", "pic": "r05-office",
        "walk": [(158, 110), (304, 110), (318, 143), (4, 143), (4, 137), (150, 137)], "scale": (110, 0.9, 143, 1.05),
        "spots": [
            {"id": "radio", "name": "clock radio", "box": (8, 74, 32, 88), "stand": (30, 140), "face": "back"},
            {"id": "catphoto", "name": "photo of a cat", "box": (76, 28, 91, 48), "stand": (166, 120), "face": "left"},
            {"id": "keys", "name": "keys", "box": (78, 85, 94, 93), "stand": (90, 140), "face": "back"},
            {"id": "intercom", "name": "intercom", "box": (130, 62, 146, 82), "stand": (166, 122), "face": "left"},
            {"id": "window", "name": "window", "box": (95, 22, 187, 70), "stand": (172, 116), "face": "back"},
            {"id": "hoover", "name": "Principal Hoover", "actor": "hoover", "at": (206, 126), "box": (188, 82, 226, 126), "stand": (236, 128), "face": "left"},
            {"id": "door_hall", "name": "door to the hallway", "box": (304, 20, 320, 128), "stand": (300, 126), "face": "right", "exit": ("hallway", 230, 116)},
        ],
    },
    "basement": {
        "name": "The Basement", "pic": "r06-basement",
        "walk": [(10, 122), (310, 122), (318, 143), (2, 143)], "scale": (122, 0.9, 143, 1.05),
        "spots": [
            {"id": "stairs_up", "name": "stairs up", "box": (0, 36, 16, 122), "stand": (16, 130), "face": "left", "exit": ("hallway", 293, 116)},
            {"id": "boiler", "name": "boiler", "box": (50, 24, 146, 120), "stand": (100, 128), "face": "back"},
            {"id": "bucket", "name": "mop bucket", "box": (182, 100, 206, 134), "stand": (172, 132), "face": "right"},
            {"id": "gus", "name": "Gus", "actor": "gus", "at": (226, 132), "box": (210, 80, 242, 132), "stand": (204, 136), "face": "right"},
            {"id": "hamradio", "name": "ham radio", "box": (236, 72, 266, 92), "stand": (252, 126), "face": "back"},
            {"id": "foilshelf", "name": "shelf of tinfoil", "box": (270, 46, 300, 120), "stand": (286, 126), "face": "back"},
        ],
    },
    "roof": {
        "name": "The Roof", "pic": "r07-roof",
        "walk": [(40, 118), (262, 118), (300, 143), (10, 143)], "scale": (118, 0.85, 143, 1.0),
        "spots": [
            {"id": "door_down", "name": "stairs down", "box": (16, 96, 56, 126), "stand": (40, 130), "face": "left", "exit": ("hallway", 22, 116)},
            {"id": "telescope", "name": "telescope", "box": (80, 36, 152, 118), "stand": (140, 122), "face": "back"},
            {"id": "moon", "name": "moon", "box": (180, 10, 238, 65), "stand": (210, 122), "face": "back"},
            {"id": "antenna", "name": "antenna", "box": (244, 8, 286, 122), "stand": (252, 124), "face": "right"},
        ],
    },
    "mothership": {
        "name": "The Mothership", "pic": "r08-mothership",
        "walk": [(50, 114), (300, 114), (318, 143), (30, 143)], "scale": (114, 0.9, 143, 1.05),
        "spots": [
            {"id": "hatch", "name": "hatch", "box": (0, 40, 40, 116), "stand": (48, 128), "face": "left"},
            {"id": "machine", "name": "Sleepy Sauce machine", "box": (70, 0, 140, 118), "stand": (110, 124), "face": "back"},
            {"id": "spacewindow", "name": "window", "box": (160, 18, 286, 84), "stand": (222, 118), "face": "back"},
            {"id": "controls", "name": "controls", "box": (288, 26, 320, 110), "stand": (296, 120), "face": "right"},
            {"id": "commander", "name": "Ms. Glorbin", "actor": "glorbin", "at": (250, 126), "box": (234, 72, 266, 126), "stand": (222, 128), "face": "right"},
        ],
    },
}

# The newspaper at the end (pic_newspaper, 150 x 200): where the headline
# and the photo go on it, measured on Gemini's paper: the headline's two
# lines in the box at the top and the grey band under it, the photo in the
# empty white box.
NEWS_X, NEWS_W = 85, 150
NEWS_HEAD_Y = (14, 32)
NEWS_PHOTO = (NEWS_X + 39, 49, NEWS_X + 89, 98)
