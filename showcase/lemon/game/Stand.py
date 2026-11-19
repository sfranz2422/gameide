# object: Stand
# sprite: stand
# depth: 10
# Your stand, and you behind it. Pours a cup for whoever is first in the queue,
# makes a new pitcher when the last one's empty (that takes a while), and says so
# when something has run out, which stops the selling.

# === create
s = global_vars.s
self.image_speed = 0
self.image_index = 1 if global_vars.t["pink"] else 0      # the bare stand, or the pink one
self.busy = 0
self.serving = None
self.pose = 0
self.out = None
self.popping = 0            # the popcorn machine's popping (it shakes)

# === step
s = global_vars.s
t = global_vars.t
sp = global_vars.speed
q = global_vars.queue
if self.popping > 0:
    self.popping -= sp
if self.busy > 0:
    self.busy -= sp
    if self.busy <= 0 and self.serving is not None:
        c = self.serving
        self.serving = None
        c.state = "drink"
        c.timer = DRINK_STEPS
        self.pose = 2
        sound_play("coin", volume=0.4)
elif q and q[0].arrived:
    c = q.pop(0)
    # What can still be had: a cup if the lemonade's not run out, a bag if the popcorn hasn't.
    c.lemonade = c.lemonade and not why_not(s)
    c.popcorn = c.popcorn and not pop_why_not(s)
    if not c.lemonade and not c.popcorn:
        say(c, "thirsty")              # sold out of what they came for
        c.state = "walk"
    else:
        self.busy = 0
        both = c.combo and c.lemonade and c.popcorn
        if both:
            # One price for the two (the cup and bag are counted, the money is the combo's).
            made_pitcher = s["pitcher"] == 0
            if sell_combo(s, t):
                self.popping = POP_STEPS
            self.busy += serve_steps(s) + (PITCHER_STEPS if made_pitcher else 0) + HAND_STEPS + (POP_STEPS if self.popping == POP_STEPS else 0)
            c.has_popcorn = True
        if c.lemonade and not both:
            self.busy += serve_steps(s) + (PITCHER_STEPS if pour_cup(s, t) else 0)
        if c.popcorn and not both:
            if sell_bag(s, t):
                self.popping = POP_STEPS      # a new batch popping: the machine shakes
            self.busy += HAND_STEPS + (POP_STEPS if self.popping == POP_STEPS else 0)
            c.has_popcorn = True
        self.serving = c
        c.state = "served"
        self.pose = 1
else:
    self.pose = 5 if self.out else 4 if today(s)["temp"] >= 90 else 0
self.out = why_not(s)

# === draw
s = global_vars.s
# Everything you've bought shows (the kids' ask): on the ground beside the stand, behind
# the counter, on it, and the sign on top. Where, STAND_SPOTS.
def put(name, frame=0, shake=0):
    dx, up = STAND_SPOTS[name]
    draw_sprite(name, frame, self.x + dx + shake, self.y - up)
for k in ("cooler", "fridge", "icemaker"):
    if has(s, k):
        put(k)
if has(s, "popcorn"):
    put("popcorn", 0, (1 if int(self.popping) % 4 < 2 else -1) if self.popping > 0 else 0)
draw_sprite("owner", self.pose, self.x, self.y - OWNER_LIFT)
if has(s, "helper"):
    dx, up = STAND_SPOTS["helper"]
    draw_sprite("helper", 1 if self.busy > 0 else 0, self.x + dx, self.y - up)
self.image_index = 1 if global_vars.t["pink"] else 0
draw_self()
if has(s, "sign"):
    put("sign")
put("pitcher", 1 if global_vars.t["pink"] else 0)
for k in ("register", "juicer", "blender"):
    if has(s, k):
        put(k)
if self.out:
    text(self.x, self.y - 236, self.out, RED, 18, "center")
    text(self.x, self.y - 214, "Selling stopped", INK, 13, "center")
