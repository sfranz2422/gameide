# object: Day
# depth: 1000
# The day on the street: the clock, who walks by and when, the ice melting, the
# weather, and the end of the day. People walk past from the left; whether they
# stop is up to each Customer (decide, in the summer script).

# === create
import random
s = global_vars.s
self.day = today(s)
self.ground = place_now(s)["ground"]
global_vars.queue = []
global_vars.focus = None
if not hasattr(global_vars, "speed"):
    global_vars.speed = 1
self.clock = 0
self.over = False
# Everyone who'll walk past today, and when: spread over the day.
self.times = sorted(random.uniform(0, DAY_STEPS * SPAWN_UNTIL) for _ in range(crowd_size(s, self.day)))
self.k = 0
instance_create(STAND_X, self.ground, "Stand")
if self.day["sky"] == "rain":
    weather("rain", 2)
    lighting(0.3, "#23324a")
else:
    weather(None)
    lighting(0)
if self.day["sky"] != "sunny":
    for k in range(5):
        c = instance_create(random.uniform(0, VIEW_W), random.uniform(30, 150), "Cloud")
        c.dark = self.day["sky"] == "rain"
self.speeds = [make_button(VIEW_W - 196 + i * 62, 60, 56, 32, f"{n}x", "speed", n, 16) for i, n in enumerate(SPEEDS)]

# === step
question_ok(False)      # questions come in the morning or the evening, never while people queue
run_controls(None)
for n in SPEEDS:
    if keyboard_check_pressed(str(n)):
        global_vars.speed = n
for b in self.speeds:
    b.hot = b.arg == global_vars.speed
sp = global_vars.speed
s = global_vars.s
self.clock += sp
while self.k < len(self.times) and self.times[self.k] <= self.clock:
    instance_create(-60, self.ground, "Customer")
    self.k += 1
melt_ice(s, self.day["temp"], sp)
# The day ends once it's six and the last customer has gone on their way.
if not self.over and self.clock >= DAY_STEPS and (not instance_exists("Customer") or self.clock >= DAY_STEPS + 1500):
    self.over = True
    end_day(s, global_vars.t)
    keep(s)
    sound_play("bell", volume=0.6)
    room_goto("Evening")

# === draw
draw_sprite("place_" + place_now(global_vars.s)["key"], 0, 0, 0)
if self.day["rival"] is not None:
    # The rival's stand, further down the street, and its price.
    draw_sprite_ext("stand", 0, STAND_X + 300, self.ground - 8, 0.7, 0.7, 0, "#9aa0b0", 1)
    text(STAND_X + 300, self.ground - 180, f"Rival: {money(self.day['rival'])}", "#ffb36b", 14, "center")

# === draw_gui
s = global_vars.s
t = global_vars.t
panel(0, 0, VIEW_W, 48, 0.8)
text(14, 10, f"Day {s['day'] + 1}  ·  {PLACES[t['place']]['name']}  ·  {self.day['temp']}°F", INK, 20)
text(VIEW_W / 2 + 40, 10, clock_words(self.clock), GOLD, 22, "center")
text(VIEW_W - 14, 10, money(s["money"]), GOLD, 22, "right")
# The day so far, and the stock left.
panel(0, 48, 360, 100, 0.7)
text(12, 54, f"Sold {t['cups']} at {money(t['price'])}", INK, 16)
text(12, 76, f"{t['passers']} walked by", DIM, 13)
x = 196
for pic, n in (("lemon", lemon_count(s)), ("sugar", s["sugar"]), ("ice", int(s["ice"])), ("cups", s["cups"])):
    icon(pic, x, 74, 0.38)
    text(x + 14, 64, str(n), INK, 14)
    x += 42
text(VIEW_W - 210, 66, "Speed", DIM, 14, "right")
