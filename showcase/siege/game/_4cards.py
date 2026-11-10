# script: cards
# What you own: coins (won in matches), each card's level (bought upgrades), and
# the cards bought in the shop. All of it is kept in the save, so it's this
# browser's: a student with browser tools could give themselves coins, as with any
# game that keeps its own score. Nothing here touches a grade.


def my_coins():
    c = save_get("coins", 0)
    return c if isinstance(c, int) and c >= 0 else 0


def real_levels(levels):
    """Card levels as they may be played: a whole number from 1 to MAX_LEVEL for each real card, 1 if not."""
    if not isinstance(levels, dict):
        levels = {}
    out = {}
    for c in ALL_CARDS:
        v = levels.get(c, 1)
        out[c] = v if isinstance(v, int) and not isinstance(v, bool) and 1 <= v <= MAX_LEVEL else 1
    return out


def my_levels():
    return real_levels(save_get("levels"))


def owns(card):
    """Every card is yours but the shop's; those once bought."""
    if card not in SHOP_CARDS:
        return card in CARDS
    owned = save_get("owned", [])
    return isinstance(owned, list) and card in owned


def upgrade_cost(card):
    """Coins to take this card up a level, or None at the top."""
    level = my_levels()[card]
    return UPGRADE_COST[level - 1] if level < MAX_LEVEL else None


def upgrade_card(card):
    """Takes your card up a level, if you have it and the coins. True if it went."""
    cost = upgrade_cost(card)
    if not owns(card) or cost is None or my_coins() < cost:
        return False
    levels = my_levels()
    levels[card] += 1
    save_set("levels", levels)
    save_set("coins", my_coins() - cost)
    return True


def buy_card(card):
    """Buys a card from the shop, if you have the coins. True if it went."""
    if card not in SHOP_CARDS or owns(card) or my_coins() < CARDS[card]["price"]:
        return False
    owned = save_get("owned", [])
    save_set("owned", (owned if isinstance(owned, list) else []) + [card])
    save_set("coins", my_coins() - CARDS[card]["price"])
    return True


def match_coins(winner):
    """What a match pays you (side 0): a win against a player, a win against the computer, or anything else."""
    if winner == 0:
        return COINS_WIN_PLAYER if in_room() else COINS_WIN_CPU
    return COINS_LOSS


def cpu_level():
    """The computer plays at your deck's average level, rounded."""
    levels = my_levels()
    deck = my_deck()
    return max(1, min(MAX_LEVEL, round(sum(levels[c] for c in deck) / len(deck))))


def levels_of(side):
    """Side 0 is you; side 1 the other player (their levels, sent with them) or the computer."""
    if side == 0:
        return my_levels()
    if in_room() and opponent() is not None:
        return real_levels(opponent().get("levels"))
    k = cpu_level()
    return {c: k for c in ALL_CARDS}


def level_of(side, card):
    levels = getattr(global_vars, "levels", None)
    return levels[side].get(card, 1) if levels else 1


def power_at(level):
    return 1 + LEVEL_BOOST * (level - 1)


def upgrade(o, level):
    """
    Something a card made, at that card's level: troops and buildings have more health
    and hit harder; spells (Snowball, Avalanche, Cocoa, Fireworks) use .power, and ice
    and dams last longer.
    """
    o.level = level
    o.power = power_at(level)
    if is_a(o, "Unit") or is_a(o, "Building"):
        o.hp *= o.power
        o.max_hp *= o.power
        if hasattr(o, "damage"):
            o.damage *= o.power
    elif hasattr(o, "life"):
        o.life *= o.power


def burst_at(fw, k):
    """
    Where a Fireworks' k-th burst goes: from its seed, so both players' games agree.
    The other player's game (a puppet) shows the field mirrored, so the bursts too.
    """
    r = random.Random(fw.seed * 100 + k)
    a = r.uniform(0, 2 * math.pi)
    d = FIREWORKS_R * math.sqrt(r.random())
    return fw.x + d * math.cos(a) * (-1 if fw.puppet else 1), fw.y + d * math.sin(a)


def coin(x, y, r=6):
    """A gold coin, centred on (x, y)."""
    draw_set_color("#8a6a10")
    draw_circle(x, y, r + 1)
    draw_set_color("#ffd23f")
    draw_circle(x, y, r)
    draw_set_color("#fff2a8")
    draw_circle(x - r / 3, y - r / 3, r / 3)


def coins_label(x, y, size=14):
    """How many coins you have, with a coin, centred on x."""
    text = f"{my_coins()} coins"
    w = len(text) * size * 0.32
    coin(x - w - 4, y + size / 2 + 1)
    words(x + 6, y, text, size, "#ffd23f", "center")


def name_size(name):
    """Small enough for a card's name to fit across it ("Fire Salamander" didn't at 9)."""
    return 9 if len(name) <= 13 else 8
