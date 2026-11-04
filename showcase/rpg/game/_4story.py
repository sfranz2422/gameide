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


def light_town_lantern(lantern):
    """Oona lights the big lantern in the square, and the night gets a little less dark."""
    take_item("ember_shard")
    finish_quest("thorn_road")
    S["lit"] += 1
    start_quest("next")
    scene_bars()
    scene_camera(lantern.x, lantern.y, 45)
    scene_say("Hold it up to the glass. There.", "Oona", picture="face_oona")
    scene_flash("orange", 25)
    scene_sound("light")
    scene_do(lantern.light_up)
    scene_wait(40)
    scene_caption("One lantern lit. Three to go.", 150)
    scene_do(save_game)


# What to run after a fight, by the name start_battle was given.
STORY_AFTER = {"thornback_beaten": thornback_beaten}


def set_darkness():
    """The valley's dark, and each lantern lit takes a little of it away."""
    lighting(max(0.0, 0.62 - 0.15 * S["lit"]), "#0a1030")
