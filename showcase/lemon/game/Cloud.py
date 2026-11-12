# object: Cloud
# sprite: cloud
# depth: 900
# A cloud drifting over: there on cloudy days, and grey on rainy ones.

# === create
import random
self.dark = False
self.image_speed = 0
self.drift = 0.15 + random.random() * 0.2

# === step
self.x += self.drift * (global_vars.speed if hasattr(global_vars, "speed") else 1)
if self.x > VIEW_W + 120:
    self.x = -120
self.image_blend = "#8a93a6" if self.dark else "white"
