# object: Hud
# depth: -80000
# One in every room of the map: what quest you're on and the party's health, and
# the room's mood: dark until the lanterns come back.

# === create
self.tick = 0
set_darkness()
if not flag("opening") and S["room"] == "Town":
    opening()
if S["room"] == "Mine" and not flag("mine_entered"):
    mine_entered()
after = S.pop("after_battle", None)
if after:
    STORY_AFTER[after]()

# === step
S["steps"] += 1
hero = instances("Player")[0] if instance_exists("Player") else None
if hero:
    light(hero.x, hero.y - 16, 170, "#ffe6b0", 1)
if mouse_check_pressed("left") and mouse_x - view_x > VIEW_W - 64 and mouse_y - view_y < 28 and not busy():
    pause_menu()

# === draw_gui
draw_set_font(None, 14)
draw_set_alpha(0.75)
draw_set_color("#141a2e")
draw_rect(0, 0, VIEW_W, 24)
draw_set_alpha(1)
draw_set_color("#ffd166")
key = main_quest()
draw_text(8, 4, quest_text(key) if key else "Talk to people. Press Z.")
draw_set_color("#ffffff")
draw_text(VIEW_W - 60, 4, "Menu")
y = VIEW_H - 22 * len(S["party"]) - 4
for h in S["party"]:
    draw_set_alpha(0.75)
    draw_set_color("#141a2e")
    draw_rect(4, y - 2, 190, y + 18)
    draw_set_alpha(1)
    draw_set_color("#ffffff")
    draw_text(8, y, f"{HEROES[h['key']]['name']} {h['hp']}/{stat(h, 'hp')}")
    y += 22
hero = instances("Player")[0] if instance_exists("Player") else None
near = getattr(hero, "near", None) if hero else None
if near and not busy():
    draw_set_color("#ffffff")
    draw_set_halign("center")
    draw_text(VIEW_W / 2, VIEW_H - 24, "Z: talk or use")
    draw_set_halign("left")
