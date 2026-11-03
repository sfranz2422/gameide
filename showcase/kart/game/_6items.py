# script: items
# What an item box gives, and what each item does. The boxes, slicks and bolts
# are objects (ItemBox, OilSlick, Bolt); this is what they share with Kart.

ITEMS = ["turbo", "oil", "bolt", "shield"]     # the order of the "items" sprite's frames
TURBO_STEPS = 70
SHIELD_STEPS = 360
SPIN_STEPS = 60
BOLT_SPEED = 7.5


def pick_item(kart):
    """Who's behind gets what catches them up; who's in front, what protects a lead."""
    if kart.place <= 2:
        return choose(["oil", "shield", "oil", "turbo"])
    if kart.place >= 6:
        return choose(["turbo", "bolt", "bolt", "shield"])
    return choose(["turbo", "oil", "bolt", "shield"])


def use_item(kart):
    """Whatever it holds: a time trial's turbos first."""
    if kart.turbos > 0:
        kart.turbos -= 1
        kart.boost = TURBO_STEPS
        kart_sound(kart, "boost")
        return
    what = kart.item
    if not what:
        return
    kart.item = None
    if what == "turbo":
        kart.boost = TURBO_STEPS
        kart_sound(kart, "boost")
    elif what == "shield":
        kart.shield = SHIELD_STEPS
        kart_sound(kart, "shield")
    elif what == "oil":
        r = math.radians(kart.a)
        slick = instance_create(kart.x - math.cos(r) * 30, kart.y + math.sin(r) * 30, "OilSlick")
        slick.owner = kart
        kart_sound(kart, "throw")
    elif what == "bolt":
        r = math.radians(kart.a)
        bolt = instance_create(kart.x + math.cos(r) * 26, kart.y - math.sin(r) * 26, "Bolt")
        bolt.owner = kart
        bolt.i = kart.i
        # It goes for the kart just ahead. In front already, it runs on down the road.
        bolt.target = next((c for c in RACE["karts"] if c.place == kart.place - 1), None)
        kart_sound(kart, "throw")


def spin_out(kart):
    """Hit by something: a shield takes it instead. Answers whether it hit."""
    if kart.shield > 0:
        kart.shield = 0
        kart_sound(kart, "shield")
        return False
    if kart.spin <= 0:
        kart.spin = SPIN_STEPS
        kart.boost = 0
        kart_sound(kart, "spin")
    return True
