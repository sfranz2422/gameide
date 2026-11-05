# object: Innkeeper
# sprite: npc_inn
# parent: Person
# A bed puts everyone right, and the monsters out on the roads come back.

# === create
super().on_create()

def talk():
    def pick(i):
        close_menus()
        if i == 0 and S["gold"] >= INN_PRICE:
            S["gold"] -= INN_PRICE
            rest_party()
            S["cleared"] = []
            save_game()
            screen_flash("black", 40)
            sound_play("quest")
            say("You sleep well, and wake up ready. Your journey is saved.")
        elif i == 0:
            sound_play("nope")
            say("Not enough gold, love. Come back with some.")

    open_menu(f"A bed is {INN_PRICE} gold", ["Stay the night"], pick, close_menus, left=200, top=120, w=240, back_words="Not now")

self.use = talk
