# object: Bram
# sprite: npc_bram
# parent: Person
# The blacksmith. He joins you to go and find his apprentice.

# === create
super().on_create()
if any(h["key"] == "bram" for h in S["party"]):
    self.destroy()

def talk():
    if "ember_mine" not in S["quests"]:
        say("Hot work and no light to do it by. Mind the anvil.", "Bram", picture="face_bram")
        return
    say("The second ember? Then it's the Ashdeep. The whole hill's been glowing at night.", "Bram", picture="face_bram")
    say("My lad Jory went up there three days ago, and he's not come back. I'm coming with you.", "Bram", picture="face_bram")
    say("And a rockfall won't stop us. Nothing stops this hammer.", "Bram", picture="face_bram")
    say("Bram joined the party!")
    sound_play("quest")
    join_party("bram")
    set_flag("bram_joined")
    advance_quest("ember_mine")
    self.destroy()

self.use = talk
