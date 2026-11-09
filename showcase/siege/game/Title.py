# object: Title
# The front page: play the computer (rooms come with the next phase).

# === create
self.t = 0
if not sound_playing("music"):
    sound_play("music", loop=True, volume=0.4)

# === step
self.t += 1
if keyboard_check_pressed("space") or keyboard_check_pressed("enter") or \
        mouse_check_pressed("left") and 220 <= mouse_x <= 420 and 236 <= mouse_y <= 276:
    room_goto("Desk")

# === draw
draw_set_color("#c8955a")
draw_rect(0, 0, VIEW_W, VIEW_H)
words(VIEW_W / 2, 60, "Tabletop Siege", 44, "white", "center")
words(VIEW_W / 2, 118, "Toy soldiers, wind-up knights and paper planes, battling across a desk.", 14, "#3b2a1a", "center")
words(VIEW_W / 2, 150, "Drag cards onto your side. Knock down their towers.", 14, "#3b2a1a", "center")
draw_set_color("#3ecf8e" if (self.t // 30) % 2 else "#2fb27a")
draw_rect(220, 236, 420, 276)
words(VIEW_W / 2, 245, "Play the computer", 18, "white", "center")
