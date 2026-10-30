# object: Referee
# sprite: referee
# Stands on the far sideline at the line of scrimmage and signals what
# happened: frames 0 standing, 1 touchdown, 2 first down, 3 incomplete,
# 4 the whistle.

# === create
self.image_speed = 0

# === step
self.x = approach(self.x, MATCH.get("los", self.x), 3)
self.y = TOP - 2
self.depth = -int(self.y)
if REF["t"] > 0:
    REF["t"] -= 1
    self.image_index = {"touchdown": 1, "first down": 2, "incomplete": 3, "whistle": 4}.get(REF["pose"], 0)
else:
    self.image_index = 0
