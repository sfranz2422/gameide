# object: Climber
# sprite: climber_red_0
# depth: -10
# Anyone climbing: you (Player), and in a room the others (Ghost). Its sprite is
# the picture the player picked, and its frames are the poses: 0 standing, 1 and
# 2 running, 3 jumping, 4 falling, 5 throwing. In a room, each has its number
# over its head, in its own colour, because two players can pick the same picture.

# === create
self.pic = "red"
self.facing = 1
self.image_speed = 0
self.number = None
self.dizzy = 0

# === draw
draw_self()
if self.dizzy > 0:
    draw_sprite_ext("stars", 0, self.x, self.y - 60, 1, 1, self.dizzy * 8, "white", self.image_alpha)
if self.number is not None:
    draw_set_alpha(self.image_alpha)
    draw_set_color(number_color(self.number))
    draw_rect(self.x - 11, self.y - 78, self.x + 11, self.y - 62)
    words(self.x, self.y - 79, str(self.number), 13, "white", "center")
    draw_set_alpha(1)
