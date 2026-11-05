# object: Innkeeper
# sprite: npc_inn
# parent: Person
# A bed puts everyone right, and the monsters out on the roads come back. Marta's
# cellar has beetles in it, and whoever deals with the nest sleeps free from then on.

# === create
super().on_create()

def beetles_left():
    return max(0, BEETLES_FOR_MARTA - S["beaten"].get("beetle", 0))

def talk():
    price = 0 if "beetles" in S["done"] else INN_PRICE
    if "beetles" in S["quests"] and not beetles_left():
        finish_quest("beetles")
        price = 0
        say("That's the nest gone, and my cellar's quiet! Your beds are free from now on, love.", "Marta")
    elif S["lit"] >= 1 and "beetles" not in S["quests"] and "beetles" not in S["done"]:
        say("I'm Marta. Cave Beetles are coming up from the mine and eating my cellar.", "Marta")
        say("Beat six of them, would you? I'd never charge you for a bed again.", "Marta")
        start_quest("beetles")
    elif "beetles" in S["quests"]:
        say(f"{beetles_left()} more beetles, love, and my cellar's safe.", "Marta")

    def pick(i):
        close_menus()
        if i == 0 and S["gold"] >= price:
            S["gold"] -= price
            rest_party()
            S["cleared"] = []
            save_game()
            screen_flash("black", 40)
            sound_play("quest")
            say("You sleep well, and wake up ready. Your journey is saved.")
        elif i == 0:
            sound_play("nope")
            say("Not enough gold, love. Come back with some.")

    open_menu(f"A bed is {price} gold" if price else "A bed is free, love", ["Stay the night"], pick, close_menus, left=200, top=120, w=240, back_words="Not now")

self.use = talk
