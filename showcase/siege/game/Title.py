# object: Title
# The front page: play the computer; in a room, wait for the other player.

# === create
self.t = 0
if not sound_playing("music"):
    sound_play("music", loop=True, volume=0.4)

# === step
self.t += 1
if in_room():
    # In a room: say you're here, wait for the other player, then both go to the field.
    net_send({"here": 1})
    if opponent() is None:
        self.found = 0
    else:
        self.found = getattr(self, "found", 0) + 1
        if self.found > 90:
            room_goto("Field")
    return
if keyboard_check_pressed("space") or keyboard_check_pressed("enter") or \
        mouse_check_pressed("left") and 220 <= mouse_x <= 420 and 236 <= mouse_y <= 276:
    room_goto("Field")

# === draw
draw_sprite("title", 0, 0, 0)
draw_set_alpha(0.35)
draw_set_color("#14263a")
draw_rect(0, 0, VIEW_W, 175)
draw_set_alpha(1)
words(VIEW_W / 2, 60, "Tabletop Siege", 44, "white", "center")
words(VIEW_W / 2, 118, "A snowball war: snow kids, snowmen, owls and yetis, fort against fort.", 14, "#fff2d8", "center")
words(VIEW_W / 2, 150, "Drag cards onto your side. Knock down their towers.", 14, "#fff2d8", "center")
if in_room():
    them = opponent()
    if them is None:
        words(VIEW_W / 2, 236, f"Room {net_room()}: waiting for an opponent" + "." * (self.t // 30 % 4), 18, "white", "center")
        words(VIEW_W / 2, 264, "Tell a friend the code, or wait for a match.", 13, "#fff2d8", "center")
    else:
        words(VIEW_W / 2, 236, f"{them.name} is here!", 22, "#ffd23f", "center")
else:
    draw_set_color("#3ecf8e" if (self.t // 30) % 2 else "#2fb27a")
    draw_rect(220, 236, 420, 276)
    words(VIEW_W / 2, 245, "Play the computer", 18, "white", "center")
