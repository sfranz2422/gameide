# script: menus
# Opening menus. Each is a MenuBox instance, stacked: the newest answers.

ROW_H = 26


def confirm_pressed():
    return keyboard_check_pressed("z") or keyboard_check_pressed("enter") or keyboard_check_pressed("space")


def back_pressed():
    return keyboard_check_pressed("x") or keyboard_check_pressed("escape")


def newest_menu():
    boxes = instances("MenuBox")
    return boxes[-1] if boxes else None


def open_menu(title, options, on_pick, on_back=None, left=20, top=20, w=260, note="", on_move=None):
    """options is a list of words, or of (words, can it be picked). Returns the box."""
    box = instance_create(0, 0, "MenuBox")
    box.title = title
    box.options = [o if isinstance(o, tuple) else (o, True) for o in options]
    box.on_pick, box.on_back, box.on_move = on_pick, on_back, on_move
    box.left, box.top, box.w = left, top, w
    box.note = note
    box.depth = -90000 - len(instances("MenuBox"))
    box.row_y = lambda i: box.top + (32 if box.title else 8) + i * ROW_H
    box.height = lambda: (32 if box.title else 8) + len(box.options) * ROW_H + (30 if box.note else 6)
    return box


def close_menus():
    for box in instances("MenuBox"):
        box.destroy()


def hero_line(hero):
    return f"{HEROES[hero['key']]['name']}  Lv {hero['level']}  {hero['hp']}/{stat(hero, 'hp')} HP  {hero['mp']}/{stat(hero, 'mp')} MP"


def use_item_on(key, hero):
    """Uses an item; says whether it did anything, so a wasted potion isn't taken."""
    item = ITEMS[key]
    done = False
    if item.get("heal") and hero["hp"] < stat(hero, "hp") and hero["hp"] > 0:
        hero["hp"] = min(stat(hero, "hp"), hero["hp"] + item["heal"])
        done = True
    if item.get("mana") and hero["mp"] < stat(hero, "mp"):
        hero["mp"] = min(stat(hero, "mp"), hero["mp"] + item["mana"])
        done = True
    if done:
        take_item(key)
    return done


def pause_menu():
    def pick(i):
        [items_menu, gear_menu, party_menu, quests_menu, saved][i]()

    def saved():
        save_game()
        close_menus()
        say("Your journey is saved.")

    open_menu(f"{S['gold']} gold", ["Items", "Gear", "Party", "Quests", "Save"], pick, close_menus, w=150)


def items_menu():
    keys = [k for k in S["items"]]
    if not keys:
        say("Your bag is empty.")
        return

    def pick(i):
        key = keys[i]
        if not (ITEMS[key].get("heal") or ITEMS[key].get("mana")):
            say(ITEMS[key]["says"])
            return

        def on(j):
            if not use_item_on(key, S["party"][j]):
                sound_play("nope")
            newest_menu().destroy()
            newest_menu().destroy()
            items_menu()

        open_menu("On whom?", [hero_line(h) for h in S["party"]], on, lambda: newest_menu().destroy(), left=120, top=60, w=400)

    words = [f"{ITEMS[k]['name']} x{S['items'][k]}" for k in keys]
    open_menu("Items", words, pick, lambda: newest_menu().destroy(), left=60, w=240)


def gear_menu():
    def hero_pick(i):
        hero = S["party"][i]
        owned = [g for g in S["gear"] if hero["key"] in GEAR[g]["who"]]
        if not owned:
            say(f"Nothing new for {HEROES[hero['key']]['name']} to wear.")
            return

        def on(j):
            g = owned[j]
            slot = GEAR[g]["slot"]
            S["gear"].remove(g)
            S["gear"].append(hero[slot])
            hero[slot] = g
            hero["hp"] = min(hero["hp"], stat(hero, "hp"))
            newest_menu().destroy()
            sound_play("quest")
            say(f"{HEROES[hero['key']]['name']} now has the {GEAR[g]['name']}.")

        open_menu("Put on", [f"{GEAR[g]['name']}  {gear_words(g)}" for g in owned], on, lambda: newest_menu().destroy(), left=140, top=70, w=340)

    open_menu("Who?", [HEROES[h["key"]]["name"] for h in S["party"]], hero_pick, lambda: newest_menu().destroy(), left=60, w=150)


def gear_words(g):
    parts = [f"+{GEAR[g][k]} {k.upper()[:3]}" for k in ("atk", "mag", "dfn", "spd") if GEAR[g].get(k)]
    return " ".join(parts)


def party_menu():
    words = []
    for h in S["party"]:
        words.append((hero_line(h), True))
        words.append((f"  ATK {stat(h, 'atk')}  MAG {stat(h, 'mag')}  DEF {stat(h, 'dfn')}  SPD {stat(h, 'spd')}  next {xp_to_next(h['level']) - h['xp']} XP", True))
    open_menu("Party", words, lambda i: None, lambda: newest_menu().destroy(), left=60, w=520)


def quests_menu():
    words = [(QUESTS[k]["title"] + ": " + quest_text(k), True) for k in S["quests"]] + [(QUESTS[k]["title"] + " (done)", False) for k in S["done"]]
    if not words:
        say("Nothing to do yet.")
        return
    open_menu("Quests", words, lambda i: None, lambda: newest_menu().destroy(), left=30, w=590)


def shop_menu():
    wares = SHOP["Goods"]

    def label(k):
        data = ITEMS.get(k) or GEAR[k]
        extra = gear_words(k) if k in GEAR else data["says"]
        return (f"{data['name']}  {data['price']}g  {extra}", S["gold"] >= data["price"] and k not in owned_gear())

    def pick(i):
        k = wares[i]
        data = ITEMS.get(k) or GEAR[k]
        S["gold"] -= data["price"]
        if k in GEAR:
            S["gear"].append(k)
        else:
            add_item(k)
        sound_play("coin")
        newest_menu().destroy()
        shop_menu()

    open_menu(f"{S['gold']} gold", [label(k) for k in wares], pick, lambda: newest_menu().destroy(), left=40, w=560)


def owned_gear():
    return S["gear"] + [h[s] for h in S["party"] for s in ("weapon", "armour")]
