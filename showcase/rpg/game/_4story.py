# script: story
# The cutscenes. People's own words are in their own objects; these are the big
# moments, and they're ordinary scene_ steps.


def opening():
    """The first time the game starts."""
    set_flag("opening")
    screen_fade(1, 0)
    scene_caption("Last night, every lantern in the valley went out.", 180)
    scene_fade(0, 60)
    scene_bars()
    oona = instances("Oona")[0]
    hero = instances("Player")[0]
    scene_camera(oona.x, oona.y, 60)
    scene_say("Sixty years I've lit these lanterns. They've never gone out. Not once.", "Oona", picture="face_oona")
    scene_face(hero, oona)
    scene_camera(hero.x, hero.y, 40)
    scene_say("Oona? I came as soon as I saw. It's so dark.", "Wren", picture="face_wren")
    scene_say("Come and talk to me, child. By the big lantern in the square.", "Oona", picture="face_oona")
    scene_do(save_game)


def thornback_meets(foe):
    """Walking into Thornback's clearing, once."""
    set_flag("met_thornback")
    hero = instances("Player")[0]
    scene_bars()
    scene_shake(5, 40)
    scene_camera(foe.x, foe.y, 45)
    scene_say("GRRRAAAAH!", "Thornback", picture="face_thornback", above=foe)
    scene_say("Something's stuck in its side. It's glowing!", "Pip", picture="face_pip")
    scene_say("That's why it's angry. Hold still, big fellow!", "Wren", picture="face_wren")
    scene_camera(hero.x, hero.y, 30)
    scene_do(lambda: start_battle(["thornback"], hero.x, hero.y + 40, run=False, then="thornback_beaten"))


def thornback_beaten():
    set_flag("thornback_beaten")
    add_item("ember_shard")
    advance_quest("thorn_road")
    hero = instances("Player")[0]
    scene_bars()
    scene_say("It was only hurting. Look, it's running off, and the thorns are falling away.", "Pip", picture="face_pip")
    scene_flash("orange", 30)
    scene_sound("quest")
    scene_say("Wren found an Ember Shard!", None)
    scene_say("It's warm. Oona will know what to do with this.", "Wren", picture="face_wren")
    scene_face(hero, "left")
    scene_do(save_game)


def light_town_lantern(lantern, quest, next_quest):
    """Oona lights a lantern, and the night gets a little less dark."""
    take_item("ember_shard")
    finish_quest(quest)
    S["lit"] += 1
    start_quest(next_quest)
    scene_bars()
    scene_camera(lantern.x, lantern.y, 45)
    scene_say("Hold it up to the glass. There.", "Oona", picture="face_oona")
    scene_flash("orange", 25)
    scene_sound("light")
    scene_do(lantern.light_up)
    scene_wait(40)
    scene_caption(["", "One lantern lit. Three to go.", "Two lanterns lit. Two to go.", "Three lanterns lit. One to go."][S["lit"]], 150)
    scene_do(save_game)


def mine_entered():
    """The first steps into the Ashdeep."""
    set_flag("mine_entered")
    scene_bars()
    scene_say("Smell that? Hot rock. This hill should be cold.", "Bram", picture="face_bram")
    scene_say("Jory! JORY! ...Those rockfalls are new. Point me at them.", "Bram", picture="face_bram")
    scene_do(save_game)


def golem_meets(foe):
    """Walking up to the golem, once."""
    set_flag("met_golem")
    hero = instances("Player")[0]
    scene_bars()
    scene_shake(6, 50)
    scene_camera(foe.x, foe.y, 45)
    scene_say("...MINE. MINE. MINE.", "Ashdeep Golem", picture="face_golem", above=foe)
    scene_say("It's just rock from the mine walls! The ember's woken it up.", "Pip", picture="face_pip")
    scene_say("Then we'll knock it back down. When it starts to glow, cover yourselves!", "Bram", picture="face_bram")
    scene_camera(hero.x, hero.y, 30)
    scene_do(lambda: start_battle(["golem"], hero.x, hero.y + 40, run=False, then="golem_beaten"))


def golem_beaten():
    set_flag("golem_beaten")
    add_item("ember_shard")
    reach_stage("ember_mine", 4)
    scene_bars()
    scene_shake(4, 30)
    scene_say("It's falling apart. It's just a heap of stones again.", "Wren", picture="face_wren")
    scene_flash("orange", 30)
    scene_sound("quest")
    scene_say("Wren found an Ember Shard!", None)
    scene_say("I'll get Jory home. You take that up to Oona. And Wren? Thanks.", "Bram", picture="face_bram")
    scene_do(save_game)


def marsh_entered():
    """The first steps into the Mistfen."""
    set_flag("marsh_entered")
    scene_bars()
    scene_say("I hate a bog. My hammer rusts just looking at it.", "Bram", picture="face_bram")
    scene_say("There are lights out there. Little pale ones. Are they... watching us?", "Pip", picture="face_pip")
    scene_say("Keep to the planks. Let's find this witch.", "Wren", picture="face_wren")
    scene_do(save_game)


def fen_drains():
    """The third sluice: the water goes down, and the old causeway comes up."""
    set_flag("drained")
    reach_stage("ember_marsh", 2)
    hero = instances("Player")[0]
    scene_bars()
    scene_say("That's the last of them. Listen!", "Wren", picture="face_wren")
    scene_shake(5, 50)
    scene_camera(18 * 32, 16 * 32, 60)
    scene_sound("light")
    scene_do(lambda: [f.destroy() for f in instances("Flood")])
    scene_wait(30)
    scene_say("There's a road under there! Who builds a road in a swamp?", "Pip", picture="face_pip")
    scene_say("Someone who meant to come back.", "Bram", picture="face_bram")
    scene_camera(hero.x, hero.y, 40)
    scene_do(save_game)


def knight_meets(foe):
    """Walking up to the knight, once."""
    set_flag("met_knight")
    hero = instances("Player")[0]
    scene_bars()
    scene_camera(foe.x, foe.y, 45)
    scene_say("...THE WATCH... HOLDS. NONE... SHALL... PASS.", "Drowned Knight", picture="face_knight", above=foe)
    scene_say("There's a glow behind that breastplate. It's the ember!", "Pip", picture="face_pip")
    scene_say("Remember what Sedge said. When that shield comes up, it's fire or nothing.", "Wren", picture="face_wren")
    scene_camera(hero.x, hero.y, 30)
    scene_do(lambda: start_battle(["knight"], hero.x, hero.y + 40, run=False, then="knight_beaten"))


def knight_beaten():
    set_flag("knight_beaten")
    add_item("ember_shard")
    reach_stage("ember_marsh", 3)
    scene_bars()
    scene_say("Is it... morning? I kept it safe. Through the flood, and all the dark.", "Drowned Knight", picture="face_knight")
    scene_say("Tell Oona... I kept the light.", "Drowned Knight", picture="face_knight")
    scene_flash("orange", 30)
    scene_sound("quest")
    scene_say("Wren found an Ember Shard!", None)
    scene_say("Oona? OUR Oona? But that armour's been down here for years and years.", "Pip", picture="face_pip")
    scene_say("Sixty, I'd say. We'd better take this home.", "Bram", picture="face_bram")
    scene_do(save_game)


# What to run after a fight, by the name start_battle was given.
STORY_AFTER = {"thornback_beaten": thornback_beaten, "golem_beaten": golem_beaten, "knight_beaten": knight_beaten}


def set_darkness():
    """The valley's dark, and each lantern lit takes a little of it away."""
    # Underground, no lantern makes any difference, whatever's been lit up top.
    if S["room"] in ("Mine", "MineDeep"):
        lighting(0.7, "#1a0c08")
    elif S["room"] in ("Marsh", "Chapel"):
        # Out here it's the fog that's dark, and the town's lanterns don't reach.
        lighting(0.55, "#06201c")
    else:
        lighting(max(0.0, 0.62 - 0.15 * S["lit"]), "#0a1030")
