# object: Exit
# sprite: exit_door
# depth: 60
# The way on: a door, which appears once the level's boss is beaten.

# === create
self.used = False
self.visible = boss_beaten() or not instances("BossTrigger")

# === step
if not self.visible and boss_beaten():
    self.visible = True
    effect("sparkle", self.x, self.y - 24, color="#ffd166", scale=2)
if self.visible and random.random() < 0.1:
    particles(self.x + random.uniform(-10, 10), self.y - random.uniform(0, 40), count=1, color="#ffd166", speed=0.3, size=2, life=40, direction=90, spread=30)

# === collision Player
if self.visible and not self.used:
    self.used = True
    p = player()
    p.state = "dead"          # no more moving: the level is done
    p.visible = False
    sound_play("power")
    screen_fade(1, 40)
    self.alarm[0] = 50

# === alarm 0
next_level()
