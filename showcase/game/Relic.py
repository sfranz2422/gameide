# object: Relic
# sprite: relic
# parent: Pickup
# The Feather of the Wind: a second jump, in the air.

# === create
super().on_create()
self.glow = "#9be7ff"

# === step
super().on_step()
if random.random() < 0.15:
    particles(self.x + random.uniform(-6, 6), self.y - 6, count=1, color="#bff6ff", speed=0.4, size=2, life=40, direction=90, spread=30)

# === collision Player
global_vars.abilities.add("double_jump")
mark_done(self)
sound_play("power")
screen_flash("white", 12)
effect("confetti", self.x, self.y - 10)
show_message("The Feather of the Wind: press jump again in the air.", 300)
save_progress()
self.destroy()
