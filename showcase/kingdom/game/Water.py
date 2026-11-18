# object: Water
# depth: 100001
# The sea round the island, moving: two seamless pictures of water (the build's), the sea
# drifting one way and its wave crests another, drawn in big tiles over what the view
# shows, behind the land (the ground picture is see-through past the shore), and foam
# lapping at the shore all round. A dozen tiles a layer at the furthest zoom, and eight
# lines of foam: a few draws a step, never one a wave.

# === create
self.t = 0
# Where the sea meets the land, round the island: the sand along the two back edges
# (the build's shore is 12 pixels out), the foot of the earthy cliff along the front two.
mw, mh = MAP_W, MAP_H
top, right = tile_xy(-0.5, -0.5), tile_xy(mw - 0.5, -0.5)
bottom, left = tile_xy(mw - 0.5, mh - 0.5), tile_xy(-0.5, mh - 0.5)
self.shore = [(top[0], top[1] - 12), (right[0] + 24, right[1]), (right[0], right[1] + 40),
              (bottom[0], bottom[1] + 40), (left[0], left[1] + 40), (left[0] - 24, left[1])]
cx = sum(q[0] for q in self.shore) / 6
cy = sum(q[1] for q in self.shore) / 6
# Each point's way out to sea (isometric: twice as far across as down).
self.out = []
for x, y in self.shore:
    d = math.hypot(x - cx, (y - cy) * 2) or 1
    self.out.append(((x - cx) / d * 2, (y - cy) / d))

# === step
self.t += 1

# === draw
n = 512
w, h = VIEW_W / zoom() + n, VIEW_H / zoom() + n
for pic, dx, dy, alpha in (("water", 0.18, 0.07, 1), ("water_glint", -0.32, 0.11, 0.9)):
    ox = (self.t * dx) % n
    oy = (self.t * dy) % n
    x0 = view_x - (view_x - ox) % n
    y0 = view_y - (view_y - oy) % n
    y = y0
    while y < view_y + h:
        x = x0
        while x < view_x + w:
            draw_sprite_ext(pic, 0, x, y, 1, 1, 0, "white", alpha)
            x += n
        y += n
# Foam: two white lines round the shore, lapping in and out of step with each other.
for k, phase in ((0, 0.0), (1, 2.1)):
    lap = math.sin(self.t * 0.025 + phase)
    reach = 5 + 7 * k + 4 * lap
    draw_set_alpha(max(0.05, 0.36 + 0.16 * lap - 0.12 * k))
    draw_set_color("#f2fbfb")
    pts = [(x + ox * reach, y + oy * reach) for (x, y), (ox, oy) in zip(self.shore, self.out)]
    for i in range(6):
        a, b = pts[i], pts[(i + 1) % 6]
        draw_line(a[0], a[1], b[0], b[1], 3 - k)
draw_set_alpha(1)
