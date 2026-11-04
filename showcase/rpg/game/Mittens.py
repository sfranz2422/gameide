# object: Mittens
# sprite: npc_cat
# parent: Person
# Lost in the wood, and not very sorry about it.

# === create
super().on_create()
if flag("found_cat"):
    self.destroy()

def talk():
    if "cat" not in S["quests"]:
        say("Mrrow?", "A small brown cat", picture="face_cat")
        return
    set_flag("found_cat")
    sound_play("quest")
    say("It's Mittens! She lets you pick her up, as a great favour.", None, picture="face_cat")
    self.destroy()

self.use = talk
