# object: Title
# depth: -100

# === create
screen_fade(0, 30)
music_play("theme")
options = ["New Game"] + (["Continue"] if has_save() else [])

def pick(i):
    close_menus()
    if options[i] == "Continue":
        load_game()
        room_goto(S["room"])
    else:
        new_game()
        room_goto("Town")

open_menu("", options, pick, left=240, top=220, w=160)

# === draw
draw_sprite("title", 0, 0, 0)

# === draw_gui
draw_set_font(None, 36)
draw_set_color("#ffd166")
draw_set_halign("center")
draw_text(320, 60, "The Lanterns")
draw_text(320, 104, "of Hollowmere")
draw_set_halign("left")
