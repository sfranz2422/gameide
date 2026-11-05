# object: Shopkeeper
# sprite: npc_shop
# parent: Person
# Buys nothing, sells everything, and wants crystals for his window.

# === create
super().on_create()

def talk():
    if "crystals" in S["quests"] and count_item("glow_crystal") >= 4:
        take_item("glow_crystal", 4)
        finish_quest("crystals")
        S["gold"] += 120
        say("Beautiful! My window will glow like a sunset. There's 120 gold, and a thank you.", "Hob")
    elif S["lit"] >= 1 and "crystals" not in S["quests"] and "crystals" not in S["done"]:
        say("Name's Hob. With the lamps out, nobody can see my window. Glow Crystals would fix that.", "Hob")
        say("If you find four in the Ashdeep, I'll pay well. Anyway! Have a look, new stock's come in.", "Hob")
        start_quest("crystals")
    shop_menu()

self.use = talk
