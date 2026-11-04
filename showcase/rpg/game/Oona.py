# object: Oona
# sprite: npc_oona
# parent: Person
# The lamplighter. She gives the main quests.

# === create
super().on_create()

def talk():
    lantern = instances("Lantern")[0]
    if S["quests"].get("thorn_road") == 1:
        say("You found it! An ember from the old flame. Come, let's light this lantern.", "Oona", picture="face_oona")
        light_town_lantern(lantern)
    elif "thorn_road" not in S["quests"] and "thorn_road" not in S["done"]:
        say("The flame that feeds the lanterns has broken into four embers, and scattered.", "Oona", picture="face_oona")
        say("Something in Whisper Wood is crashing about, and it's glowing. Go through the north gate.", "Oona", picture="face_oona")
        say("Take Pip with you. Pip! You've been dying for an adventure.", "Oona", picture="face_oona")
        start_quest("thorn_road")
    elif "thorn_road" in S["done"]:
        say("One lit. It's something. Rest up, child.", "Oona", picture="face_oona")
    else:
        say("Whisper Wood is north of town. Mind the thorns.", "Oona", picture="face_oona")

self.use = talk
