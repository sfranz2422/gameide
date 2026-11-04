# object: Pip
# sprite: npc_pip
# parent: Person
# The healer, who joins you once Oona says so.

# === create
super().on_create()
if any(h["key"] == "pip" for h in S["party"]):
    self.destroy()

def talk():
    if "thorn_road" not in S["quests"]:
        say("Have you spoken to Oona? She's by the big lantern.", "Pip", picture="face_pip")
        return
    say("Me? On an adventure? I've packed already. I packed last year.", "Pip", picture="face_pip")
    say("Pip joined the party!")
    sound_play("quest")
    join_party("pip")
    self.destroy()

self.use = talk
