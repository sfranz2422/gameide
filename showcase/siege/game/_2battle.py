# script: battle
# A match: both sides' energy and hands, playing a card, damage, and who has won.
# The troops and towers themselves are objects (Unit, Tower and their kinds);
# this is what they share.


def is_a(inst, name):
    """True if the instance is that object or one of its kinds: is_a(o, "Unit") for a Knight."""
    return any(c.__name__ == name for c in type(inst).__mro__)


def words(x, y, text, size=14, color="white", align="left"):
    """Text with a dark edge, to read on the desk's wood and the paper cards alike."""
    draw_set_font("Ubuntu", size)
    draw_set_halign(align)
    draw_set_color("#1b1208")
    for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        draw_text(x + dx, y + dy, text)
    draw_set_color(color)
    draw_text(x, y, text)
    draw_set_halign("left")


def bar(x, y, w, frac, color):
    """A health bar, `w` wide, centred on x."""
    draw_set_color("#1b1208")
    draw_rect(x - w / 2 - 1, y - 1, x + w / 2 + 1, y + 4)
    draw_set_color(color)
    draw_rect(x - w / 2, y, x - w / 2 + w * max(0.0, min(1.0, frac)), y + 3)


def stopped():
    """The match isn't running: over, or held while the other player is away."""
    return global_vars.over or global_vars.halt


def next_uid():
    global_vars.uid = getattr(global_vars, "uid", 0) + 1
    return global_vars.uid


def new_match():
    """Everything a match keeps, fresh: energy, hands, crowns, the clock."""
    m = global_vars
    m.halt = False
    m.again = [False, False]           # Play again, pressed: both, in a room
    m.match_no = getattr(m, "match_no", 0) + 1
    m.energy = [float(ENERGY_START), float(ENERGY_START)]
    m.decks = []
    for side in (0, 1):
        order = DECK[:]
        random.shuffle(order)
        m.decks.append(order)          # the first HAND are in your hand, the next is up next
    m.crowns = [0, 0]
    m.clock = MATCH_STEPS
    m.overtime = False
    m.over = False
    m.winner = None                    # 0, 1, or -1 for a draw
    for o in instances("Building") + instances("Unit") + instances("Deploy") + instances("Marble") + instances("Glue") + instances("Shot"):
        o.destroy()
    for side in (0, 1):
        for kind, x, y in TOWERS:
            t = instance_create(mirror_x(x, side), y, "Keep" if kind == "keep" else "Tower")
            t.side = side
            setup_tower(t, kind)


def hand(side):
    return global_vars.decks[side][:HAND]


def up_next(side):
    return global_vars.decks[side][HAND]


def play_card(side, slot, x, y):
    """
    Plays the card in hand slot `slot` at (x, y), if there's the energy and it may go
    there. The card goes to the back of the deck and the next one comes into the hand.
    """
    m = global_vars
    if m.over or not 0 <= slot < HAND:
        return False
    card = m.decks[side][slot]
    if m.energy[side] < CARDS[card]["cost"] or not can_drop(side, card, x, y):
        return False
    m.energy[side] -= CARDS[card]["cost"]
    deck = m.decks[side]
    deck.pop(slot)
    # The card that was up next comes into the empty slot; the played one goes to the back.
    deck.insert(slot, deck.pop(HAND - 1))
    deck.append(card)
    d = instance_create(x, y, "Deploy")
    d.card, d.side = card, side
    sound_play("drop", volume=0.5)
    return True


def hurt(target, amount):
    """Damage. A tower that falls is a crown for the other side; the keep is all three, and the match."""
    if not instance_exists(target):
        return
    target.hp -= amount
    target.flash = 6
    if target.hp > 0:
        return
    if is_a(target, "Tower"):
        other = 1 - target.side
        if is_a(target, "Keep"):
            global_vars.crowns[other] = 3
            end_match(other)
        else:
            global_vars.crowns[other] += 1
        sound_play("crash", volume=0.7)
        camera_shake(4, 12)
    target.destroy()


def end_match(winner):
    m = global_vars
    if m.over:
        return
    m.over, m.winner = True, winner
    for o in instances("Deploy"):
        o.destroy()
    sound_play("win" if winner == 0 else "lose" if winner == 1 else "drop", volume=0.7)


def enemies_of(side):
    """Everything of the other side's that can be fought: troops and buildings."""
    return [o for o in instances("Unit") + instances("Building") if o.side != side]


def tick_clock():
    """A step of the match: energy comes in, the clock runs down, overtime, the end."""
    m = global_vars
    if stopped():
        return
    rate = 2 if m.overtime else 1
    for side in (0, 1):
        m.energy[side] = min(float(ENERGY_MAX), m.energy[side] + rate / ENERGY_STEPS)
    m.clock -= 1
    if m.clock > 0:
        return
    if m.crowns[0] != m.crowns[1]:
        end_match(0 if m.crowns[0] > m.crowns[1] else 1)
    elif not m.overtime:
        m.overtime, m.clock = True, OVERTIME_STEPS
        sound_play("overtime", volume=0.6)
    else:
        # Still level: the side whose weakest tower is stronger.
        def weakest(side):
            hps = [t.hp / t.max_hp for t in instances("Tower") if t.side == side]
            return min(hps) if hps else 0
        a, b = weakest(0), weakest(1)
        end_match(-1 if abs(a - b) < 0.001 else 0 if a > b else 1)


def setup_tower(t, kind):
    t.hp, t.damage, t.range, t.rate, t.radius = TOWER_STATS[kind]
    t.max_hp = t.hp


def setup_unit(u, kind):
    """A troop's numbers, from UNITS in the rules."""
    u.hp, u.damage, u.range, u.rate, u.pace, u.radius, u.flies, u.targets = UNITS[kind]
    u.max_hp = u.hp


def can_hit(u, o):
    """Whether troop u can fight o: some only go for buildings; only some can reach a flyer."""
    if u.targets == "buildings":
        return is_a(o, "Building")
    if is_a(o, "Unit") and o.flies:
        return u.targets == "all"
    return True


def pick_target(u):
    """The nearest thing it can fight within sight, or else the nearest of the other side's towers."""
    best, near = None, SIGHT
    for o in enemies_of(u.side):
        if can_hit(u, o):
            d = point_distance(u.x, u.y, o.x, o.y) - o.radius
            if d < near:
                best, near = o, d
    if best is not None:
        return best
    towers = [t for t in instances("Tower") if t.side != u.side]
    return min(towers, key=lambda t: point_distance(u.x, u.y, t.x, t.y)) if towers else None


def shoot(x, y, target, damage, side):
    s = instance_create(x, y, "Shot")
    s.target, s.damage, s.side = target, damage, side
    return s


# ---- the cards along the bottom (Hand draws them; tests and the page click them)

def card_xy(k):
    return 150 + k * 86, BOTTOM + 20


def card_at(x, y):
    """Which hand slot is at (x, y) on the screen, or None."""
    for k in range(HAND):
        cx, cy = card_xy(k)
        if cx <= x <= cx + 72 and cy - 6 <= y <= cy + 58:
            return k
    return None


def card_picture(card, x, y):
    """A little picture of the card's troop, centred on (x, y)."""
    c = SIDE_COLOR[0]
    if card == "soldiers":
        for dx in (-8, 0, 8):
            draw_set_color(c)
            draw_circle(x + dx, y + (4 if dx else -2), 5)
    elif card == "knight":
        draw_set_color(c)
        draw_rect(x - 8, y - 8, x + 8, y + 8)
        draw_set_color("#c0c8d0")
        draw_rect(x - 5, y - 11, x + 5, y - 4)
    elif card == "plane":
        draw_set_color("#ffffff")
        draw_triangle(x + 12, y, x - 10, y - 8, x - 10, y + 8)
    elif card == "archer":
        draw_set_color(c)
        draw_circle(x, y, 7)
        draw_set_color("#c9874a")
        draw_line(x + 4, y - 9, x + 9, y + 7, 2)
    elif card == "golem":
        draw_set_color("#ff9fb0")
        draw_rect(x - 12, y - 10, x + 12, y + 10)
        draw_set_color(c)
        draw_rect(x - 12, y + 2, x + 12, y + 10)
    elif card == "wall":
        for k, col in enumerate(("#ff6b5a", "#ffd23f", "#3ecf8e", "#4fa3ff")):
            bx, by = x - 10 + (k % 2) * 10, y - 8 + (k // 2) * 8
            draw_set_color(col)
            draw_rect(bx, by, bx + 9, by + 7)
    elif card == "marble":
        draw_set_color("#4fc3ff")
        draw_circle(x, y, 10)
        draw_set_color("#ffffff")
        draw_circle(x - 3, y - 3, 3)
    elif card == "glue":
        draw_set_color("#f2f0e6")
        draw_circle(x, y + 2, 11)
        draw_set_color("#e0dccb")
        draw_rect(x - 3, y - 14, x + 3, y - 4)


def crown(x, y, won, color):
    """A little crown centred on (x, y): filled in the side's colour if won, an outline if not."""
    pts = [(x - 9, y + 6), (x - 9, y - 4), (x - 4, y + 1), (x, y - 7), (x + 4, y + 1), (x + 9, y - 4), (x + 9, y + 6)]
    if won:
        draw_set_color(color)
        draw_triangle(pts[0][0], pts[0][1], pts[1][0], pts[1][1], pts[2][0], pts[2][1])
        draw_triangle(pts[2][0], pts[2][1], pts[3][0], pts[3][1], pts[4][0], pts[4][1])
        draw_triangle(pts[4][0], pts[4][1], pts[5][0], pts[5][1], pts[6][0], pts[6][1])
        draw_rect(x - 9, y + 1, x + 9, y + 6)
    draw_set_color("#1b1208")
    for a, b in zip(pts, pts[1:] + pts[:1]):
        draw_line(a[0], a[1], b[0], b[1], 2)
