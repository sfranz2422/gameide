# object: Kart
# sprite: kart_0
# How every kart moves. Its children decide what's pressed, in their Begin
# Step events (PlayerKart from the keyboard, ComputerKart from the road); this
# Step event drives whichever it is.

# === create
self.who = 0              # an index into RACERS
self.a = 0.0              # the way it points
self.move_a = 0.0         # the way it's going; on a drift, not the way it points
self.v = 0.0
self.i = 0                # the nearest point of the road's centre line
self.progress = 0.0       # points of centre line driven: backwards takes it down
self.off, self.side = 0.0, 0.0   # how far from the centre line; signed, left is negative
self.on_grass = False
self.drift = 0            # -1 or 1 while drifting: the way it's turning
self.charge = 0           # steps spent drifting
self.boost = 0
self.lap = 0
self.done = None          # the step it finished on
self.place = 1
self.gas, self.brake, self.drifting = False, False, False
self.steer = 0.0          # -1 (left) to 1 (right)
self.player = self.object_name == "PlayerKart"
self.top_k, self.accel_k, self.turn_k = 1.0, 1.0, 1.0   # this racer's (RACERS)
self.item = None          # what it's holding
self.turbos = 0           # in a time trial: turbos instead of item boxes
self.use = False          # pressed "use it" this step
self.item_wait = 0        # how long a computer driver holds an item
self.spin = 0             # steps left spinning out
self.spin_a = 0           # how far round the picture has spun
self.shield = 0           # steps left shielded
# The picture is big, but on the track a kart is KART_WORLD wide: this scales its collision circle too.
self.image_xscale = self.image_yscale = KART_WORLD / KART_W
self.image_speed = 0

# === step
if RACE["count"] > 0:
    return
s = STATS
if self.shield > 0:
    self.shield -= 1
if self.spin > 0:
    # Spun out: no keys work, and it slows, until it's facing front again.
    self.spin -= 1
    self.spin_a = (self.spin_a + 24) % 360
    self.v *= 0.96
    self.gas, self.brake, self.drifting, self.use = False, False, False, False
    self.steer = 0.0
    self.drift = 0
else:
    self.spin_a = 0
if self.use:
    use_item(self)
top = s["grass_top"] if self.on_grass else s["top"] * self.top_k

if self.boost > 0:
    self.boost -= 1
    self.v = min(s["boost_top"], self.v + 0.15)
elif self.gas:
    self.v += s["accel"] * self.accel_k * (1.15 - self.v / (s["top"] * self.top_k)) * 2
elif self.brake:
    self.v -= s["brake"]
else:
    self.v -= s["coast"]
if self.v > top and self.boost <= 0:
    self.v -= s["grass_drag"] if self.on_grass else 0.05
    if not self.on_grass:
        self.v = max(self.v, top)
if self.brake and not self.gas and self.v <= 0:
    self.v = max(self.v, -1.0)        # backing out of a hedge
elif not self.brake:
    self.v = max(self.v, 0.0)

# Drifting: start with the button while turning, fast enough. It then keeps
# turning that way whatever the wheel says, the wheel only making it tighter
# or wider, and letting go pays a boost for how long it lasted.
if self.drift == 0 and self.drifting and abs(self.steer) > 0.1 and self.v >= s["drift_min"] and not self.on_grass:
    self.drift = 1 if self.steer > 0 else -1
    self.charge = 0
    kart_sound(self, "drift")
if self.drift:
    if not self.drifting or self.v < s["drift_min"] * 0.7:
        if not self.drifting and self.charge >= SPARK_2:
            self.boost = BOOST_2
            kart_sound(self, "boost")
        elif not self.drifting and self.charge >= SPARK_1:
            self.boost = BOOST_1
            kart_sound(self, "boost")
        self.drift = 0
        self.charge = 0
    else:
        self.charge += 1
        self.a -= self.drift * (s["drift_turn"] + self.drift * self.steer * s["drift_steer"])
        if self.charge in (SPARK_1, SPARK_2):
            kart_sound(self, "spark")
if not self.drift and abs(self.v) > 0.1:
    # Pressing right turns it clockwise, which is down the angles.
    self.a -= self.steer * s["turn"] * self.turn_k * min(1.0, abs(self.v) / 1.5) * (1 if self.v > 0 else -1)
self.a %= 360

# It goes the way it points, slowly on a drift: that's the slide.
self.move_a = (self.move_a + angle_diff(self.a, self.move_a) * (0.05 if self.drift else 0.32) * RACE["track"]["grip"]) % 360
r = math.radians(self.move_a)
hit = self.move_and_collide(math.cos(r) * self.v, -math.sin(r) * self.v, "Hedge")
if hit:
    if self.v > 1.5:
        kart_sound(self, "bump")
    self.v *= s["bump"]
    self.drift = 0
    self.charge = 0

find_on_road(self, RACE["line"])
self.on_grass = self.off > RACE["track"]["half"]
# Hedges overlap, so nothing should get through; if a kart ever does, it comes back.
if self.off > RACE["track"]["half"] + RACE["track"]["verge"] + LOST:
    self.x, self.y = RACE["line"][self.i]
    self.v = 0.0
# Shoved into a hedge by another kart (karts push each other apart, hedge or no
# hedge), a kart can't drive out: every way is blocked, and on a new track a
# computer driver sat there for the rest of the race. It's eased back to the road.
if self.place_meeting(self.x, self.y, "Hedge"):
    cx, cy = RACE["line"][self.i]
    d = math.hypot(cx - self.x, cy - self.y)
    if d > UNSTICK:
        self.x += (cx - self.x) / d * UNSTICK
        self.y += (cy - self.y) / d * UNSTICK

# A lap is every point of the road, in order: going back over the line takes
# the lap off again, so backing and forth over it pays nothing.
n = len(RACE["line"])
before = self.lap
self.lap = max(0, int(self.progress // n) + 1)
laps = RACE["track"]["laps"]
if self.player and self.lap > before:
    if self.lap > 1:
        RACE["lap_times"].append(RACE["steps"] - RACE["lap_began"])
        if self.lap <= laps:
            sound_play("lap", volume=0.7)
    RACE["lap_began"] = RACE["steps"]
if self.done is None and self.progress >= laps * n:
    self.done = RACE["steps"]
    kart_sound(self, "finish")

# === collision Kart
# Two karts can't share a place: each moves itself half way out, in its own
# collision event, and whichever is behind loses a little speed.
dx, dy = self.x - other.x, self.y - other.y
d = math.hypot(dx, dy)
if d > 0.001:
    gap = (KART_R * 2 - d) / 2
    if gap > 0:
        self.x += dx / d * gap
        self.y += dy / d * gap
if self.progress < other.progress:
    self.v *= 0.985

# === draw
at = floor_point(self.x, self.y)
if not at:
    return
sx, sy, scale = at
self.depth = FOCAL / scale        # further away is drawn first, from the next frame on
if sx < -80 or sx > VIEW_W + 80 or sy < HORIZON or scale > NEAR:
    return
k = scale * KART_WORLD / KART_W
draw_set_alpha(0.3)
draw_set_color("black")
w = 9.5 * scale
draw_ellipse(sx - w, sy - w * 0.16, sx + w, sy + w * 0.16)
draw_set_alpha(1)
# A little bounce on the grass.
hop = -scale * 0.6 if self.on_grass and self.v > 0.6 and RACE["steps"] % 6 < 3 else 0
cam = RACE["camera"]
draw_sprite_ext(self.sprite, kart_frame(self, cam["x"], cam["y"]), sx, sy + hop, k, k)
if self.shield > 0:
    draw_set_alpha(0.35 if self.shield > 60 or self.shield % 10 < 5 else 0.12)
    draw_set_color("#7fd8ff")
    draw_circle(sx, sy - 7 * scale, 13 * scale)
    draw_set_alpha(1)
# Sparks from the back wheels: a drift's colour says the boost it has earned.
if self.drift and self.charge >= SPARK_1:
    draw_set_color("#ff9a2e" if self.charge >= SPARK_2 else "#58c8ff")
    t = RACE["steps"]
    for q in range(4):
        px = sx + (-1 if q % 2 else 1) * (6 + (t * 7 + q * 5) % 7) * scale
        py = sy - (t * 5 + q * 3) % 8 * scale * 0.4
        draw_circle(px, py, 1 + scale * 0.25)
