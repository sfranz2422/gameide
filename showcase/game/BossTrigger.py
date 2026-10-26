# object: BossTrigger
# sprite: trigger_box
# visible: no
# Walking past this wakes the boss and shuts the way back.

# === create
if boss_beaten():
    self.destroy()

# === collision Player
for g in instances("BossGate"):
    g.visible = True
    g.solid = True
    effect("dust", g.x, g.y, scale=0.6)
for b in instances("Tusk"):
    b.state = "roar"
    b.timer = 100
    global_vars.boss = b
sound_play("roar")
camera_shake(8, 70)
music_play("music_boss")
self.destroy()
