# object: UpgradeButton
# sprite: button
# parent: Button
# Upgrades the tower you've clicked on, if there is one.

# === step
t = global_vars.selected
self.hidden = t is None or t.level >= MAX_LEVEL
if not self.hidden:
    self.words = f"Upgrade to {t.level + 1}"
    self.small = f"{upgrade_price(t)} gold"
    self.off = global_vars.gold < upgrade_price(t)

# === mouse pressed left
t = global_vars.selected
if not self.hidden and not self.off and t is not None:
    global_vars.gold -= upgrade_price(t)
    t.spent += upgrade_price(t)
    t.level += 1
    t.damage *= 1.6
    t.range *= 1.12
    t.reload = max(6, int(t.reload * 0.88))
    effect("sparkle", t.x, t.y, "#ffd23f")
    sound_play("upgrade", volume=0.7)
