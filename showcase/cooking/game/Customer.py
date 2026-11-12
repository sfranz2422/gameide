# object: Customer
# parent: Spot
# depth: 50
# Someone at the counter, seen from the waist up behind it. They slide in to their
# seat, show what they want in a bubble, and wait, their hearts running down.
# Tap them to hand over whatever of their order is ready (serve, in the kitchen
# script). Served: they eat, happy, and go. Out of patience: they go, cross.

# === create
super().on_create()
self.seat = 0
self.kind = 0
self.order = {"parts": [], "extras": []}
self.full = 1
self.wait = 1
self.phase = "in"
self.timer = WALK_STEPS
self.got_dish = False
self.got = []
self.paid = 0
self.wide = 150
self.high = 264       # from the counter up past their order bubble: a tap on the bubble is a tap on them
self.shown = False

# === step
# Its box for taps: the person and their bubble, from the seat.
self.x = SEAT_X[self.seat] - self.wide / 2
self.y = COUNTER_Y - self.high
k = global_vars.k
if self.phase == "in":
    self.timer -= 1
    if self.timer <= 0:
        self.phase = "wait"
elif self.phase == "wait":
    self.wait -= 1
    if self.wait <= 0:
        lose(k, self)
        sound_play("angry", volume=0.5)
elif self.phase in ("eat", "angry"):
    self.timer -= 1
    if self.timer <= 0:
        self.phase = "out"
        self.timer = WALK_STEPS
elif self.phase == "out":
    self.timer -= 1
    if self.timer <= 0:
        self.destroy()
self.shown = self.phase == "wait"
super().on_step()

# === draw
k = self.kday
dish = RESTAURANTS[k["rest"]]["dish"]
share = max(0, self.wait) / self.full
if self.phase == "in":
    slide, alpha = 160 * self.timer / WALK_STEPS, 1 - self.timer / WALK_STEPS
elif self.phase == "out":
    slide, alpha = -160 * (1 - self.timer / WALK_STEPS), self.timer / WALK_STEPS
else:
    slide, alpha = 0, 1
frame = {"eat": 4, "angry": 3}.get(self.phase, 2 if self.phase == "wait" and share < IMPATIENT else 0)
if self.phase == "eat" and self.timer < EAT_STEPS / 2:
    frame = 1
cx = SEAT_X[self.seat] + slide
draw_sprite_ext(f"cust_{CUSTOMERS[self.kind][0]}", frame, cx, COUNTER_Y, 1, 1, 0, "white", alpha)
if self.phase == "wait":
    # The order, in a bubble over their head: the dish and each extra, a tick on what they've had.
    bx, by = cx, COUNTER_Y - 214
    pic("bubble", bx, by, 1)
    items = ["dish"] + self.order["extras"]
    for j, it in enumerate(items):
        x = bx + (j - (len(items) - 1) / 2) * 50
        had = (it == "dish" and self.got_dish) or (it != "dish" and self.got.count(it) > 0)
        if it == "dish":
            draw_dish(self.order["parts"], dish, x, by + 22, 0.55)
        else:
            pic(item_pic(it), x, by + 2, 0.55)
        if had:
            text(x, by - 20, "✓", MINT, 22, "center")
    # Patience: four hearts, running down, on a dark pill so they read over a tall hat.
    hearts = share * 4
    draw_set_alpha(0.55)
    draw_set_color("#1a0f08")
    draw_rect(cx - 60, COUNTER_Y - 164, cx + 60, COUNTER_Y - 136)
    draw_set_alpha(1)
    for h in range(4):
        hx = cx - 42 + h * 28
        if hearts >= h + 1:
            pic("heart", hx, COUNTER_Y - 150, 0.6)
        elif hearts > h + 0.5:
            pic("heart_half", hx, COUNTER_Y - 150, 0.6)
        else:
            pic("heart", hx, COUNTER_Y - 150, 0.6, 0.2)
elif self.phase == "eat":
    text(cx, COUNTER_Y - 200 - (EAT_STEPS - self.timer) / 2, f"+{self.paid}", GOLD, 22, "center")
elif self.phase == "angry":
    text(cx, COUNTER_Y - 200, "Too slow!", RED, 18, "center")
draw_focus(self)
