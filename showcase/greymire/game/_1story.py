# script: story
# The whole book: every page, in roughly the order it's read.
#
# A page is a picture, who is speaking (their portrait shows above the
# text), the words, and the choices under them. A choice can be hidden
# unless you have something (need=) or don't (lack=), and can change
# things as it's taken:
#
#     gold=-2        lose two gold          stamina=-1   lose stamina
#     item="horse"   gain an item           drop="horse" lose one
#     flag="paid"    remember something     to="map"     open the map
#     unlock="willow"  a new place on the map
#     to="duel:gallow" fight;   to="end:dawn" an ending
#
# Change a word, press Play, read it. Add a page: give it a new key and
# point a choice at it.

PAGES = {}


def page(key, pic, text, *choices, who=None, face=0):
    PAGES[key] = {"pic": pic, "text": text, "choices": list(choices), "who": who, "face": face}


def go(text, to, **changes):
    return dict(changes, text=text, to=to)


# ---------------------------------------------------------------- the start

page("intro", "title",
     "For three hundred years a mist has lain on Greymire. Every winter it creeps a little further, "
     "and the villages at its edge go quiet one by one.\n\n"
     "You carry the last lantern lit from the bell-fire of Saltmere, the city the marsh drowned. "
     "Ring the great bell at dawn, say the old songs, and the mist will lift.",
     go("Take up the lantern and go", "map", unlock="landing"))

# ---------------------------------------------------------------- the ferryman's landing

page("landing", "landing",
     "Old Marrow's hut stands on stilts where the boardwalk ends. A thread of smoke climbs from "
     "its chimney. His ferry, a flat black boat, is tied to the jetty below.",
     go("Knock at the door", "marrow"),
     go("Untie the ferry and take it yourself", "steal"))

page("marrow", "landing",
     "The door opens before you knock. \"A lantern-bearer,\" says the old man, \"and so young. "
     "I'm Marrow. I'll take you over the black water as far as the reeds. The fare is two gold.\"",
     go("Pay him two gold", "ferry_paid", gold=-2, need="gold:2"),
     go("Ask him about the marsh first", "marrow_lore", lack="heard_lore"),
     go("Tell him you can't spare it", "marrow_poor"),
     who="marrow")

page("marrow_lore", "landing",
     "\"Three things,\" he says, counting on bent fingers. \"The lights in the reeds lie, so trust "
     "the dark. The willow weeps for a child it lost. And Gallow at the toll-bridge likes a riddle "
     "better than gold, though he likes gold well enough.\"",
     go("Pay him two gold", "ferry_paid", gold=-2, need="gold:2", flag="heard_lore"),
     go("Tell him you can't spare it", "marrow_poor", flag="heard_lore"),
     who="marrow", face=1)

page("marrow_poor", "landing",
     "Marrow looks at your lantern for a long while. \"Keep your coins,\" he says at last. "
     "\"You'll need them more than I will.\" He takes up his pole.",
     go("Climb into the ferry", "ferry_free"),
     who="marrow", face=1)

page("steal", "landing",
     "The knot is stiff with cold. As it gives, a lamp flares above you. \"Taking a man's boat,\" "
     "says a voice, \"is a poor way to start a journey.\" Old Marrow stands in the doorway.",
     go("Say you're sorry, and pay him three gold", "ferry_paid", gold=-3, need="gold:3"),
     go("Say you're sorry, but you've nothing to give", "marrow_poor"),
     go("Push off anyway", "steal_go", stamina=-2),
     who="marrow", face=1)

page("steal_go", "reeds",
     "You shove off. The boat spins in a current you can't see and tips you into water as cold as "
     "iron. You drag yourself out among the reeds, soaked and shaking, while the boat drifts home "
     "to its master.",
     go("Wring out your cloak and go on", "map", unlock="reeds"))

page("ferry_paid", "ferry",
     "Marrow poles you out across water so still it holds the sky. Drowned trees lean over you. "
     "At the reeds he presses a little bone whistle into your hand. \"If you ever need the ferry "
     "again, blow that, and I'll come.\"",
     go("Step ashore", "map", unlock="reeds", item="whistle"),
     who="marrow")

page("ferry_free", "ferry",
     "Marrow poles you out across water so still it holds the sky. Drowned trees lean over you. "
     "He says nothing the whole way, and at the reeds he only nods. \"Mind the lights.\"",
     go("Step ashore", "map", unlock="reeds"),
     who="marrow", face=1)

page("landing_again", "landing",
     "Marrow's hut is dark, and the ferry is gone from the jetty.",
     go("Back to the map", "map"))

# ---------------------------------------------------------------- the reeds

page("reeds", "reeds",
     "The boardwalk runs into reeds taller than a house, and splits. Pale lights hang over two of "
     "the paths, bobbing as if they were beckoning: blue to the left, green to the right. The "
     "middle path is dark.",
     go("Hold up your lantern and look closely", "reeds_look", lack="looked"),
     go("Follow the blue light", "reeds_blue", stamina=-2),
     go("Follow the green light", "reeds_green", stamina=-1),
     go("Take the dark path", "reeds_dark"))

page("reeds_look", "reeds",
     "In the lantern's glow you look again. Neither light throws a reflection in the water. "
     "Whatever they are, they aren't really there.",
     go("Back to the paths", "reeds", flag="looked"))

page("reeds_blue", "reeds",
     "The blue light dances ahead, always a few steps further on. The planks give way to mud, the "
     "mud to water, and when the light winks out you are up to your knees and far from anywhere. "
     "It takes an hour to find the boardwalk again.",
     go("Back to the paths", "reeds"))

page("reeds_green", "reeds",
     "The green light leads you round in a slow circle. You only notice when you pass your own "
     "footprints for the third time.",
     go("Back to the paths", "reeds"))

page("reeds_dark", "reeds",
     "With only your lantern for company you walk into the dark between the reeds. Something pale "
     "catches the light: a little wooden horse, its paint long worn away, lying on the planks as if "
     "it were dropped yesterday.",
     go("Pick it up and go on", "reeds_end", item="horse"),
     go("Leave it where it lies", "reeds_end"))

page("reeds_end", "reeds",
     "The reeds thin out. Ahead, beyond a sheet of still water, a great willow trails its branches "
     "in a pool.",
     go("Go on", "map", unlock="willow"))

page("reeds_again", "reeds",
     "The reeds whisper together. The lights have gone.",
     go("Back to the map", "map"))

# ---------------------------------------------------------------- the willow

page("willow", "willow",
     "The willow is older than anything you have ever seen. Toys hang from its branches on faded "
     "ribbons, turning though there's no wind. Among its roots stands a small figure woven of "
     "willow leaves, watching you.",
     go("Speak to it", "pip"))

page("pip", "willow",
     "\"You've got a light,\" it says, in a child's voice. \"Nobody comes with a light any more. "
     "I'm Pip. I'm waiting for my mother. She went to ring the bell when the water came, and she "
     "never came back. And I lost my horse.\"",
     go("Give Pip the wooden horse", "pip_joins", need="horse", drop="horse", flag="pip"),
     go("Promise to look out for the horse", "pip_wait", lack="horse"),
     go("Ask Pip to come with you to Saltmere", "pip_no", lack="horse"),
     who="pip", face=1)

page("pip_joins", "willow",
     "Pip holds the horse in both leafy hands, very still. \"You found him.\" Behind the leaves, a "
     "pale face smiles for a moment. \"Saltmere is where Mother went. I'll come with you. I know "
     "the marsh, and I'm not afraid of the dark.\"",
     go("Go on together", "map", unlock="bridge", flag="met_pip"),
     who="pip")

page("pip_wait", "willow",
     "\"Everyone promises,\" says Pip, and turns back to the water.",
     go("Go on alone", "map", unlock="bridge", flag="met_pip"),
     who="pip", face=1)

page("pip_no", "willow",
     "\"Not without my horse,\" says Pip. \"He'd be all on his own.\"",
     go("Go on alone", "map", unlock="bridge", flag="met_pip"),
     who="pip", face=1)

page("willow_again", "willow",
     "The toys turn slowly on their ribbons.",
     go("Speak to the leaf-child", "pip", lack="pip"),
     go("Back to the map", "map"))

# ---------------------------------------------------------------- the toll-bridge

page("bridge", "bridge",
     "A causeway of planks crosses the deep water, lanterns swinging from crooked posts. Halfway "
     "over, a gate of wooden bars blocks the way, a heron on each of its posts. As you come near, "
     "a tall figure in a cloak of grey feathers steps out from behind them.",
     go("Wait for it to speak", "gallow"))

page("gallow", "bridge",
     "\"Gallow keeps this gate,\" says the heron mask, \"and Gallow's toll is three gold. Or a "
     "riddle, if you'd rather: answer it and pass free. Get it wrong,\" and the hooked staff swings "
     "down across the gate, \"and we dance.\"",
     go("Pay three gold", "gallow_paid", gold=-3, need="gold:3"),
     go("Ask for the riddle", "gallow_riddle"),
     go("Let Pip slip through the bars and lift the latch", "gallow_pip", need="pip"),
     go("Fight him", "duel:gallow"),
     who="gallow")

page("gallow_riddle", "bridge",
     "\"I have a mouth, but never eat. I have a bed, but never sleep. I run all day, but have no "
     "feet. What am I?\"",
     go("A river", "gallow_right"),
     go("A marsh", "gallow_wrong"),
     go("A road", "gallow_wrong"),
     who="gallow")

page("gallow_right", "bridge",
     "Gallow throws back his mask and laughs until the herons take off from the posts. \"A river! "
     "On you go, little lantern. And take this.\" He gives you a long grey feather. \"Show it to "
     "any heron. They'll know you're a friend of mine.\"",
     go("Go on", "map", unlock="chapel", item="feather"),
     who="gallow", face=1)

page("gallow_wrong", "bridge",
     "\"A pity,\" says Gallow, and the staff comes up. \"I did so want you to win.\"",
     go("Fight", "duel:gallow"),
     who="gallow")

page("gallow_paid", "bridge",
     "Gallow bites each coin in turn, then swings the gate wide with a bow. \"Always a pleasure.\"",
     go("Go on", "map", unlock="chapel"),
     who="gallow", face=1)

page("gallow_pip", "bridge",
     "While Gallow is busy being frightening, Pip slips between the bars and lifts the latch. The "
     "gate swings open. Gallow looks at it, then at Pip, then laughs. \"Well played, both of you.\"",
     go("Go on", "map", unlock="chapel"),
     who="gallow", face=1)

page("gallow_beaten", "bridge",
     "Gallow's staff spins away into the water. He holds up both hands, laughing even now. "
     "\"Enough! You dance better than you look.\" He pulls a grey feather from his cloak. \"Show "
     "it to any heron. They'll let you pass.\"",
     go("Go on", "map", unlock="chapel", item="feather"),
     who="gallow", face=1)

page("gallow_won", "bridge",
     "You land on your back on the planks. Gallow takes your purse, weighs it, and tosses it back "
     "lighter. \"Bruises heal,\" he says, opening the gate. \"Fight better next time.\"",
     go("Pick yourself up and go on", "map", unlock="chapel"),
     who="gallow", face=1)

page("bridge_again", "bridge",
     "The gate stands open. On its post, a heron opens one eye at you and closes it again.",
     go("Back to the map", "map"))

# ---------------------------------------------------------------- the sunken chapel

page("chapel", "chapel",
     "The chapel has sunk to its windows in the mire and leans like a tired old man. Its belfry is "
     "empty. A heron watches you from the roof, and does not fly away.",
     go("Hold up Gallow's feather", "chapel_heron", need="feather"),
     go("Wade in through the door", "nave_cold", stamina=-1))

page("chapel_heron", "chapel",
     "The heron tilts its head at the feather. Then it drops from the roof and stalks ahead of you "
     "through the water, showing you where the floor is firm.",
     go("Follow it inside", "nave"))

page("nave_cold", "nave",
     "The water inside is deeper than it looks, and colder. Candles burn on the floating pews, "
     "dozens of them, though there is no one to light them. You reach the crypt stairs numb to "
     "the waist.",
     go("Go down to the crypt", "door"))

page("nave", "nave",
     "Black water covers the floor. Candles burn on the floating pews, dozens of them, though "
     "there is no one to light them. The heron picks its way between them to the crypt stairs, "
     "and you follow, hardly wet at all.",
     go("Go down to the crypt", "door"))

page("door", "door",
     "A stone door blocks the crypt. Three faces are carved in it: a sun, a crescent moon and a "
     "fish. Beneath them is cut:\n\nFIRST, ONE WHO SLEEPS BY DAY.\nTHEN, ONE WHO NEVER CLOSES "
     "ITS EYES.\nLAST, ONE WHO WAKES THE WORLD.",
     go("Press the faces", "door_1"),
     go("Ask Pip", "door_pip", need="pip"))

page("door_pip", "door",
     "\"Fish don't have eyelids,\" says Pip. \"Did you know? They never close their eyes, not even "
     "when they're asleep.\"",
     go("Press the faces", "door_1"),
     who="pip")

page("door_1", "door", "Which face do you press first?",
     go("The sun", "door_wrong", stamina=-1), go("The moon", "door_2"), go("The fish", "door_wrong", stamina=-1))
page("door_2", "door", "The moon sinks into the stone with a click. Which next?",
     go("The sun", "door_wrong", stamina=-1), go("The fish", "door_3"))
page("door_3", "door", "The fish sinks into the stone. One face is left.",
     go("The sun", "door_open"))

page("door_wrong", "door",
     "The face grinds back out of the stone, and the others with it. Cold water wells up round your "
     "knees and slowly drains away.",
     go("Try again", "door"))

page("door_open", "door",
     "The sun sinks into the stone and the door grinds open. Inside, on a shelf, lies a great iron "
     "bell-clapper as long as your arm, wrapped in oilcloth as if someone meant to come back for it.",
     go("Take the clapper", "door_after", item="clapper"))

page("door_after", "chapel",
     "From the chapel's broken windows you can see across the lagoon to Saltmere, its bell tower "
     "black against the clouds. The bell has no voice without its clapper. Now it has one again.",
     go("Go on", "map", unlock="saltmere"))

page("chapel_again", "chapel",
     "The heron on the roof watches you come and go.",
     go("Back to the map", "map"))

# ---------------------------------------------------------------- Saltmere

page("crossing", "chapel",
     "Saltmere lies across the lagoon. An old causeway runs towards it, most of it under water.",
     go("Blow Marrow's bone whistle", "crossing_marrow", need="whistle"),
     go("Wade along the causeway", "crossing_wade", stamina=-3))

page("crossing_marrow", "saltmere",
     "Before the echo has died, a lantern-lit boat comes out of the mist with Marrow at the pole. "
     "\"I said I'd come,\" he says, and poles you in among the drowned towers, the gulls crying "
     "over the roofs.",
     go("Step ashore in Saltmere", "street"),
     who="marrow")

page("crossing_wade", "saltmere",
     "The causeway is slick with weed and the water is up to your chest in places. By the time "
     "the drowned towers rise round you, you can hardly feel your feet.",
     go("Climb up into the streets", "street"))

page("street", "street",
     "Saltmere's streets are canals now. Lanterns burn over doors that open onto water. Under the "
     "arch ahead, something moves: a shape in rusted armour, water running from its helm. The "
     "drowned watch still keeps the city.",
     go("Follow Pip down a side alley", "street_pip", need="pip"),
     go("Shade your lantern and creep past", "street_creep", stamina=-1),
     go("Stand and fight", "duel:watch"))

page("street_pip", "street",
     "\"This way,\" Pip whispers. \"I used to play here.\" Pip leads you along the planks, under "
     "washing lines hung with weed, and up a stair you would never have found, to the foot of the "
     "bell tower.",
     go("Climb the tower", "tower"))

page("street_creep", "street",
     "You shade the lantern under your cloak and edge along the wall in the dark, barking your "
     "shins on every step. The watchman's helm turns, slowly, but the arch stays empty behind you.",
     go("Climb the tower", "tower"))

page("street_won", "street",
     "The watchman's armour clatters into the canal, empty. There was only ever water inside it.",
     go("Climb the tower", "tower"))

page("street_lost", "street",
     "A blow sends you into the canal. By the time you've climbed out the watchman has gone back "
     "under its arch, as if you aren't worth the trouble.",
     go("Climb the tower", "tower"))

page("tower", "tower",
     "At the top of the tower the great bell hangs silent. Beside it stands a woman in a grey "
     "gown, water-weed in her hair. \"No one rings my bell,\" she says. \"It rang the night the sea "
     "came in. It rang, and I could not find my child.\"",
     go("Pip steps out from behind you", "reunion", need="pip"),
     go("Tell her about the child waiting at the willow", "keeper_willow", need="met_pip", lack="pip"),
     go("Ask her leave to ring the bell", "keeper_ask", lack="pip"),
     go("Ring it anyway", "keeper_wrath", lack="pip"),
     who="keeper")

page("reunion", "tower",
     "\"Mother?\" says Pip.\n\nThe woman turns. For a long moment she doesn't move at all. Then "
     "she kneels on the wet stone, and the leaves and the ghost and the child are all in her arms "
     "at once. \"Pip. Oh, Pip. I looked for you for so long.\"",
     go("Ring the bell", "end:together"),
     who="keeper")

page("keeper_willow", "tower",
     "\"A child?\" she whispers. \"At the willow?\" Her face changes, the way the marsh changes "
     "when the sun comes out. \"Ring it, then. Ring it, and I'll go to them.\" Before you can turn, "
     "she's gone like mist.",
     go("Ring the bell", "end:willow"),
     who="keeper")

page("keeper_ask", "tower",
     "\"And who would you ring it for?\" she asks. \"There's no one left to hear.\"",
     go("For the villages at the edge of the marsh", "keeper_wrath"),
     who="keeper")

page("keeper_wrath", "tower",
     "\"Let them go quiet!\" Her eyes blaze and her hair lifts as if a gale were blowing. \"The sea "
     "took everything I had. Why should they keep anything?\"",
     go("Stand your ground", "duel:keeper"),
     who="keeper", face=1)

page("keeper_fades", "tower",
     "Lady Ashveil's anger breaks like a wave and drains away, and she is only a tired woman in a "
     "grey gown. \"Ring it, then,\" she whispers, and is gone.",
     go("Ring the bell", "end:alone"),
     who="keeper")

# ---------------------------------------------------------------- endings

ENDINGS = {
    "together": ("dawn",
                 "You swing the clapper with all your strength and the great bell speaks, so loud the "
                 "tower shakes. Again, and again. The mist shivers, thins, and rolls away, and the sun "
                 "comes up over a marsh that is only a marsh.\n\nOn the boardwalk Pip stands with you "
                 "and watches the light. \"She's waiting for me,\" Pip says, and the leaves fall, and "
                 "there is only a wooden horse on the planks."),
    "willow": ("dawn",
               "You swing the clapper and the great bell speaks. The mist shivers, thins and rolls "
               "away, and the sun comes up over the marsh.\n\nFar away at the willow, two figures "
               "stand together under the branches. Then the light is too bright to see them."),
    "alone": ("dawn",
              "You swing the clapper and the great bell speaks. The mist shivers, thins and rolls "
              "away, and the sun comes up over the marsh.\n\nThe villages will wake today. But at "
              "the willow, a child is still waiting. You did what you came to do. You wonder if it "
              "was everything you could have done."),
    "dark": ("dark",
             "Your knees give way on the wet planks. The lantern slips from your hand and gutters "
             "on the boards, and the mist comes rolling in, thick and grey and patient."),
}

# Where the map's places are, the page each opens the first time and after,
# and the way the lantern walks between them (along the map's dotted paths).
PLACES = {
    "landing":  {"name": "Marrow's Landing", "at": (150, 545), "first": "landing", "again": "landing_again"},
    "reeds":    {"name": "The Reeds",        "at": (450, 425), "first": "reeds",   "again": "reeds_again"},
    "willow":   {"name": "The Willow",       "at": (790, 470), "first": "willow",  "again": "willow_again"},
    "bridge":   {"name": "The Toll-Bridge",  "at": (975, 445), "first": "bridge",  "again": "bridge_again"},
    "chapel":   {"name": "The Sunken Chapel", "at": (1130, 505), "first": "chapel", "again": "chapel_again"},
    "saltmere": {"name": "Saltmere",         "at": (1060, 200), "first": "crossing", "again": "crossing"},
}
ROUTE = ["landing", "reeds", "willow", "bridge", "chapel", "saltmere"]
PATHS = {   # the bends between one place and the next
    ("landing", "reeds"): [(230, 500), (330, 470)],
    ("reeds", "willow"): [(560, 470), (650, 500)],
    ("willow", "bridge"): [(900, 430)],
    ("bridge", "chapel"): [(1040, 480)],
    ("chapel", "saltmere"): [(1080, 400), (1100, 320)],
}
