# object: GameOver
# The party can always try again, from the last save.

# === create
def pick(i):
    close_menus()
    if i == 0 and has_save():
        load_game()
        rest_party()
        room_goto(S["room"])
    else:
        room_goto("Title")

open_menu("The lanterns stay dark...", ["Try again", "Title screen"], pick, left=190, top=130, w=260)
