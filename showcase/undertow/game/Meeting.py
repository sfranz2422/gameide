# object: Meeting
# depth: -1200
# The meeting, over everything: who's in the round, what's been said, and the
# vote. Click a player and a room, then a phrase to say it; Vote or Skip. (Keys:
# arrows pick a player, Enter votes for them.) Ghosts watch but can't speak or
# vote. After the vote, who was sent up to the surface, and what they were.

# === create
self.pick = None                 # a player's number
self.room = None                 # a room's name
self.note = ""
self.note_t = 0

# === step
g = global_vars.g
self.note_t -= 1
people = sorted(g["in"])
if not people:
    return
mx, my = gui_mouse()
click = mouse_check_pressed("left")
# Arrows step through the players still in the round; Enter votes.
alive = [n for n in people if n not in ghosts(g)]
if alive and (keyboard_check_pressed("right") or keyboard_check_pressed("down")):
    self.pick = alive[(alive.index(self.pick) + 1) % len(alive)] if self.pick in alive else alive[0]
if alive and (keyboard_check_pressed("left") or keyboard_check_pressed("up")):
    self.pick = alive[(alive.index(self.pick) - 1) % len(alive)] if self.pick in alive else alive[-1]
if keyboard_check_pressed("enter") and self.pick is not None:
    vote(self.pick)
if not click:
    return
for k, n in enumerate(people):
    x, y, h = tile_xy(k, len(people))
    if x <= mx <= x + 74 and y <= my <= y + h:
        self.pick = n
        sound_play("click", volume=0.3)
for k, (name, _, _) in enumerate(ROOMS):
    x = 12 + k * 78
    if x <= mx <= x + 74 and 234 <= my <= 254:
        self.room = name
        sound_play("click", volume=0.3)
for k, (key, _, needs) in enumerate(PHRASES):
    x, y = 12 + (k % 5) * 124, 262 + (k // 5) * 26
    if x <= mx <= x + 120 and y <= my <= y + 22:
        if "n" in needs and self.pick is None:
            self.note, self.note_t = "Click a player first.", 120
        elif "room" in needs and self.room is None:
            self.note, self.note_t = "Click a room first.", 120
        elif not say(key, self.pick, self.room) and playing():
            self.note, self.note_t = "Wait a moment before saying more.", 90
if 12 <= mx <= 212 and 318 <= my <= 346 and self.pick is not None:
    vote(self.pick)
if 222 <= mx <= 342 and 318 <= my <= 346:
    vote(0)

# === draw_gui
g = global_vars.g
draw_set_color("#04121e")
draw_rect(0, 0, VIEW_W, VIEW_H)
if g["found"]:
    title = f"#{g['call']} found #{g['found']} frozen!"
else:
    title = f"#{g['call']} called a meeting at the beacon."
words(12, 8, title, 16, "#ffd23f")
if g["ph"] == "meeting":
    words(VIEW_W - 12, 8, f"{max(0, g['t']) // 60 + 1}s", 16, "white", "right")
people = sorted(g["in"])
out = ghosts(g)
counts = dict((k, c) for k, c in g["tally"])
for k, n in enumerate(people):
    x, y, h = tile_xy(k, len(people))
    name, suit = who(n)
    draw_set_color("#ffd23f" if n == self.pick else "#1b2a38")
    draw_rect(x - 2, y - 2, x + 76, y + h + 2)
    draw_set_color("#0d2233")
    draw_rect(x, y, x + 74, y + h)
    draw_sprite_ext("face_" + suit, 0, x + 2, y + 2, (h - 4) / SIZES["face_" + suit][0], (h - 4) / SIZES["face_" + suit][1],
                    0, "white", 0.35 if n in out else 1)
    words(x + 46, y + 2, f"#{n}", 13, "#ff5a4f" if n in global_vars.mates else "white")
    words(x + 46, y + h // 2 - 2, name[:6], 9, "#9fb9cf")
    if n in out:
        words(x + 22, y + h // 2 - 8, "out", 11, "#7f9fb9", "center")
    elif n in g["voted"] and g["ph"] == "meeting":
        words(x + 70, y + h - 14, "✓", 11, "#3ecf8e", "right")
    if g["ph"] == "result" and counts.get(n):
        words(x + 70, y + h - 14, f"{counts[n]} votes" if counts[n] > 1 else "1 vote", 9, "#ffd23f", "right")
# What's been said, newest at the bottom.
draw_set_color("#0b1620")
draw_rect(404, 34, 628, 226)
if not global_vars.chat:
    words(516, 120, "Nothing said yet", 11, "#4f6f89", "center")
for k, (n, text) in enumerate(global_vars.chat[-9:]):
    words(410, 38 + k * 20, f"#{n}: {text}", 10, "#ff5a4f" if n in global_vars.mates else "#cfeaff")
if g["ph"] == "result":
    draw_set_alpha(0.85)
    draw_set_color("#020a14")
    draw_rect(0, 232, VIEW_W, VIEW_H)
    draw_set_alpha(1)
    if g["ej"]:
        words(VIEW_W / 2, 250, f"#{g['ej']} ({who(g['ej'])[0]}) was sent up to the surface.", 18, "white", "center")
        words(VIEW_W / 2, 280, "They were a Mimic!" if g["em"] else "They were not a Mimic.", 18,
              "#ff5a4f" if g["em"] else "#9fd0ff", "center")
    else:
        skips = counts.get(0, 0)
        words(VIEW_W / 2, 262, f"Nobody was sent up ({skips} skipped)." if skips else "Nobody was sent up.", 18, "white", "center")
    return
if not playing():
    words(VIEW_W / 2, 280, "You're a ghost: you can watch, but not speak or vote.", 14, "#9fb9cf", "center")
    return
for k, (name, _, _) in enumerate(ROOMS):
    x = 12 + k * 78
    draw_set_color("#2f7d9f" if name == self.room else "#1b2a38")
    draw_rect(x, 234, x + 74, 254)
    words(x + 37, 238, name, 9, "white", "center")
for k, (key, text, needs) in enumerate(PHRASES):
    x, y = 12 + (k % 5) * 124, 262 + (k // 5) * 26
    draw_set_color("#24394c")
    draw_rect(x, y, x + 120, y + 22)
    shown = text.replace("#{n}", f"#{self.pick}" if self.pick else "#?").replace("{room}", self.room or "...")
    words(x + 60, y + 5, shown, 9, "white", "center")
if global_vars.my_vote is None:
    draw_set_color("#c0392b" if self.pick else "#4a2a2a")
    draw_rect(12, 318, 212, 346)
    words(112, 324, f"Vote for #{self.pick}" if self.pick else "Click someone to vote", 13, "white", "center")
    draw_set_color("#24394c")
    draw_rect(222, 318, 342, 346)
    words(282, 324, "Skip vote", 13, "white", "center")
else:
    words(12, 324, f"You voted for #{global_vars.my_vote}." if global_vars.my_vote else "You skipped.", 14, "#3ecf8e")
if self.note_t > 0:
    words(VIEW_W - 12, 326, self.note, 11, "#ffd23f", "right")
