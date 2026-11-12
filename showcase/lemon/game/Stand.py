# object: Stand
# sprite: stand
# depth: 10
# Your stand, and you behind it. Pours a cup for whoever is first in the queue,
# makes a new pitcher when the last one's empty (that takes a while), and says so
# when something has run out, which stops the selling.

# === create
s = global_vars.s
self.image_speed = 0
self.image_index = 3 if has(s, "pink") and global_vars.t["pink"] else 2 if (has(s, "cooler") or has(s, "juicer")) else 1 if has(s, "sign") else 0
self.busy = 0
self.serving = None
self.pose = 0
self.out = None

# === step
s = global_vars.s
t = global_vars.t
sp = global_vars.speed
q = global_vars.queue
if self.busy > 0:
    self.busy -= sp
    if self.busy <= 0 and self.serving is not None:
        c = self.serving
        self.serving = None
        c.state = "drink"
        c.timer = DRINK_STEPS
        self.pose = 2
        sound_play("coin", volume=0.4)
elif q and q[0].arrived:
    reason = why_not(s)
    if reason:
        # Sold out: everyone waiting goes away thirsty.
        for c in q:
            say(c, "thirsty")
            c.state = "walk"
        q.clear()
    else:
        made = pour_cup(s, t)
        self.serving = q.pop(0)
        self.serving.state = "served"
        self.busy = serve_steps(s) + (PITCHER_STEPS if made else 0)
        self.pose = 1
else:
    self.pose = 5 if self.out else 4 if today(s)["temp"] >= 90 else 0
self.out = why_not(s)

# === draw
draw_sprite("owner", self.pose, self.x, self.y - OWNER_LIFT)
draw_self()
if self.out:
    text(self.x, self.y - 236, self.out, RED, 18, "center")
    text(self.x, self.y - 214, "Selling stopped", INK, 13, "center")
