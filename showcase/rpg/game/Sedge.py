# object: Sedge
# sprite: npc_witch
# parent: Person
# The witch of the Mistfen. Rude, right about everything, and her stew heals.

# === create
super().on_create()

def talk():
    stage = S["quests"].get("ember_marsh")
    if stage == 0:
        say("Took you long enough. I'm Sedge. Before you ask, no, I don't eat children. Too stringy.", "Sedge", picture="face_witch")
        say("Your ember fell on the Sunk Isle, by the old chapel. The causeway's under water.", "Sedge", picture="face_witch")
        say("Three old sluices in this fen. Turn all three and the water goes down. I'd do it myself, but my back.", "Sedge", picture="face_witch")
        reach_stage("ember_marsh", 1)
    elif stage == 1:
        say("Three sluices, dear: the west pond, and two out east. Big rusty wheels. You can't miss them.", "Sedge", picture="face_witch")
    elif stage == 2:
        say("There's a knight on that isle. Rust and water. Steel slides off that shield of his.", "Sedge", picture="face_witch")
        say("Fire doesn't. Same goes for the wisps. Let the little one earn their supper.", "Sedge", picture="face_witch")
    elif flag("knight_beaten"):
        say("So he's at rest. Sixty years late, the great lump. Go on, Oona's waiting.", "Sedge", picture="face_witch")
    if "lilies" in S["quests"] and count_item("lily") >= LILIES_FOR_SEDGE:
        take_item("lily", LILIES_FOR_SEDGE)
        finish_quest("lilies")
        add_item("ether", 3)
        S["gold"] += 100
        say("Five lilies, and only slightly squashed. Three ethers and 100 gold, and don't tell anyone I'm nice.", "Sedge", picture="face_witch")
    elif "lilies" in S["quests"]:
        say(f"That's {count_item('lily')} of {LILIES_FOR_SEDGE} lilies. They like the quiet corners.", "Sedge", picture="face_witch")
    elif "lilies" not in S["done"]:
        say("While you're out there, pick me five Marsh Lilies. It's for the stew. Don't ask what else is in it.", "Sedge", picture="face_witch")
        start_quest("lilies")
    say("Now eat. You look dreadful. Your journey is saved.", "Sedge", picture="face_witch")
    rest_party()
    save_game()

self.use = talk
