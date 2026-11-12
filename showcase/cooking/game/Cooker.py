# object: Cooker
# parent: Spot
# One spot on a grill, a fryer, a pot, a steamer, or one tap of a drinks machine:
# cookers[c]["slots"][s] in the kitchen's day. Tap it empty to start it, ready to
# take what's done, burnt to bin it.

# === create
super().on_create()
self.c = 0
self.s = 0
self.machine = ""

# === draw
k = self.kday
slot = k["cookers"][self.c]["slots"][self.s]
cx = self.x + self.wide / 2
pic(self.machine, cx, self.y + self.high - 34, 1)
st = slot_state(k, slot)
item = ITEMS[slot["item"]]
food_y = self.y + 44
if st == "empty":
    # What goes here, faintly, so it's clear what a tap will start.
    pic(item["raw"], cx, food_y, 0.7, 0.35)
else:
    name = {"cooking": item["pics"][0], "ready": item["pics"][1], "burnt": item["pics"][2]}[st]
    pic(name, cx, food_y, 0.9)
    # How it's coming on: green while cooking; once done, a bar running down to burnt.
    done = cook_steps(k, slot["item"])
    bx, by, bw = self.x + 8, self.y + 4, self.wide - 16
    draw_set_color("#20140c")
    draw_rect(bx, by, bx + bw, by + 8)
    if st == "cooking":
        draw_set_color("#5fd16a")
        draw_rect(bx, by, bx + bw * slot["t"] / done, by + 8)
    elif st == "ready" and item["keep"] is not None:
        left = 1 - (slot["t"] - done) / item["keep"]
        draw_set_color("#ffd23f" if left > 0.4 else "#ff6b3d")
        draw_rect(bx, by, bx + bw * left, by + 8)
    elif st == "ready":
        draw_set_color("#7fd0ff")
        draw_rect(bx, by, bx + bw, by + 8)
    else:
        draw_set_color("#3a3a3a")
        draw_rect(bx, by, bx + bw, by + 8)
        draw_set_alpha(0.5)
        draw_set_color("#555555")
        draw_circle(cx - 8, food_y - 30 - (k["t"] % 40) / 2, 10)
        draw_circle(cx + 10, food_y - 40 - (k["t"] % 30) / 2, 8)
        draw_set_alpha(1)
draw_focus(self)
