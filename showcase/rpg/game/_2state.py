# script: state
# Everything that has happened: one dict, S, which is what gets saved. Rooms are
# built afresh each time, so all that has to last lives here.

S = {}
SAVE_KEY = "hollowmere"


def new_hero(key):
    h = HEROES[key]
    return {"key": key, "level": 1, "xp": 0, "hp": h["hp"], "mp": h["mp"], "weapon": h["weapon"], "armour": h["armour"]}


def new_game():
    S.clear()
    S.update({
        "party": [new_hero("wren")], "gold": 30, "items": {"potion": 3}, "gear": [],
        "flags": {}, "quests": {}, "done": [], "lit": 0, "steps": 0,
        "cleared": [], "room": "Town", "at": None, "beaten": {},
    })


def save_game():
    save_set(SAVE_KEY, dict(S))


def has_save():
    return save_get(SAVE_KEY, None) is not None


def load_game():
    S.clear()
    S.update(save_get(SAVE_KEY))
    # A save from before a chapter was built: its "next" is now that chapter's quest.
    S.setdefault("beaten", {})
    if S["quests"].pop("next", None) is not None:
        S["quests"]["ember_mine" if "ember_mine" not in S["done"] else "ember_marsh"] = 0
    # A boss beaten twice, when that could happen, ran its quest off the end and every
    # frame after was an IndexError. Those saves are brought back to the quest's last stage.
    for key in S["quests"]:
        S["quests"][key] = min(S["quests"][key], len(QUESTS[key]["stages"]) - 1)


def flag(name):
    return S["flags"].get(name, False)


def set_flag(name, value=True):
    S["flags"][name] = value


def stat(hero, name):
    """A hero's number now: first number, levels, and what they're wearing."""
    base = HEROES[hero["key"]]
    n = base[name] + base["grow"][name] * (hero["level"] - 1)
    for slot in ("weapon", "armour"):
        n += GEAR[hero[slot]].get(name, 0)
    return int(n)


def xp_to_next(level):
    return int(16 * level ** 1.6)


def hero_skills(hero):
    return [s for lv, s in sorted(HEROES[hero["key"]]["skills"].items()) if lv <= hero["level"]]


def give_xp(hero, amount):
    """Adds xp, and returns the words for each level gained."""
    words = []
    hero["xp"] += amount
    while hero["xp"] >= xp_to_next(hero["level"]):
        hero["xp"] -= xp_to_next(hero["level"])
        hero["level"] += 1
        hero["hp"], hero["mp"] = stat(hero, "hp"), stat(hero, "mp")
        words.append(f"{HEROES[hero['key']]['name']} reached level {hero['level']}!")
        learned = HEROES[hero["key"]]["skills"].get(hero["level"])
        if learned:
            words.append(f"{HEROES[hero['key']]['name']} learned {SKILLS[learned]['name']}!")
    return words


def join_party(key):
    """A new friend arrives at about the level of the others."""
    hero = new_hero(key)
    level = max(h["level"] for h in S["party"])
    for _ in range(level - 1):
        give_xp(hero, xp_to_next(hero["level"]))
    S["party"].append(hero)


def add_item(key, n=1):
    S["items"][key] = S["items"].get(key, 0) + n


def take_item(key, n=1):
    S["items"][key] = S["items"].get(key, 0) - n
    if S["items"][key] <= 0:
        del S["items"][key]


def count_item(key):
    return S["items"].get(key, 0)


def start_quest(key):
    if key not in S["quests"] and key not in S["done"]:
        S["quests"][key] = 0
        sound_play("quest")


def advance_quest(key):
    S["quests"][key] = min(S["quests"][key] + 1, len(QUESTS[key]["stages"]) - 1)


def reach_stage(key, stage):
    """Moves a quest on to a stage, never back: things can be done out of order."""
    if key in S["quests"]:
        S["quests"][key] = max(S["quests"][key], stage)


def finish_quest(key):
    S["quests"].pop(key, None)
    S["done"].append(key)
    sound_play("quest")


def quest_text(key):
    return QUESTS[key]["stages"][S["quests"][key]]


def main_quest():
    for key in S["quests"]:
        if QUESTS[key].get("main"):
            return key
    return next(iter(S["quests"]), None)


def rest_party():
    for h in S["party"]:
        h["hp"], h["mp"] = stat(h, "hp"), stat(h, "mp")


def go_to(room, x=None, y=None):
    """Leaves for a room. Monsters beaten stay beaten only while you're in the same place."""
    if room != S["room"]:
        S["cleared"] = []
    S["room"] = room
    S["at"] = None if x is None else [x, y]
    save_game()
    room_goto(room)


def busy():
    """Is something on the screen waiting for an answer, so nobody should walk?"""
    return dialogue_open() or scene_playing() or instance_exists("MenuBox")
