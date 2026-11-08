# object: Crowd
# The rest of the room. Each step it tells the room where you are, makes a Ghost
# for each other player (and lets it go when they leave or are away), and throws
# the snowballs they threw. Nothing happens here outside a room.

# === create
self.ghosts = {}       # their number -> their Ghost

# === step
if net_room() is None:
    return
me = global_vars.player
net_send({"x": round(me.x), "y": round(me.y), "pic": me.pic, "pose": me.image_index, "face": me.facing,
          "best": global_vars.room_best, "h": global_vars.height, "dz": me.dizzy,
          "vx": round(me.vx, 2), "vy": round(me.vy, 2), "s": global_vars.ticks})
here = set()
for p in net_players():
    here.add(p.number)
    g = self.ghosts.get(p.number)
    if g is None or not instance_exists(g):
        g = instance_create(p.get("x", 0), p.get("y", 0), "Ghost")
        g.number = p.number
        self.ghosts[p.number] = g
    # A new word from them (their step count, or where they are, changed): the Ghost
    # starts guessing afresh from there.
    word = (p.get("s"), p.get("x"), p.get("y"))
    if word != g.heard:
        g.heard = word
        g.base_x, g.base_y = p.get("x", g.x), p.get("y", g.y)
        g.vx, g.vy = p.get("vx", 0), p.get("vy", 0)
        g.air = p.get("pose", 0) in (3, 4)
        g.since = 0
    g.pic = p.get("pic", "red")
    g.sprite = "climber_" + g.pic
    g.image_index = p.get("pose", 0)
    g.image_xscale = p.get("face", 1)
    g.name, g.best, g.height = p.name, p.get("best", 0), p.get("h", 0)
    g.dizzy = max(g.dizzy, p.get("dz", 0))
for n in list(self.ghosts):
    if n not in here:
        g = self.ghosts.pop(n)
        if instance_exists(g):
            g.destroy()
# Their snowballs: flown here from where they threw them, caught up for how long
# ago that was, a step at a time: jumped there in one go, a ball skipped past
# whoever stood in its way, and a hit a quarter of a second late never landed.
for m in net_messages():
    ball = m.data.get("ball") if isinstance(m.data, dict) else None
    if ball:
        s = instance_create(ball[0], ball[1], "Snowball")
        s.vx, s.vy, s.thrower = ball[2], ball[3], m.sender
        for _ in range(min(40, int(m.age * 60))):
            if fly(s):
                break
