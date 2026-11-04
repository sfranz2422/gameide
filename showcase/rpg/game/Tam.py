# object: Tam
# sprite: npc_child
# parent: Person
# A child who has lost a cat.

# === create
super().on_create()

def talk():
    if "cat" in S["done"]:
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
