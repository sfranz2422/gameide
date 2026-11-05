# object: Oona
# sprite: npc_oona
# parent: Person
# The lamplighter. She gives the main quests.

# === create
super().on_create()

def lantern_to_light():
    """The next lantern not lit yet: each has its number in its creation code."""
    return next(l for l in instances("Lantern") if l.number == S["lit"] + 1)

def talk():
    if S["quests"].get("thorn_road") == 1:
        say("You found it! An ember from the old flame. Come, let's light this lantern.", "Oona", picture="face_oona")
        light_town_lantern(lantern_to_light(), "thorn_road", "ember_mine")
    elif "thorn_road" not in S["quests"] and "thorn_road" not in S["done"]:
        say("The flame that feeds the lanterns has broken into four embers, and scattered.", "Oona", picture="face_oona")
        say("Something in Whisper Wood is crashing about, and it's glowing. Go through the north gate.", "Oona", picture="face_oona")
        say("Take Pip with you. Pip! You've been dying for an adventure.", "Oona", picture="face_oona")
        start_quest("thorn_road")
    elif "thorn_road" in S["quests"]:
        say("Whisper Wood is north of town. Mind the thorns.", "Oona", picture="face_oona")
    elif S["quests"].get("ember_mine") == 4:
        say("Another one! And Bram's lad safe too. Quickly, the lantern on the mine road.", "Oona", picture="face_oona")
        light_town_lantern(lantern_to_light(), "ember_mine", "ember_marsh")
    elif "ember_mine" in S["quests"]:
        if S["quests"]["ember_mine"] == 0:
            say("One lit. It's something. The second ember fell on the old mine, east of town.", "Oona", picture="face_oona")
            say("Bram the smith knows those tunnels better than anyone. Ask him.", "Oona", picture="face_oona")
        else:
            say("The Ashdeep's east along the road, past the fence. Keep close to Bram.", "Oona", picture="face_oona")
    elif S["quests"].get("ember_marsh") == 3:
        say("You were at the chapel. Then you met him.", "Oona", picture="face_oona")
        say("Aldric. He carried the old flame's heart out of the great flood, sixty years ago, and he never came home.", "Oona", picture="face_oona")
        say("He said he'd keep it safe. He always did as he said, the stubborn, stubborn man.", "Oona", picture="face_oona")
        say("Come. The lantern by the south road. It looks out his way.", "Oona", picture="face_oona")
        light_town_lantern(lantern_to_light(), "ember_marsh", "ember_tower")
    elif "ember_marsh" in S["quests"]:
        if S["quests"]["ember_marsh"] == 0:
            say("Two lit. The third ember fell in the Mistfen, past the south road.", "Oona", picture="face_oona")
            say("Sedge lives out there. She's a witch, and she's rude, and she's never once been wrong. Find her.", "Oona", picture="face_oona")
        else:
            say("Do as Sedge tells you. It's annoying, but it works.", "Oona", picture="face_oona")
    elif S["quests"].get("ember_tower") == 3:
        say("You've seen him, then. And you've got it. Oh, child, you've got it.", "Oona", picture="face_oona")
        say("Come on. The last lantern's on the west road. Let's finish this.", "Oona", picture="face_oona")
        light_town_lantern(lantern_to_light(), "ember_tower", None)
    elif "ember_tower" in S["quests"]:
        if S["quests"]["ember_tower"] == 0:
            say("Three lit. The last ember went up the Hollow Tower, along the west road.", "Oona", picture="face_oona")
            say("Something up there is doing this on purpose. Sleep first. Buy the good armour. I mean it.", "Oona", picture="face_oona")
        else:
            say("The Hollow Tower, west of here. It's a long climb. Rest when you can.", "Oona", picture="face_oona")
    else:
        say("All four, burning like they never stopped. Go on, child, have a look round. You've earned it.", "Oona", picture="face_oona")

self.use = talk
