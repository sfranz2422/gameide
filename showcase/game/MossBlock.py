# object: MossBlock
# sprite: moss_block
# solid: yes
# depth: 90
# Old mossy stone: the sword breaks it. Stays broken.

# === create
place_key(self)
if is_done(self):
    self.destroy()

# === collision Slash
mark_done(self)
sound_play("boom", volume=0.5)
camera_shake(2, 8)
particles(self.x, self.y - 8, count=14, color=["#5b6b3a", "#3c4a2a", "#8a9a5a"], speed=2.5, size=3, life=30, gravity=0.2)
self.destroy()
