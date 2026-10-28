# object: Game
# The whole adventure is this one object: the title, the rooms, Robin and
# everyone else, the verbs and the inventory, all drawn in Draw GUI. What
# happens is in story; how it's played out in engine; how it looks in screen.

# === create
self.t = 0
self.mode = "title"
self.rows = []
self.menu = ["Continue", "New game"] if save_get("game", None) else ["New game"]
music_play("theme", volume=0.5)

# === step
self.t += 1
clicked = mouse_check_pressed("left")
mx, my = mouse_x, mouse_y

if self.mode == "title":
    pick = next((i for i, (a, b) in enumerate(self.rows) if a <= my < b and 120 <= mx < 200), None) if clicked else None
    if keyboard_check_pressed("enter") or keyboard_check_pressed("space"):
        pick = 0
    if pick is not None:
        if self.menu[pick] == "Continue" and load_game():
            pass
        else:
            new_game()
            say_line("robin", "Deadline's Friday, and I've got no story. Something weird is going on at this school. I can feel it.")
            say_line("robin", "(Pick a verb below, then click something. Look at my notepad if I get stuck.)")
        self.mode = "play"
        sound_play("click", volume=0.6)
    return

if STATE.get("ended"):
    if clicked and self.t > 30:
        save_delete("game")
        self.menu = ["New game"]
        self.mode = "title"
        STATE.clear()
    return

if play_queue(clicked):
    return

if STATE["menu"]:
    i = option_at(mx, my)
    for k in range(len(STATE["menu"])):
        if keyboard_check_pressed(str(k + 1)):
            i, clicked = k, True
    if clicked and i is not None:
        sound_play("click", volume=0.4)
        choose_option(i)
    return

if not clicked:
    return
v = verb_at(mx, my)
if v:
    STATE["verb"] = v
    STATE["first"] = None
    sound_play("click", volume=0.4)
    return
step = scroll_at(mx, my)
if step:
    STATE["inv_top"] = clamp(STATE.get("inv_top", 0) + step, 0, max(0, (len(STATE["items"]) - 5) // 4))
    return
it = item_at(mx, my)
if it:
    if STATE["verb"] == "walk":
        STATE["verb"] = "look"
    click_thing(it)
    return
s = spot_at(mx, my)
if s:
    click_thing(s["id"])
elif my < ROOM_H:
    click_floor(mx, my)

# === draw_gui
mx, my = mouse_x, mouse_y
if self.mode == "title":
    draw_title(self, self.t, mx, my)
elif STATE.get("ended"):
    draw_ending(self.t)
else:
    draw_sprite("room_" + STATE["room"], 0, 0, 0)
    draw_people(self.t)
    draw_speech()
    draw_panel(self.t, mx, my)
    if STATE.get("code"):
        draw_code(STATE["code"])
        draw_speech()
    pic = picture_now()
    if pic:
        draw_picture_over(pic, self.t)
        draw_speech()
