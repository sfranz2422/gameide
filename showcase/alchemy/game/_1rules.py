# script: rules
# Every number in Mix Lab is here, and every thing you can make, and what makes it.
# Change one here and the game, the pictures the build draws and the tests all
# follow. The tests check that everything can be made from the four you start
# with, and that no two recipes use the same pair.

VIEW_W, VIEW_H = 1024, 576
FPS = 60

START = ["water", "fire", "earth", "air"]

# ---- every thing, in the collection's order (and the order of the Gemini sheets).
# group: for the collection's colours and the achievements.
THINGS = {
    # the elements
    "water": ("Water", "elements"), "fire": ("Fire", "elements"), "earth": ("Earth", "elements"),
    "air": ("Air", "elements"), "steam": ("Steam", "elements"), "mud": ("Mud", "elements"),
    "lava": ("Lava", "elements"), "energy": ("Energy", "elements"), "dust": ("Dust", "elements"),
    "wind": ("Wind", "elements"), "stone": ("Stone", "elements"), "sand": ("Sand", "elements"),
    "metal": ("Metal", "elements"), "glass": ("Glass", "elements"), "smoke": ("Smoke", "elements"),
    "cold": ("Cold", "elements"), "ice": ("Ice", "elements"), "gold": ("Gold", "elements"),
    "electricity": ("Electricity", "elements"), "life": ("Life", "elements"),
    # weather
    "rain": ("Rain", "weather"), "cloud": ("Cloud", "weather"), "storm": ("Storm", "weather"),
    "lightning": ("Lightning", "weather"), "snow": ("Snow", "weather"), "rainbow": ("Rainbow", "weather"),
    "fog": ("Fog", "weather"), "tornado": ("Tornado", "weather"),
    # places
    "puddle": ("Puddle", "places"), "pond": ("Pond", "places"), "lake": ("Lake", "places"),
    "sea": ("Sea", "places"), "ocean": ("Ocean", "places"), "land": ("Land", "places"),
    "mountain": ("Mountain", "places"), "volcano": ("Volcano", "places"), "island": ("Island", "places"),
    "beach": ("Beach", "places"), "desert": ("Desert", "places"), "swamp": ("Swamp", "places"),
    "cave": ("Cave", "places"), "geyser": ("Geyser", "places"), "earthquake": ("Earthquake", "places"),
    "wave": ("Wave", "places"), "river": ("River", "places"), "waterfall": ("Waterfall", "places"),
    # sky and space
    "sky": ("Sky", "space"), "sun": ("Sun", "space"), "moon": ("Moon", "space"), "day": ("Day", "space"),
    "night": ("Night", "space"), "star": ("Star", "space"), "space": ("Space", "space"),
    "planet": ("Planet", "space"), "galaxy": ("Galaxy", "space"), "meteor": ("Meteor", "space"),
    "comet": ("Comet", "space"),
    # plants
    "plant": ("Plant", "plants"), "seed": ("Seed", "plants"), "tree": ("Tree", "plants"),
    "forest": ("Forest", "plants"), "flower": ("Flower", "plants"), "grass": ("Grass", "plants"),
    "fruit": ("Fruit", "plants"), "cactus": ("Cactus", "plants"), "mushroom": ("Mushroom", "plants"),
    "moss": ("Moss", "plants"), "seaweed": ("Seaweed", "plants"), "garden": ("Garden", "plants"),
    "wood": ("Wood", "plants"),
    # animals
    "egg": ("Egg", "animals"), "fish": ("Fish", "animals"), "bird": ("Bird", "animals"),
    "lizard": ("Lizard", "animals"), "dinosaur": ("Dinosaur", "animals"), "dragon": ("Dragon", "animals"),
    "turtle": ("Turtle", "animals"), "frog": ("Frog", "animals"), "worm": ("Worm", "animals"),
    "butterfly": ("Butterfly", "animals"), "bee": ("Bee", "animals"), "whale": ("Whale", "animals"),
    "shark": ("Shark", "animals"), "penguin": ("Penguin", "animals"), "owl": ("Owl", "animals"),
    "nest": ("Nest", "animals"), "animal": ("Animal", "animals"), "cow": ("Cow", "animals"),
    "horse": ("Horse", "animals"), "lion": ("Lion", "animals"), "bear": ("Bear", "animals"),
    "bat": ("Bat", "animals"), "cat": ("Cat", "animals"), "dog": ("Dog", "animals"),
    "unicorn": ("Unicorn", "animals"), "snake": ("Snake", "animals"),
    # people
    "human": ("Human", "people"), "farmer": ("Farmer", "people"), "king": ("King", "people"),
    "pirate": ("Pirate", "people"), "knight": ("Knight", "people"), "astronaut": ("Astronaut", "people"),
    "snowman": ("Snowman", "people"), "alien": ("Alien", "people"), "scientist": ("Scientist", "people"),
    # food
    "wheat": ("Wheat", "food"), "flour": ("Flour", "food"), "bread": ("Bread", "food"),
    "milk": ("Milk", "food"), "cheese": ("Cheese", "food"), "sandwich": ("Sandwich", "food"),
    "cake": ("Cake", "food"), "juice": ("Juice", "food"), "lemonade": ("Lemonade", "food"),
    "honey": ("Honey", "food"),
    # building
    "brick": ("Brick", "building"), "wall": ("Wall", "building"), "house": ("House", "building"),
    "village": ("Village", "building"), "city": ("City", "building"), "castle": ("Castle", "building"),
    "farm": ("Farm", "building"), "treehouse": ("Treehouse", "building"), "boat": ("Boat", "building"),
    "ship": ("Ship", "building"), "treasure": ("Treasure", "building"),
    # inventions
    "tool": ("Tool", "inventions"), "sword": ("Sword", "inventions"), "wheel": ("Wheel", "inventions"),
    "engine": ("Engine", "inventions"), "car": ("Car", "inventions"), "train": ("Train", "inventions"),
    "airplane": ("Airplane", "inventions"), "rocket": ("Rocket", "inventions"),
    "lightbulb": ("Light Bulb", "inventions"), "paper": ("Paper", "inventions"), "book": ("Book", "inventions"),
    "computer": ("Computer", "inventions"), "robot": ("Robot", "inventions"), "internet": ("Internet", "inventions"),
    "videogame": ("Video Game", "inventions"), "music": ("Music", "inventions"),
    "fireworks": ("Fireworks", "inventions"), "party": ("Party", "inventions"),
}
GROUPS = [("elements", "Elements", "#5aa9e6"), ("weather", "Weather", "#9fb7c9"), ("places", "Places", "#c98a4b"),
          ("space", "Sky & Space", "#6b5bd6"), ("plants", "Plants", "#4caf50"), ("animals", "Animals", "#e0913a"),
          ("people", "People", "#e06a8a"), ("food", "Food", "#e8b830"), ("building", "Building", "#b0654a"),
          ("inventions", "Inventions", "#7a8a9a")]

# ---- what makes what: two things (either order) make the third.
RECIPES = [
    ("water", "fire", "steam"), ("water", "earth", "mud"), ("fire", "earth", "lava"), ("fire", "air", "energy"),
    ("earth", "air", "dust"), ("water", "air", "rain"), ("air", "air", "wind"), ("water", "water", "puddle"),
    ("puddle", "water", "pond"), ("pond", "pond", "lake"), ("lake", "water", "sea"), ("sea", "sea", "ocean"),
    ("lava", "water", "stone"), ("stone", "wind", "sand"), ("sand", "fire", "glass"), ("stone", "fire", "metal"),
    ("steam", "air", "cloud"), ("cloud", "wind", "storm"), ("storm", "energy", "lightning"),
    ("lava", "stone", "volcano"), ("stone", "stone", "mountain"), ("earth", "earth", "land"),
    ("land", "ocean", "island"), ("cloud", "air", "sky"), ("sky", "fire", "sun"), ("sky", "stone", "moon"),
    ("sun", "sky", "day"), ("moon", "sky", "night"), ("sun", "night", "star"), ("rain", "sun", "rainbow"),
    ("mountain", "air", "cold"), ("water", "cold", "ice"), ("rain", "cold", "snow"), ("mud", "pond", "swamp"),
    ("sand", "sand", "desert"), ("sand", "sea", "beach"), ("ocean", "wind", "wave"), ("steam", "earth", "geyser"),
    ("earth", "energy", "earthquake"), ("fire", "dust", "smoke"), ("cloud", "earth", "fog"),
    ("wind", "storm", "tornado"), ("water", "mountain", "river"), ("river", "mountain", "waterfall"),
    ("mountain", "earthquake", "cave"), ("sky", "star", "space"), ("star", "star", "galaxy"),
    ("stone", "space", "meteor"), ("earth", "space", "planet"), ("star", "ice", "comet"),
    ("metal", "sun", "gold"), ("lightning", "metal", "electricity"), ("lightning", "puddle", "life"),
    # plants
    ("life", "earth", "plant"), ("plant", "wind", "seed"), ("seed", "earth", "tree"), ("tree", "tree", "forest"),
    ("plant", "sun", "flower"), ("plant", "land", "grass"), ("tree", "flower", "fruit"),
    ("plant", "desert", "cactus"), ("plant", "night", "mushroom"), ("plant", "stone", "moss"),
    ("plant", "ocean", "seaweed"), ("flower", "grass", "garden"), ("tree", "tool", "wood"),
    # animals
    ("life", "stone", "egg"), ("life", "sea", "fish"), ("egg", "air", "bird"), ("egg", "desert", "lizard"),
    ("lizard", "volcano", "dinosaur"), ("lizard", "fire", "dragon"), ("egg", "beach", "turtle"),
    ("egg", "pond", "frog"), ("life", "mud", "worm"), ("worm", "rainbow", "butterfly"), ("worm", "flower", "bee"),
    ("fish", "ocean", "whale"), ("fish", "wave", "shark"), ("bird", "ice", "penguin"), ("bird", "night", "owl"),
    ("bird", "tree", "nest"), ("life", "land", "animal"), ("animal", "grass", "cow"), ("animal", "wind", "horse"),
    ("animal", "sun", "lion"), ("animal", "forest", "bear"), ("bird", "cave", "bat"), ("animal", "moon", "cat"),
    ("animal", "human", "dog"), ("horse", "rainbow", "unicorn"), ("lizard", "grass", "snake"),
    # people
    ("animal", "fire", "human"), ("human", "plant", "farmer"), ("human", "gold", "king"),
    ("human", "ship", "pirate"), ("human", "sword", "knight"), ("human", "rocket", "astronaut"),
    ("snow", "human", "snowman"), ("life", "space", "alien"), ("human", "book", "scientist"),
    # food
    ("farmer", "grass", "wheat"), ("wheat", "stone", "flour"), ("flour", "fire", "bread"), ("cow", "human", "milk"),
    ("milk", "cave", "cheese"), ("bread", "cheese", "sandwich"), ("flour", "egg", "cake"),
    ("fruit", "water", "juice"), ("juice", "ice", "lemonade"), ("bee", "flower", "honey"),
    # building
    ("mud", "fire", "brick"), ("brick", "brick", "wall"), ("wall", "wall", "house"), ("house", "house", "village"),
    ("village", "village", "city"), ("king", "house", "castle"), ("farmer", "land", "farm"),
    ("tree", "house", "treehouse"), ("wood", "lake", "boat"), ("boat", "ocean", "ship"),
    ("gold", "island", "treasure"),
    # inventions
    ("metal", "stone", "tool"), ("tool", "fire", "sword"), ("wood", "tool", "wheel"), ("metal", "steam", "engine"),
    ("wheel", "engine", "car"), ("car", "car", "train"), ("car", "bird", "airplane"), ("engine", "sky", "rocket"),
    ("electricity", "glass", "lightbulb"), ("wood", "water", "paper"), ("paper", "paper", "book"),
    ("book", "electricity", "computer"), ("computer", "metal", "robot"), ("computer", "computer", "internet"),
    ("computer", "human", "videogame"), ("human", "wind", "music"), ("rocket", "fire", "fireworks"),
    ("cake", "music", "party"),
]

# ---- the little world: things that show up living in it once made.
# kind: "sky" (stays up there), "fly" (crosses the sky), "ground" (stands on the land at x),
# "walk" (wanders the land), "sea" (sits in the water at x), "swim" (swims in the water).
# x is a share of the world's width (the sea is its right part, once there is one).
WORLD = {
    "sun": ("sky", 0.86), "moon": ("sky", 0.12), "cloud": ("fly", 0.3), "rainbow": ("sky", 0.5),
    "star": ("sky", 0.62), "comet": ("fly", 0.1), "meteor": ("fly", 0.7), "bird": ("fly", 0.2),
    "bat": ("fly", 0.6), "butterfly": ("fly", 0.4), "bee": ("fly", 0.45), "airplane": ("fly", 0.5),
    "rocket": ("fly", 0.8), "dragon": ("fly", 0.35), "owl": ("sky", 0.04),
    "mountain": ("ground", 0.08), "volcano": ("ground", 0.2), "tree": ("ground", 0.32), "forest": ("ground", 0.42),
    "flower": ("ground", 0.27), "cactus": ("ground", 0.58), "mushroom": ("ground", 0.37), "house": ("ground", 0.5),
    "castle": ("ground", 0.14), "farm": ("ground", 0.62), "treehouse": ("ground", 0.47), "garden": ("ground", 0.55),
    "village": ("ground", 0.66), "city": ("ground", 0.03), "geyser": ("ground", 0.24), "cave": ("ground", 0.11),
    "snowman": ("ground", 0.6),
    "cow": ("walk", 0.3), "horse": ("walk", 0.45), "lion": ("walk", 0.6), "bear": ("walk", 0.4),
    "dog": ("walk", 0.5), "cat": ("walk", 0.55), "dinosaur": ("walk", 0.2), "unicorn": ("walk", 0.35),
    "human": ("walk", 0.52), "farmer": ("walk", 0.62), "knight": ("walk", 0.15), "king": ("walk", 0.17),
    "robot": ("walk", 0.4), "alien": ("walk", 0.25), "snake": ("walk", 0.58), "frog": ("walk", 0.66),
    "car": ("walk", 0.3), "train": ("walk", 0.5), "penguin": ("walk", 0.64), "turtle": ("walk", 0.68),
    "fish": ("swim", 0.8), "whale": ("swim", 0.9), "shark": ("swim", 0.85), "seaweed": ("sea", 0.78),
    "boat": ("sea", 0.84), "ship": ("sea", 0.92), "island": ("sea", 0.88), "treasure": ("sea", 0.8),
}
SEA_FROM = 0.72             # the sea takes the world from here to the right, once there is a sea

# ---- the bench: where things are mixed
BENCH = (20, 236, 660, 556)         # x1, y1, x2, y2
ICON = 64                           # an icon's size on the bench and in the collection
CATCH = 40                          # how close (pixels, middle to middle) a drop must be to mix
BENCH_MOST = 24                     # the most things on the bench at once (the oldest go)

# ---- hints: one charges up while you play, and there's always a first one ready
HINT_STEPS = 45 * FPS
# ---- achievements: (key, name, what earns it). Each test reads what's been found
# (a set of keys), and the counts in the save (fails, hints, finds_since_hint).
ACHIEVEMENTS = [
    ("first", "First Spark", "Make your first new thing."),
    ("ten", "Getting Somewhere", "Find 10 things."),
    ("quarter", "Quarter of the Way", "Find a quarter of everything."),
    ("half", "Halfway There", "Find half of everything."),
    ("all", "World Builder", "Find every single thing."),
    ("life", "It's Alive!", "Make Life."),
    ("weather", "Weather Maker", "Find every kind of weather."),
    ("space", "Stargazer", "Find everything in Sky & Space."),
    ("zoo", "Zoo Keeper", "Find 10 animals."),
    ("greenthumb", "Green Thumb", "Find every plant."),
    ("builder", "Builder", "Build a House, a Village and a City."),
    ("royal", "Long Live the King", "Make a King and a Castle."),
    ("liftoff", "Liftoff", "Send an Astronaut into Space."),
    ("dragons", "Here Be Dragons", "Make a Dragon."),
    ("chef", "Chef", "Find every food."),
    ("inventor", "Inventor", "Find 10 inventions."),
    ("final", "The End of the Line", "Find something that makes nothing more."),
    ("tryer", "Mad Scientist", "Try 25 mixes that make nothing."),
    ("nohints", "No Help Needed", "Find 15 things in a row without a hint."),
    ("party", "Let's Party", "Throw a Party."),
]

# ---- 72 more (the teacher's ask, 2026-11-20): four more Gemini sheets, 10 to 13, in this
# order. Many are made from things that used to make nothing more (the dragon, the whale,
# the castle…), so more of the collection leads somewhere.
THINGS.update({
    # sheet 10: nature and space
    "hail": ("Hail", "weather"), "blizzard": ("Blizzard", "weather"), "hurricane": ("Hurricane", "weather"),
    "aurora": ("Northern Lights", "weather"), "iceberg": ("Iceberg", "places"), "glacier": ("Glacier", "places"),
    "crystal": ("Crystal", "elements"), "diamond": ("Diamond", "elements"), "oasis": ("Oasis", "places"),
    "canyon": ("Canyon", "places"), "jungle": ("Jungle", "places"), "reef": ("Coral Reef", "places"),
    "valley": ("Valley", "places"), "meadow": ("Meadow", "places"), "sunset": ("Sunset", "space"),
    "eclipse": ("Eclipse", "space"), "blackhole": ("Black Hole", "space"), "satellite": ("Satellite", "space"),
    # sheet 11: animals
    "octopus": ("Octopus", "animals"), "crab": ("Crab", "animals"), "jellyfish": ("Jellyfish", "animals"),
    "dolphin": ("Dolphin", "animals"), "mermaid": ("Mermaid", "people"), "parrot": ("Parrot", "animals"),
    "monkey": ("Monkey", "animals"), "elephant": ("Elephant", "animals"), "giraffe": ("Giraffe", "animals"),
    "zebra": ("Zebra", "animals"), "camel": ("Camel", "animals"), "polarbear": ("Polar Bear", "animals"),
    "fox": ("Fox", "animals"), "rabbit": ("Rabbit", "animals"), "mouse": ("Mouse", "animals"),
    "chicken": ("Chicken", "animals"), "pig": ("Pig", "animals"), "sheep": ("Sheep", "animals"),
    # sheet 12: people and make-believe
    "ghost": ("Ghost", "people"), "vampire": ("Vampire", "people"), "wizard": ("Wizard", "people"),
    "witch": ("Witch", "people"), "fairy": ("Fairy", "people"), "superhero": ("Superhero", "people"),
    "ninja": ("Ninja", "people"), "chef": ("Chef", "people"), "doctor": ("Doctor", "people"),
    "firefighter": ("Firefighter", "people"), "baby": ("Baby", "people"), "family": ("Family", "people"),
    "queen": ("Queen", "people"), "princess": ("Princess", "people"), "cowboy": ("Cowboy", "people"),
    "mummy": ("Mummy", "people"), "zombie": ("Zombie", "people"), "yeti": ("Yeti", "people"),
    # sheet 13: food and inventions
    "pizza": ("Pizza", "food"), "cookie": ("Cookie", "food"), "icecream": ("Ice Cream", "food"),
    "popcorn": ("Popcorn", "food"), "soup": ("Soup", "food"), "chocolate": ("Chocolate", "food"),
    "candy": ("Candy", "food"), "pie": ("Pie", "food"), "tea": ("Tea", "food"),
    "bicycle": ("Bicycle", "inventions"), "submarine": ("Submarine", "inventions"), "helicopter": ("Helicopter", "inventions"),
    "telescope": ("Telescope", "inventions"), "camera": ("Camera", "inventions"), "phone": ("Phone", "inventions"),
    "tv": ("TV", "inventions"), "clock": ("Clock", "inventions"), "guitar": ("Guitar", "inventions"),
})
# (Each listed after the recipes its ingredients come from, as hints need.)
RECIPES += [
    # nature and space
    ("storm", "ice", "hail"), ("snow", "wind", "blizzard"), ("storm", "ocean", "hurricane"),
    ("night", "electricity", "aurora"), ("ice", "ocean", "iceberg"), ("ice", "mountain", "glacier"),
    ("glass", "cave", "crystal"), ("crystal", "volcano", "diamond"), ("desert", "water", "oasis"),
    ("river", "desert", "canyon"), ("forest", "rain", "jungle"), ("seaweed", "stone", "reef"),
    ("mountain", "land", "valley"), ("grass", "grass", "meadow"), ("sun", "ocean", "sunset"),
    ("sun", "moon", "eclipse"), ("space", "galaxy", "blackhole"), ("metal", "space", "satellite"),
    # animals
    ("fish", "reef", "octopus"), ("fish", "sand", "crab"), ("life", "ocean", "jellyfish"),
    ("fish", "air", "dolphin"), ("fish", "human", "mermaid"), ("bird", "jungle", "parrot"),
    ("animal", "jungle", "monkey"), ("animal", "tree", "elephant"), ("horse", "tree", "giraffe"),
    ("horse", "night", "zebra"), ("horse", "desert", "camel"), ("bear", "ice", "polarbear"),
    ("dog", "forest", "fox"), ("animal", "garden", "rabbit"), ("animal", "cheese", "mouse"),
    ("bird", "farm", "chicken"), ("animal", "mud", "pig"), ("animal", "cloud", "sheep"),
    # people and make-believe
    ("human", "fog", "ghost"), ("human", "bat", "vampire"), ("human", "lightning", "wizard"),
    ("wizard", "cat", "witch"), ("human", "butterfly", "fairy"), ("human", "energy", "superhero"),
    ("human", "night", "ninja"), ("human", "cake", "chef"), ("scientist", "life", "doctor"),
    ("human", "smoke", "firefighter"), ("human", "human", "baby"), ("baby", "house", "family"),
    ("king", "flower", "queen"), ("queen", "castle", "princess"), ("human", "horse", "cowboy"),
    ("human", "desert", "mummy"), ("human", "swamp", "zombie"), ("bear", "mountain", "yeti"),
    # food and inventions
    ("flour", "cheese", "pizza"), ("flour", "milk", "cookie"), ("milk", "ice", "icecream"),
    ("seed", "fire", "popcorn"), ("plant", "steam", "soup"), ("seed", "milk", "chocolate"),
    ("fruit", "honey", "candy"), ("fruit", "flour", "pie"), ("plant", "water", "tea"),
    ("wheel", "wheel", "bicycle"), ("ship", "fish", "submarine"), ("airplane", "tornado", "helicopter"),
    ("glass", "star", "telescope"), ("glass", "computer", "camera"), ("music", "internet", "phone"),
    ("computer", "lightbulb", "tv"), ("day", "night", "clock"), ("music", "wood", "guitar"),
]
WORLD.update({
    "aurora": ("sky", 0.3), "eclipse": ("sky", 0.74), "satellite": ("fly", 0.55), "helicopter": ("fly", 0.25),
    "fairy": ("fly", 0.65), "parrot": ("fly", 0.15), "ghost": ("fly", 0.42),
    "jungle": ("ground", 0.06), "glacier": ("ground", 0.18), "oasis": ("ground", 0.52), "meadow": ("ground", 0.35),
    "monkey": ("walk", 0.12), "elephant": ("walk", 0.22), "giraffe": ("walk", 0.27), "zebra": ("walk", 0.33),
    "camel": ("walk", 0.5), "polarbear": ("walk", 0.16), "fox": ("walk", 0.4), "rabbit": ("walk", 0.57),
    "pig": ("walk", 0.6), "sheep": ("walk", 0.63), "chicken": ("walk", 0.66), "wizard": ("walk", 0.2),
    "witch": ("walk", 0.3), "princess": ("walk", 0.14), "cowboy": ("walk", 0.48), "zombie": ("walk", 0.37),
    "yeti": ("walk", 0.1), "bicycle": ("walk", 0.55),
    "octopus": ("swim", 0.86), "jellyfish": ("swim", 0.82), "dolphin": ("swim", 0.9), "mermaid": ("swim", 0.78),
    "submarine": ("swim", 0.88), "reef": ("sea", 0.76), "iceberg": ("sea", 0.94), "crab": ("sea", 0.74),
})
ACHIEVEMENTS += [
    ("sea", "Under the Sea", "Find the Octopus, Crab, Jellyfish, Dolphin and Mermaid."),
    ("spooky", "Spooky!", "Find the Ghost, Vampire, Witch, Mummy and Zombie."),
    ("barnyard", "Old MacDonald", "Find the Cow, Horse, Chicken, Pig and Sheep."),
    ("gadgets", "Gadget Lover", "Find the Phone, TV, Camera and Computer."),
]
