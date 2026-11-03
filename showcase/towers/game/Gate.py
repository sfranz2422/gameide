# object: Gate
# sprite: gate
# Where the road comes in, and where enemies come from: it sends out a wave's
# groups, one after another.

# === create
self.queue = []            # [enemy, how many left, steps between them]
self.wait = 0
self.depth = -3

# === step
if self.wait > 0:
    self.wait -= 1
elif self.queue:
    group = self.queue[0]
    enemy = instance_create(self.x, self.y, group[0])
    # Later waves are tougher, and pay a little more.
    tough = 1 + global_vars.wave * LEVELS[global_vars.director.level]["tough"]
    enemy.hp = enemy.hp_max = enemy.hp_max * tough
    group[1] -= 1
    self.wait = group[2]
    if group[1] <= 0:
        self.queue.pop(0)
