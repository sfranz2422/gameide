# object: Jory
# sprite: npc_miner
# parent: Person
# Bram's apprentice: stuck in the mine, and back at the forge once it's safe.
# One object in two rooms: in each it's only there at the right time in the story.

# === create
super().on_create()
home = S["room"] == "Town"
if home != flag("golem_beaten"):
    self.destroy()

def talk():
    if home:
        left = max(0, ARMOURS_FOR_JORY - S["beaten"].get("armour", 0))
        if "armours" in S["quests"] and not left:
            finish_quest("armours")
            S["gear"].append("star_hammer")
            say("That's plenty of scrap! Bram, I made you this. All by myself. Well, mostly. Look in your Gear.", "Jory", picture="face_miner")
            say("...That's a proper hammer, lad. That's a proper hammer.", "Bram", picture="face_bram")
        elif "armours" in S["quests"]:
            say(f"Those walking armours are the best iron in the valley. {left} more and I can make something.", "Jory", picture="face_miner")
        elif S["lit"] >= 3 and "armours" not in S["done"]:
            say("Is it true there's armour walking about in that tower? Beat six for me. I want the scrap.", "Jory", picture="face_miner")
            start_quest("armours")
        else:
            say("Bram's got me sweeping up. It's the best thing that's ever happened to me.", "Jory", picture="face_miner")
    elif not flag("found_jory"):
        set_flag("found_jory")
        say("Bram? BRAM! I knew you'd come! I've been eating my boots.", "Jory", picture="face_miner")
        say("You daft lad. What's down there?", "Bram", picture="face_bram")
        say("Something big, down the lift, and it's on fire inside. I ran. And the lift's locked.", "Jory", picture="face_miner")
        say("The foreman's key is in his strongbox, past the next rockfall. Here, you look done in. Have some tea.", "Jory", picture="face_miner")
        rest_party()
        reach_stage("ember_mine", 3 if count_item("mine_key") else 2)
    else:
        say("Have some more tea. It's mostly mud, but it's hot. Your journey is saved.", "Jory", picture="face_miner")
        rest_party()
        save_game()

self.use = talk
