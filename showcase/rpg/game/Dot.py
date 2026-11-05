# object: Dot
# sprite: npc_baker
# parent: Person
# The baker, who wants herbs.

# === create
super().on_create()

def slimes_left():
    return max(0, SLIMES_FOR_DOT - S["beaten"].get("slime", 0))

def talk():
    if "slimes" in S["quests"] and not slimes_left():
        finish_quest("slimes")
        add_item("potion", 4)
        S["gold"] += 140
        say("The well's running clear! No more green bread. Here, 140 gold and four potions.", "Dot", picture="face_baker")
    elif "slimes" in S["quests"]:
        say(f"{slimes_left()} more Bog Slimes, and my well's safe.", "Dot", picture="face_baker")
    elif S["lit"] >= 2 and "slimes" not in S["done"]:
        say("Bog slime's coming up my well from the Mistfen. My bread's gone green. Beat six of them for me?", "Dot", picture="face_baker")
        start_quest("slimes")
    elif "herbs" in S["done"]:
        say("Moonherb rolls! Have a look at my prices, they're almost fair now.", "Dot", picture="face_baker")
    elif "herbs" not in S["quests"]:
        say("No light, and no moonherb. Nothing grows right. Could you pick me five in Whisper Wood?", "Dot", picture="face_baker")
        start_quest("herbs")
    elif count_item("herb") >= 5:
        take_item("herb", 5)
        finish_quest("herbs")
        add_item("bread", 3)
        S["gold"] += 40
        say("Oh, you lovely thing! Here, 40 gold and three loaves, still warm.", "Dot", picture="face_baker")
    else:
        say(f"That's {count_item('herb')} of 5. They grow where it's quiet.", "Dot", picture="face_baker")

self.use = talk
