# object: Checkpoint
# sprite: runestone
# depth: 60
# A standing stone. Touching one heals the hero, and after a fall in
# battle they wake up here.

# === create
cp = global_vars.checkpoint
self.lit = bool(cp) and cp[0] == global_vars.level and abs(cp[1] - self.x) < 1 and abs(cp[2] - self.y) < 1
if self.lit:
    self.glow = "#5fd3ff"

# === step
if self.lit and random.random() < 0.08:
    particles(self.x + random.uniform(-8, 8), self.y - 30, count=1, color="#8fe3ff", speed=0.3, size=2, life=50, direction=90, spread=20)

# === collision Player
if not self.lit:
    for c in instances("Checkpoint"):
        c.lit = False
        c.glow = None
    self.lit = True
    self.glow = "#5fd3ff"
    global_vars.checkpoint = (global_vars.level, self.x, self.y)
    global_vars.hp = global_vars.max_hp
    sound_play("checkpoint")
    effect("sparkle", self.x, self.y - 40, color="#8fe3ff", scale=1.4)
    show_message("The stone remembers you. (Health restored.)", 150)
    save_progress()
