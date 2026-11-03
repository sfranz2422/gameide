# object: Jar
# parent: Block
# A jelly in a jar: what the level is about. Its children are the colours, each
# with sprite jar_<colour>, and the jelly that comes out is jelly_<colour>.

# === create
super().on_create()
made_of(self, 0.8, 2.5, "#ffffff", JAR_POINTS, "crack_glass")

# === destroy
super().on_destroy()
jelly = instance_create(self.x, self.y, "Jelly")
jelly.sprite = self.sprite.replace("jar", "jelly")
sound_play("yay", volume=0.7)
effect("sparkle", self.x, self.y)
