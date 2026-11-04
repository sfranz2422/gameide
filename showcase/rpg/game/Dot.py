# object: Dot
# sprite: npc_baker
# parent: Person
# The baker, who wants herbs.

# === create
super().on_create()

def talk():
    if "herbs" in S["done"]:
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
