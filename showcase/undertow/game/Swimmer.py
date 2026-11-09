# object: Swimmer
# depth: 150
# One of the sea's creatures, crossing the room slowly behind the station.

# === create
self.speed_x = 0.5
self.lit = False
self.t = random.uniform(0, 100)

# === step
self.t += 1
self.x += self.speed_x
self.y += math.sin(self.t / 40) * 0.2
if self.lit:
    light(self.x, self.y, 50, "#6fe3ff", 0.5)
if self.x < -100 or self.x > COLS * TILE + 100:
    self.destroy()
