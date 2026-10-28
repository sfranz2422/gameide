# script: story
# What happens. Each line below is a verb and a thing, and what it does:
#
#     @on("look", "camera")            Look at the camera
#     @on("use", "batteries", "camera") Use the batteries with the camera
#
# A handler can be a sentence (Robin says it) or a function that queues up
# what happens (engine: say_line, walk, get, lose, set_flag, go, menu…).
# Anything with no line here gets a stock answer ("I can't pick that up.").

STORY = {}


def on(verb, thing, other=None):
    def register(fn):
        STORY[(verb, thing, other) if other else (verb, thing)] = fn
        return fn
    return register


def says(verb, thing, words, other=None):
    STORY[(verb, thing, other) if other else (verb, thing)] = words


# ---------------------------------------------------------------- the notepad: what to do next

def next_step():
    if STATE["room"] == "mothership":
        return "Proof first: a photo of the real Ms. Glorbin. Then ruin their recipe." if not has("photo") \
            else "I've got my photo. Now ruin their recipe. Something spicy..."
    for done, hint in (
        (flag("took_camera"), "Story idea: the weird stuff around school. A reporter needs a camera first."),
        (flag("gus_tested") or has("sample"), "Everyone's been sleepy since the new lunch lady came. I need a sample of her Sleepy Joes, in something."),
        (flag("gus_tested"), "Gus the janitor, down in the basement, says he can test anything."),
        (flag("camera_loaded"), "My camera's batteries are dead. Who'd have batteries lying around?"),
        (flag("glorbin_away") or flag("took_ice"), "I need to get into the kitchen. If only Ms. Glorbin were called away..."),
        (flag("took_ice"), "Something in the kitchen was glowing. Look everywhere."),
        (not has("ice"), "There's a card frozen in this ice. It needs somewhere hot."),
        (flag("dot_awake"), "Dot from the astronomy club is asleep in her lunch. Something spicy might wake her."),
        (flag("roof_open"), "Dot's key opens the chain on the stairs to the roof."),
        (flag("hat_on"), "Something up there makes people sleepy. Gus swears by his tinfoil hat."),
    ):
        if not done:
            return hint
    return "The antenna on the roof, and an alien keycard. What's the worst that could happen?"


@on("look", "notepad")
def _():
    say_line("robin", "My notes say: " + next_step())


@on("use", "notepad")
def _():
    say_line("robin", next_step())


# ---------------------------------------------------------------- things you carry

@on("look", "camera")
def _():
    say_line("robin", "The paper's instant camera. Loaded and ready." if flag("camera_loaded")
             else "The paper's instant camera. The batteries are dead, as usual.")


@on("use", "camera")
def _():
    say_line("robin", "I should save the film for something big. Something really big." if flag("camera_loaded")
             else "Nothing. The batteries are dead.")


@on("use", "batteries", "camera")
def _():
    lose("batteries")
    set_flag("camera_loaded")
    sound("click")
    say_line("robin", "Fresh batteries. The camera whirs to life!")


says("look", "batteries", "Two batteries, still warm from the principal's clock radio.")
says("look", "carton", "An empty milk carton. Useful for carrying things you'd rather not touch.")
says("look", "sample", "A carton full of Sleepy Joe. It's humming. Meat shouldn't hum.")
says("look", "hotsauce", "Gus's Ghost Pepper Hot Sauce. The label says WARNING three times.")
says("look", "ice", "A block of ice. There's a glowing green card frozen inside it!")
says("look", "keycard", "A glowing green card covered in squiggles. It's warm, and it smells like gravy.")
says("look", "roofkey", "The astronomy club's key, on a star-shaped keyring.")
says("look", "photo", "Ms. Glorbin, the REAL her. Three eyes and a hairnet. Front page material!")
says("look", "tinfoil", "A roll of tinfoil. Gus says it blocks mind rays.")
says("use", "hotsauce", "I'm not drinking that. I'm brave, not silly.")
says("use", "sample", "I am NOT eating that.")


@on("use", "tinfoil")
def _():
    lose("tinfoil")
    set_flag("hat_on")
    sound("click")
    say_line("robin", "I fold the foil into a hat and put it on. I feel protected. And a little silly.")


# ---------------------------------------------------------------- the newsroom

says("look", "shelf_camera", "The paper's instant camera, on the shelf where nobody ever puts it back.")


@on("pick", "shelf_camera")
def _():
    if has("camera"):
        say_line("robin", "I've already got it.")
        return
    get("camera")
    set_flag("took_camera")
    say_line("robin", "Every reporter needs a camera.")


says("look", "board", "My WEIRD STUFF board: a light over the school at night, a new lunch lady nobody hired, and now everybody yawning.")
says("look", "computer", "The school computer. It takes four minutes to open a picture of a cat.")
says("use", "computer", "I search for 'lunch lady from outer space'. The filter blocks it. Suspicious.")
says("look", "desk", "My desk. Somewhere under there is last month's homework.")
says("open", "desk", "Paper clips, a cold french fry, and an IOU from Dot for one (1) favour.")
says("push", "computer", "I give it a whack. It makes a noise like a sad cow. Normal.")

# ---------------------------------------------------------------- the hallway

says("look", "lockers", "Rows of lockers. Half the school is asleep against them.")
says("open", "lockers", "Mine smells like gym socks. Not going in there.")
says("look", "trophies", "Trophies for chess, spelling, and a brand-new one for 'Best Napper'.")
says("look", "fountain", "A water fountain. The water tastes like pennies.")
says("use", "fountain", "I take a sip. Still pennies.")
says("look", "stairs", "The stairs up to the roof. There's a chain across them with a little telescope sign.")


def roof_stairs():
    if flag("roof_open"):
        go("roof", 30, 124)
    else:
        say_line("robin", "There's a padlocked chain across the stairs. Astronomy club only.")


for _v in ("walk", "open", "use"):
    STORY[(_v, "stairs")] = roof_stairs


@on("use", "roofkey", "stairs")
def _():
    set_flag("roof_open")
    sound("click")
    say_line("robin", "The padlock clicks open. Up to the roof!")
    go("roof", 30, 124)


# ---------------------------------------------------------------- the cafeteria

says("look", "tables", "The tables are sticky. The kids at them are asleep.")
says("look", "food", "Today's special: Sleepy Joes. Yesterday's special: Sleepy Joes. The meat is humming a lullaby.")
says("look", "cartons", "A pile of milk cartons. Mostly empty.")


@on("pick", "food")
def _():
    if not flag("glorbin_away"):
        say_line("glorbin", "Hands off, sweetie! One per customer, and you've had yours.")
    else:
        say_line("robin", "With my bare hands? Eww. I need something to put it in.")


@on("use", "carton", "food")
def _():
    lose("carton")
    get("sample")
    say_line("robin", "I scoop some Sleepy Joe into the carton. It hums louder.")
    if not flag("glorbin_away"):
        say_line("glorbin", "Saving some for later? Good! Very good.")


@on("pick", "cartons")
def _():
    if has("carton") or has("sample"):
        say_line("robin", "One is plenty.")
        return
    get("carton")
    say_line("robin", "I grab an empty milk carton.")


says("look", "glorbin", "Ms. Glorbin, the new lunch lady. She never blinks. I've been counting.")


def glorbin_menu():
    return [
        ("What's in the Sleepy Joes?", lambda: (say_line("glorbin", "Love, sweetie. And a secret ingredient from very far away. I mean, from my grandma."), menu(glorbin_menu))),
        ("Why is everyone so sleepy?", lambda: (say_line("glorbin", "Growing children need their naps! Nice, long naps. Forever, if possible."), menu(glorbin_menu))),
        ("Where are you from?", lambda: (say_line("glorbin", "Oh, here and there. Mostly there. Way, WAY out there."), menu(glorbin_menu))),
        ("Bye.", lambda: say_line("glorbin", "Bye-bye, sweetie! Eat up!")),
    ]


@on("talk", "glorbin")
def _():
    say_line("glorbin", "Hello, sweetie! Hungry? Have a Sleepy Joe!")
    menu(glorbin_menu)


def kitchen_door():
    if flag("glorbin_away"):
        go("kitchen", 30, 124)
    else:
        say_line("glorbin", "Staff only, sweetie! The kitchen's no place for a nosy little reporter.")


for _v in ("walk", "open", "use"):
    STORY[(_v, "door_kitchen")] = kitchen_door


@on("look", "dot")
def _():
    say_line("robin", "Dot, wide awake. VERY wide awake." if flag("dot_awake")
             else "Dot, from the astronomy club. She's asleep face-down in her Sleepy Joe.")


def dot_menu():
    out = [("What happened to you?", lambda: (say_line("dot", "I ate ONE Sleepy Joe and woke up just now! Was I snoring? Don't answer that."), menu(dot_menu))),
           ("Seen anything weird lately?", lambda: (say_line("dot", "Every night the antenna on the roof glows and points at the Moon. And through the club telescope I saw a SAUCER behind it!"), menu(dot_menu)))]
    if not flag("got_roofkey"):
        out.append(("Can I borrow the roof key?", lambda: (say_line("dot", "For science? Of course! And for that IOU."), get("roofkey"), set_flag("got_roofkey"), menu(dot_menu))))
    out.append(("Bye.", lambda: say_line("dot", "Go get 'em, Robin!")))
    return out


@on("talk", "dot")
def _():
    if flag("dot_awake"):
        say_line("dot", "Robin! What's going on?")
        menu(dot_menu)
    else:
        say_line("dot", "Zzz... Saturn's rings are made of... of... cheese...")


def wake_dot():
    if flag("dot_awake"):
        say_line("robin", "She's awake enough. Trust me.")
        return
    say_line("robin", "I wave the hot sauce under her nose.")
    sound("sizzle")
    set_flag("dot_awake")
    say_line("dot", "HOT! HOT HOT HOT! ...Robin? Where am I? Why is it Tuesday?")
    menu(dot_menu)


STORY[("use", "hotsauce", "dot")] = wake_dot
STORY[("give", "hotsauce", "dot")] = wake_dot

# ---------------------------------------------------------------- the kitchen

says("look", "pot", "Bubbling. Glowing. Green. That's three things food should never do.")
says("use", "carton", "Not this stuff. I want what they actually serve.", "pot")
says("look", "crate", "A crate stamped with squiggly symbols. They look like letters. From somewhere far away.")
says("open", "crate", "It's full of grey powder. The label is a cartoon of someone yawning. This is the secret ingredient!")
says("use", "camera", "A box of powder? Nobody would believe that's from space. I need something bigger.", "crate")
says("look", "freezer", "A big steel walk-in freezer.")
says("look", "panel", "A glowing panel with a card-shaped slot. Next to it is a tiny picture of the school roof.")
says("use", "keycard", "Bzzt. The panel says something rude in alien. It's not this one. The picture shows the roof...", "panel")


@on("open", "freezer")
def _():
    if flag("took_ice"):
        say_line("robin", "Frozen peas, fish sticks, and nothing else glowing.")
        return
    sound("door")
    say_line("robin", "Frozen peas, fish sticks, and a block of ice with something glowing inside!")
    get("ice")
    set_flag("took_ice")


# ---------------------------------------------------------------- the principal's office

says("look", "catphoto", "A cat in a graduation cap. Principal Hoover's pride and joy.")
says("look", "radio", "A clock radio, stuck on 12:00 like every clock radio ever.")
says("look", "keys", "The principal's keys. Even I'm not brave enough to take those.")
says("pick", "keys", "The principal's keys? I'm brave. Not THAT brave.")
says("look", "hoover", "Principal Hoover. He's been asleep since Tuesday.")
says("push", "hoover", "He rolls over and mumbles something about detention.")
says("use", "hotsauce", "He's had three helpings. It'd take the whole bottle, and I'm going to need it.", "hoover")
says("look", "window", "The football field. The whole team is asleep on it.")
says("look", "intercom", "The school intercom. The whole school hears whatever you say into it.")


@on("open", "radio")
def _():
    if flag("took_batteries"):
        say_line("robin", "Empty. I already borrowed the batteries.")
        return
    say_line("robin", "I pop open the back. Two batteries! He won't miss them. He's asleep.")
    get("batteries")
    set_flag("took_batteries")


STORY[("pick", "radio")] = STORY[("open", "radio")]


@on("talk", "hoover")
def _():
    say_line("hoover", choose(["Zzz... more Sleepy Joes, Ms. Glorbin... yes... so sleepy...",
                               "Zzz... no running in the... zzz...",
                               "Zzz... detention... for everyone... zzz..."]))


def intercom_menu():
    return [
        ("Ms. Glorbin to the principal's office, please!", call_glorbin),
        ("Free pizza in the gym!", lambda: (wait(30), say_line("robin", "Nothing. Everyone's too sleepy for free pizza. That's how bad it is."), menu(intercom_menu))),
        ("School is cancelled forever!", lambda: (say_line("hoover", "Zzz... yes... forever... zzz..."), menu(intercom_menu))),
        ("Never mind.", lambda: None),
    ]


def call_glorbin():
    if flag("glorbin_away"):
        say_line("robin", "She's already wandering the halls looking for this office.")
        return
    set_flag("glorbin_away")
    wait(40)
    sound("door")
    say_line("robin", "Far off, a door bangs, and footsteps squelch away down the hall. She's left the cafeteria!")


@on("use", "intercom")
def _():
    say_line("robin", "Ahem. Testing, testing...")
    menu(intercom_menu)


STORY[("talk", "intercom")] = STORY[("use", "intercom")]

# ---------------------------------------------------------------- the basement

says("look", "boiler", "The school boiler. It's hot enough to melt anything.")
says("look", "bucket", "Gus's mop bucket. The water has a face in it. It's my face.")
says("push", "bucket", "It sloshes. Gus glares.")
says("look", "gus", "Gus the janitor. He's worn that tinfoil hat since the new lunch lady came.")
says("look", "hamradio", "An old ham radio, crackling away.")
says("look", "foilshelf", "Shelves and shelves of tinfoil. Gus is prepared.")


@on("use", "ice", "boiler")
def _():
    lose("ice")
    sound("sizzle")
    say_line("robin", "I hold the ice against the boiler. HISSSS! Out drops a glowing green card.")
    get("keycard")


@on("use", "hamradio")
def _():
    sound("radio")
    say_line("robin", "Static... then a squeaky voice:")
    say_line("glorbin", "...Commander Glorb-ina reporting... the Earthlings sleep... the sauce flows... the beam goes up through the roof antenna...")
    say_line("robin", "Then just static. Huh.")


@on("pick", "foilshelf")
def _():
    if flag("took_foil"):
        say_line("robin", "One roll is plenty.")
        return
    say_line("gus", "Help yourself, kid. Blocks the mind rays.")
    get("tinfoil")
    set_flag("took_foil")


def gus_tests():
    lose("sample")
    say_line("gus", "A sample! Good kid. Let's run it through the Analyzer.")
    sound("radio")
    wait(40)
    say_line("gus", "The needle's off the chart! This meat ain't from Earth. I KNEW it!")
    say_line("gus", "Here. My Ghost Pepper Hot Sauce. Nothing sleeps through this stuff.")
    get("hotsauce")
    set_flag("gus_tested")


def gus_menu():
    out = [("What's wrong with the food?", lambda: (say_line("gus", "Since that new lunch lady showed up, the whole school sleeps through sixth period. That ain't natural."), menu(gus_menu))),
           ("Nice hat.", lambda: (say_line("gus", "Blocks the mind rays. Grab some foil off the shelf. You'll thank me."), menu(gus_menu)))]
    if has("sample"):
        out.append(("Can you test this?", gus_tests))
    out.append(("Bye.", lambda: say_line("gus", "Stay sharp, kid.")))
    return out


@on("talk", "gus")
def _():
    say_line("gus", "Hey, kid. You eat the cafeteria food? Don't.")
    menu(gus_menu)


STORY[("give", "sample", "gus")] = gus_tests

# ---------------------------------------------------------------- the roof

says("look", "telescope", "The astronomy club's telescope.")
says("look", "antenna", "It's meant to look like a weather vane. Weather vanes don't hum and glow.")
says("look", "moon", "A big full moon. Something's peeking out from behind it.")


@on("use", "telescope")
def _():
    picture("telescope")
    say_line("robin", "That's no moon! Well, it IS a moon. But there's a spaceship behind it. Wearing a hairnet.")
    set_flag("saw_ship")


@on("use", "keycard", "antenna")
def _():
    say_line("robin", "There's a slot that fits the card perfectly...")
    sound("teleport")
    if not flag("hat_on"):
        picture("sleepy", 90)
        say_line("robin", "...A wave of sleepiness... Zzz... Huh? I'm still on the roof. Something up there puts people to sleep. I need protecting.")
        return
    picture("beam", 60)
    go("mothership", 60, 126, "right")
    say_line("glorbin", "WHO DARES... oh. It's the nosy little reporter. In a tin hat. Clever Earthling.")


# ---------------------------------------------------------------- the mothership

says("look", "commander", "Ms. Glorbin, the REAL her. Three eyes, little tentacles. Still wearing the hairnet.")
says("look", "machine", "The Sleepy Sauce machine. It's pumping sauce down to every school on Earth.")
says("look", "spacewindow", "Earth. From up here you can't even tell everyone's asleep.")
says("look", "controls", "Blinking buttons. One says 'DO NOT PRESS' in alien. I can tell.")
says("push", "controls", "I press a button. A tiny voice says 'Please don't do that.'")


def commander_menu():
    return [
        ("What's your plan?", lambda: (say_line("glorbin", "Simple! Sleepy Sauce in every school lunch. A sleepy planet never notices when you borrow its... everything."), menu(commander_menu))),
        ("Why the hairnet?", lambda: (say_line("glorbin", "Regulations, sweetie. Even in space."), menu(commander_menu))),
        ("You won't get away with this!", lambda: (say_line("glorbin", "Who will stop me? Everyone is ASLEEP! Mwa ha ha!"), menu(commander_menu))),
        ("Bye.", lambda: say_line("glorbin", "Bye-bye, sweetie! Nap time soon.")),
    ]


@on("talk", "commander")
def _():
    menu(commander_menu)


@on("use", "camera", "commander")
def _():
    if not flag("camera_loaded"):
        say_line("robin", "Click... nothing. The batteries are dead! Of all the times...")
        return
    if has("photo"):
        say_line("robin", "One photo is all the front page needs.")
        return
    sound("flash")
    get("photo")
    say_line("glorbin", "Hey! No photos! That's my bad side! All three of them!")


def finale():
    if not has("photo"):
        say_line("robin", "Wait. If I stop them now, nobody will believe me. I need proof first.")
        return
    say_line("robin", "Here's a little something extra for the recipe.")
    sound("sizzle")
    say_line("glorbin", "NO! Not the Ghost Pepper! It BURNS! It BURRRNS!")
    say_line("glorbin", "Abandon Earth! Their food is too SPICY!")
    sound("teleport")
    picture("beam", 60)
    ending()


STORY[("use", "hotsauce", "machine")] = finale
STORY[("give", "hotsauce", "commander")] = "She'd never touch it. But that machine might..."
