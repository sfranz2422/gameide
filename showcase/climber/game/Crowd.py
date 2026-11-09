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
          # Speed, and gravity in the air: the others' games keep drawing you moving between words.
          "vx": round(me.vx, 2), "vy": round(me.vy, 2), "ay": GRAVITY if me.on is None else 0, "s": global_vars.ticks})
here = set()
for p in net_players():
    here.add(p.number)
    g = self.ghosts.get(p.number)
    if g is None or not instance_exists(g):
        g = instance_create(p.get("x", 0), p.get("y", 0), "Ghost")
        g.number = p.number
        self.ghosts[p.number] = g
    # Where the engine says to draw them: smoothed between words (NetPlayer.draw_x).
    if p.draw_x is not None:
        g.x, g.y = p.draw_x, p.draw_y
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
