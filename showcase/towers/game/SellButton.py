# object: SellButton
# sprite: button
# parent: Button
# Sells the tower you've clicked on, for part of what went into it.

# === step
t = global_vars.selected
self.hidden = t is None
if t is not None:
    self.words = "Sell"
    self.small = f"+{sell_price(t)} gold"

# === mouse pressed left
t = global_vars.selected
if t is not None:
    global_vars.gold += sell_price(t)
    global_vars.selected = None
    t.destroy()
    sound_play("coin", volume=0.6)
