# object: Sea
# The deep outside: now and then something swims past, behind the station (seen
# through the gaps between rooms, by the light that spills out). A jellyfish
# glows by itself.

# === create
self.t = 0
self.kinds = ["fish", "fish", "school", "jelly", "turtle", "ray", "octopus", "angler", "seahorse"]

# === step
self.t += 1
if self.t % 90 == 0 and len(instances("Swimmer")) < 14:
    kind = random.choice(self.kinds)
    left = random.random() < 0.5
    s = instance_create(-60 if left else COLS * TILE + 60, random.uniform(40, ROWS * TILE - 40), "Swimmer")
    s.sprite = kind
    s.speed_x = (1 if left else -1) * (0.25 if kind == "jelly" else random.uniform(0.4, 1.0))
    s.image_xscale = 1 if left else -1
    s.lit = kind in ("jelly", "angler")
