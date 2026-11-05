# object: Tam
# sprite: npc_child
# parent: Person
# A child who has lost a cat.

# === create
super().on_create()

def talk():
    if "kite" in S["quests"] and count_item("kite"):
        take_item("kite")
        finish_quest("kite")
        S["gear"].append("kite_string")
        say("My kite! You can have the string off my old one. It's lucky. Look in your Gear.", "Tam")
    elif "kite" in S["quests"]:
        say("It's stuck in that horrible tower somewhere. Up high, I think. Kites like high.", "Tam")
    elif S["lit"] >= 3 and "kite" not in S["done"]:
        say("I got my kite out again now it's lighter, and the wind took it all the way to the Hollow Tower!", "Tam")
        start_quest("kite")
    elif "kite" in S["done"]:
        say("It flies better now it's been somewhere scary.", "Tam")
    elif "cat" in S["done"]:
        say("Mittens is home! She's asleep on my kite.", "Tam")
    elif flag("found_cat"):
        finish_quest("cat")
        S["gear"].append("cat_ring")
        say("You found her! This was my gran's ring. It's yours. Look in your Gear.", "Tam")
    elif "cat" not in S["quests"]:
        say("Mittens ran into Whisper Wood when the lights went out. Please find her?", "Tam")
        start_quest("cat")
    else:
        say("She'll be somewhere high up. Or under something. She's a cat.", "Tam")

self.use = talk
