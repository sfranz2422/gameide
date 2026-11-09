# object: Cpu
# The other side, played by the computer when there's nobody else: it defends what
# comes over the gap, and when it has saved up, it pushes. It thinks a few times a
# second, with a little hesitation so it isn't superhuman.

# === create
self.t = 0
self.wait = 0
self.side = 1
self.save_for = random.choice((7, 8, 9))

# === step
m = global_vars
if m.over:
    return
self.t += 1
if self.wait > 0:
    self.wait -= 1
    return
if self.t % 12:
    return
me, them = self.side, 1 - self.side
energy = m.energy[me]
cards = hand(me)
# Their troops on our desk, nearest our towers first.
threats = sorted((u for u in instances("Unit") if u.side == them and own_half(me, u.x + forward(them) * 30)),
                 key=lambda u: abs(u.x - mirror_x(116, me)))


def play(card, x, y):
    if card in cards and play_card(me, cards.index(card), x, y):
        self.wait = random.randint(30, 70)
        return True
    return False


if threats:
    t = threats[0]
    lane_y = LANES[lane_of(t.y)]
    # Answer what's coming: archers for planes, a marble down a crowd, a knight or
    # soldiers in front of the rest. Dropped between it and our tower.
    in_front = clamp(t.x + forward(them) * 50, MID + GAP + 20, VIEW_W - 20) if me == 1 else clamp(t.x + forward(them) * 50, 20, MID - GAP - 20)
    crowd = [u for u in threats if point_distance(u.x, u.y, t.x, t.y) < 50 and not u.flies]
    tries = (["archer"] if t.flies else []) + (["marble"] if len(crowd) >= 3 else []) + \
            (["knight", "soldiers", "wall", "archer"] if not t.flies else ["soldiers"])
    for card in tries:
        if energy >= CARDS[card]["cost"]:
            y = t.y if card == "marble" else lane_y
            x = mirror_x(300, me) if card == "marble" else in_front
            if play(card, x, y):
                return
    return
# Nothing coming: save up, then push down one lane with a big one in front and help behind.
if energy >= self.save_for:
    lane = random.choice(LANES)
    for card in ("golem", "knight", "plane", "soldiers"):
        if energy >= CARDS[card]["cost"] and play(card, mirror_x(250 if card != "golem" else 230, me), lane):
            self.save_for = random.choice((5, 6, 7, 8, 9))
            return
elif energy >= 9.5:
    # Full: don't waste energy.
    for card in cards:
        if CARDS[card]["kind"] == "unit" and play(card, mirror_x(260, me), random.choice(LANES)):
            return
