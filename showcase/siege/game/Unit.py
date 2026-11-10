# object: Unit
# depth: 0
# A troop: it marches on the other side's towers, stopping to fight whatever it
# meets that it can fight. Troops on foot cross the creek only by a bridge; flyers go
# straight. Its kinds (SnowKid, Snowman, Owl, Penguin, Yeti) set their numbers
# from UNITS in the rules, and draw themselves.
#
# How fast a troop walks is `pace`, not `speed`: `speed` is the engine's own (with
# `direction`, it moves an instance by itself every step), and a troop called
# speed kept walking even while it stood fighting, right past the tower.

# === create
self.side = 0
self.uid = next_uid()       # how the other player's game knows it again (Link)
self.puppet = False         # True in the other player's game: a copy, moved by Link
self.target = None
self.cool = 0
self.age = 0
self.flash = 0
self.slowed = False
self.swing = 0                   # steps of the attacking picture still to show
self.face = None                 # which way it faces: 1 right, -1 left (None: the way its side marches)
self.chill = 0                   # steps still slowed by a Frost Fairy's shot
self.run = 0                     # pixels walked since its last blow (Sled Riders charge with it)
self.px = self.py = None         # where it was last drawn (draw_troop: walking or standing)
setup_unit(self, "SnowKid")

# === step
if self.puppet or stopped():
    return
self.age += 1
self.flash = max(0, self.flash - 1)
# Chilled by a Frost Fairy: getting ready for the next blow takes twice as long.
self.chill = max(0, self.chill - 1)
if not (self.chill and self.age % 2):
    self.cool = max(0, self.cool - 1)
t = self.target
# Look again every so often (something nearer may have come), or when it's gone.
if t is None or not instance_exists(t) or self.age % 20 == 0:
    self.target = t = pick_target(self)
# IcePatch slows troops on foot (the other side's ice, not your own).
self.slowed = not self.flies and any(g.side != self.side and point_distance(self.x, self.y, g.x, g.y) < ICE_R
                                    for g in instances("IcePatch"))
if t is None:
    return
reach = self.range + self.radius + t.radius
if point_distance(self.x, self.y, t.x, t.y) <= reach:
    # Turned to face what it's fighting (the teacher's ask: they hit things behind them).
    if abs(t.x - self.x) > 2:
        self.face = 1 if t.x > self.x else -1
    if self.cool == 0:
        if self.range > 40:
            shoot(self.x, self.y - 6, t, self.damage, self.side, "frost" if is_a(self, "Fairy") else "snowshot")
            sound_play("twang", volume=0.25)
        else:
            strike(self, t)
            sound_play("hit", volume=0.25)
        self.cool = self.rate
        self.swing = 14
else:
    pace = self.pace
    if self.slowed:
        pace *= ICE_SLOW
    if self.chill:
        pace *= CHILL
    tx, ty = (t.x, t.y) if self.flies else waypoint(self.x, self.y, t.x, t.y)
    d = point_distance(self.x, self.y, tx, ty)
    if d > 0:
        if abs(tx - self.x) > 0.5:
            self.face = 1 if tx > self.x else -1      # facing the way it walks
        step = min(pace, d)
        self.x += (tx - self.x) / d * step
        self.y += (ty - self.y) / d * step
        self.run += step
# Troops of one side don't stand in one another (flyers and those on foot don't mind each other).
for o in instances("Unit"):
    if o is not self and o.side == self.side and o.flies == self.flies:
        d = point_distance(self.x, self.y, o.x, o.y)
        gap = self.radius + o.radius
        if 0 < d < gap:
            push = (gap - d) * 0.25
            nx, ny = self.x + (self.x - o.x) / d * push, self.y + (self.y - o.y) / d * push
            # Never pushed off a bridge into the creek.
            if self.flies or not on_the_gap(nx, ny):
                self.x, self.y = nx, ny
self.y = clamp(self.y, TOP + 4, BOTTOM - 4)

# === draw
if self.hp < self.max_hp:
    bar(self.x, self.y - self.radius - 8, max(14, self.radius * 2), self.hp / self.max_hp, SIDE_COLOR[self.side])
