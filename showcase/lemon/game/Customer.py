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
self.drink_x = STAND_X + random.uniform(90, 150)

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
        choice = decide(s, self.who, t, len(q), today(s)["rival"])
        if choice == "buy":
            if why_not(s):
                say(self, "thirsty")
            else:
                q.append(self)
                self.state = "queue"
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
            say(self, verdict(t["recipe"], self.who, t["pink"]))
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
