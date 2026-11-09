# object: Station
# depth: 5
# A panel where a job is done. `i` is its number in STATIONS, `kind` which job.
# One of yours that's still to do glows; a done one shows a green light.

# === create
self.i = 0
self.kind = "wires"
self.image_speed = 0
self.t = 0

# === step
self.t += 1
mine = self.i in global_vars.jobs
if mine and self.i not in global_vars.done:
    light(self.x, self.y, 46, "#ffd23f", 0.6 + 0.3 * math.sin(self.t / 12))
elif self.i in global_vars.done:
    light(self.x, self.y, 30, "#3ecf8e", 0.6)

# === draw
draw_self()
