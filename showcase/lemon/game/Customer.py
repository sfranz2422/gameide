# object: Customer
# depth: -10
# Someone walking past. Each has their own thirst, money and taste (new_customer);
# at DECIDE_X they decide whether to stop (decide), queue, buy, drink by the stand,
# and say what they thought (verdict) before walking on.

# === create
import random
s = global_vars.s
self.who = new_customer(s, today(s))
self.sprite = f"cust_{self.who['kind']}"
self.image_speed = 0
self.state = "walk"         # walk, queue, served, drink
self.decided = False
self.arrived = False
self.timer = 0
self.happy = 0
self.pace = WALK * random.uniform(0.85, 1.15)
self.anim = random.uniform(0, 20)
# Past the things on the ground beside the stand (cooler, fridge…), so they're seen.
self.drink_x = STAND_X + random.uniform(420, 470)
self.lemonade = False       # what they'll be served (decided as they reach the stand)
self.popcorn = False
self.has_popcorn = False    # holding a bag (drawn in their hand)

# === step
s = global_vars.s
t = global_vars.t
sp = global_vars.speed
q = global_vars.queue
moving = False
if self.state == "walk":
    self.x += self.pace * sp
    moving = True
    if not self.decided and self.x >= DECIDE_X:
        self.decided = True
        t["passers"] += 1
        # Popcorn first: its salt makes them thirstier, so more stop for lemonade too.
        pop = wants_popcorn(s, self.who, t) and not pop_why_not(s)
        if pop:
            salted(self.who)
        choice = decide(s, self.who, t, len(q), today(s)["rival"])
        lem = choice == "buy" and not why_not(s)
        if choice == "full":
            pop = False
        if lem or pop:
            self.lemonade, self.popcorn = lem, pop
            q.append(self)
            self.state = "queue"
        elif choice == "buy":
            say(self, "thirsty")
        elif choice == "pricey":
            say(self, "pricey")
    if self.x > VIEW_W + 60:
        self.destroy()
elif self.state == "queue":
    spot = queue_spot(q.index(self)) if self in q else self.x
    if self.x < spot:
        self.x = min(spot, self.x + self.pace * sp)
        moving = True
    self.arrived = self.x >= spot - 0.5
elif self.state == "drink":
    if self.x < self.drink_x:
        self.x = min(self.drink_x, self.x + self.pace * sp)
        moving = True
    else:
        self.timer -= sp
        if self.timer <= 0:
            if self.lemonade:
                say(self, verdict(t["recipe"], self.who, t["pink"], t.get("frozen", False)))
            else:
                self.happy = 50           # popcorn only: no verdict on the lemonade they didn't have
            self.state = "walk"
if self.happy > 0:
    self.happy -= sp
self.anim += sp * 0.12
if moving:
    self.image_index = int(self.anim) % 2
elif self.state == "drink":
    self.image_index = 3
else:
    self.image_index = 2
if self.happy > 0 and not moving:
    self.image_index = 4

# === draw
draw_self()
if self.has_popcorn:
    # Their bag of popcorn, in the hand in front (they all face right).
    icon("popcorn", self.x + 22, self.y - 52, 0.42)
