# script: screen
# Drawing: the golfer and the aim line on the course (Draw), and the
# scores, the meter, the map and the cards over it (Draw GUI, 640 x 360).
import math

VIEW_W, VIEW_H = 640, 360
INK, PAPER, GOLD = "#ffffff", "#0f2a1c", "#facc15"


def panel(x1, y1, x2, y2, alpha=0.72):
    draw_set_alpha(alpha)
    draw_set_color(PAPER)
    draw_rect(x1, y1, x2, y2)
    draw_set_alpha(1)


def text(x, y, words, colour=INK, size=16, align="left"):
    draw_set_font(None, size)
    draw_set_halign(align)
    draw_set_color(colour)
    draw_text(x, y, words)
    draw_set_halign("left")


# ---------------------------------------------------------------- on the course

def draw_pin(hole, t):
    """The pin: a pole in the cup and a flag flapping at the top."""
    cx, cy = hole["cup"]
    draw_set_color("#e5e7eb")
    draw_line(cx, cy, cx, cy - 34, 2)
    flap = 3 if (t // 12) % 2 else 0
    draw_set_color("#ef4444")
    draw_triangle(cx + 1, cy - 34, cx + 1, cy - 22, cx + 17 - flap, cy - 29 + flap / 2)


def draw_aim(ball, aim, club):
    """Dots along the way the shot will go, as far as the club can hit it, and a ring where it lands."""
    c = CLUBS[club]
    reach = c["carry"] if c["carry"] else PUTT_SPEED / (1 - GRIP["green"])
    a = math.radians(aim)
    draw_set_color(INK)
    draw_set_alpha(0.8)
    for k in range(1, int(reach // 14) + 1):
        d = k * 14
        draw_circle(ball.x + math.cos(a) * d, ball.y - math.sin(a) * d, 1.6)
    if c["carry"]:
        draw_circle(ball.x + math.cos(a) * reach, ball.y - math.sin(a) * reach, 9, True)
    draw_set_alpha(1)


def draw_golfer(player, ball, aim, swing):
    """The golfer beside the ball, facing it, arms down to the club; `swing`
    0 to 1 takes the club back."""
    a = math.radians(aim + 90)                 # the golfer stands to the left of the line of the shot
    gx, gy = ball.x + math.cos(a) * 28, ball.y - math.sin(a) * 28
    face = aim - 90                            # facing the ball (the picture faces right at angle 0)
    back = face + 110 * swing                  # the club swings back round behind
    r = math.radians(back)
    hx, hy = gx + math.cos(r) * 28, gy - math.sin(r) * 28
    draw_set_color("#9ca3af")
    draw_line(gx + math.cos(r) * 14, gy - math.sin(r) * 14, hx, hy, 2)
    draw_sprite_ext("club", 0, hx, hy, 1, 1, back, "white", 1)
    draw_sprite_ext(f"arm_{player}", 0, gx, gy, 1.3, 1.3, back + 12, "white", 1)
    draw_sprite_ext(f"arm_{player}", 0, gx, gy, 1.3, 1.3, back - 12, "white", 1)
    draw_sprite_ext(f"golfer_{player}", 0, gx, gy, 1.5, 1.5, face, "white", 1)


# ---------------------------------------------------------------- over it

def draw_hud(hole, player, club, ball):
    panel(0, 0, 250, 74)
    text(8, 4, f"Hole {ROUND['hole'] + 1}  ·  Par {hole['par']}  ·  {yards(point_distance(*hole['tee'], *hole['cup']))} yds", INK, 15)
    text(8, 24, f"{PLAYER_NAMES[player]} to play  ·  stroke {ROUND['strokes'][player] + 1}", PLAYER_COLOURS[player], 15)
    c = CLUBS[club]
    reach = f"{yards(c['carry'])} yds" if c["carry"] else "rolls"
    text(8, 44, f"{c['name']} ({reach})  ·  pin {yards(point_distance(ball.x, ball.y, *hole['cup']))} yds", GOLD, 15)
    wx, wy = ROUND["wind"]
    w = round(point_distance(0, 0, wx, wy))
    panel(0, 78, 136, 100)
    if w:
        d = point_direction(0, 0, wx, wy)
        draw_set_color(INK)
        r = math.radians(d)
        x, y = 120, 89
        draw_line(x - math.cos(r) * 9, y + math.sin(r) * 9, x + math.cos(r) * 9, y - math.sin(r) * 9, 2)
        draw_circle(x + math.cos(r) * 9, y - math.sin(r) * 9, 3)
        text(8, 81, f"Wind {w} mph", INK, 14)
    else:
        text(8, 81, "No wind", INK, 14)


def draw_meter(power):
    x1, y1, w = VIEW_W / 2 - 120, VIEW_H - 34, 240
    panel(x1 - 6, y1 - 6, x1 + w + 6, y1 + 22)
    draw_rect_gradient(x1, y1, x1 + w * power, y1 + 16, "#22c55e", "#ef4444", False)
    draw_set_color(INK)
    draw_rect(x1, y1, x1 + w, y1 + 16, True)
    text(VIEW_W / 2, y1 - 22, "Space again to hit", INK, 14, "center")


def draw_map(hole):
    """The whole hole, small, in the corner: where everyone is, and the cup."""
    k = 0.125
    x0, y0 = VIEW_W - COURSE_W * k - 6, 6
    panel(x0 - 3, y0 - 3, x0 + COURSE_W * k + 3, y0 + COURSE_H * k + 3, 0.6)
    draw_sprite_ext(f"hole_{ROUND['hole']}", 0, x0, y0, k, k, 0, "white", 1)
    cx, cy = hole["cup"]
    draw_set_color("#111827")
    draw_circle(x0 + cx * k, y0 + cy * k, 2.5)
    for i in range(ROUND["players"]):
        if not ROUND["holed"][i]:
            draw_set_color(PLAYER_COLOURS[i])
            draw_circle(x0 + BALLS[i].x * k, y0 + BALLS[i].y * k, 2.5)


def draw_card_for_hole(hole):
    panel(150, 100, 490, 230)
    text(320, 112, f"Hole {ROUND['hole'] + 1}", GOLD, 18, "center")
    text(320, 138, hole["name"], INK, 28, "center")
    text(320, 178, f"Par {hole['par']}  ·  {yards(point_distance(*hole['tee'], *hole['cup']))} yards", INK, 18, "center")
    text(320, 204, "Space to play", "#a7f3d0", 14, "center")


def draw_scorecard(t, final=False):
    panel(20, 30, 620, 330, 0.88)
    text(320, 38, "Final scores" if final else f"After hole {ROUND['hole'] + 1}", GOLD, 22, "center")
    x0, y0, cw = 120, 80, 40
    text(30, y0, "Hole", "#a7f3d0", 14)
    text(30, y0 + 22, "Par", "#a7f3d0", 14)
    for k, h in enumerate(HOLES):
        text(x0 + k * cw + 14, y0, k + 1, "#a7f3d0", 14, "center")
        text(x0 + k * cw + 14, y0 + 22, h["par"], "#a7f3d0", 14, "center")
    text(x0 + 9 * cw + 30, y0, "Total", "#a7f3d0", 14, "center")
    text(x0 + 9 * cw + 30, y0 + 22, total_par(len(HOLES)), "#a7f3d0", 14, "center")
    for i in range(ROUND["players"]):
        y = y0 + 54 + i * 28
        text(30, y, PLAYER_NAMES[i], PLAYER_COLOURS[i], 16)
        for k in range(len(HOLES)):
            s = ROUND["cards"][i][k]
            if s is not None:
                colour = GOLD if s < HOLES[k]["par"] else INK if s == HOLES[k]["par"] else "#fca5a5"
                text(x0 + k * cw + 14, y, s, colour, 16, "center")
        text(x0 + 9 * cw + 30, y, f"{total(i)} ({against_par(i)})", INK, 16, "center")
    if final:
        best = min(range(ROUND["players"]), key=total)
        if ROUND["players"] > 1:
            text(320, 262, f"{PLAYER_NAMES[best]} wins!", PLAYER_COLOURS[best], 24, "center")
        else:
            record = save_get("best", None)
            text(320, 262, f"Your best round: {record}", GOLD, 20, "center")
    if t > 40:
        text(320, 300, "Space to go on", "#a7f3d0", 14, "center")


def draw_title(players, t):
    draw_sprite_ext("hole_0", 0, 0, 0, 0.5, 0.5, 0, "white", 1)
    panel(0, 0, VIEW_W, VIEW_H, 0.35)
    text(322, 54, "GREENSIDE", "#000000", 54, "center")
    text(320, 50, "GREENSIDE", GOLD, 54, "center")
    text(320, 116, "Nine holes of golf, for one to four players", INK, 18, "center")
    panel(200, 160, 440, 214)
    text(320, 166, f"<  {players} player{'s' if players > 1 else ''}  >", INK, 22, "center")
    text(320, 194, "Space to tee off", "#a7f3d0", 14, "center")
    panel(0, VIEW_H - 46, VIEW_W, VIEW_H)
    text(320, VIEW_H - 42, "Left and right to aim, up and down for a club,", INK, 14, "center")
    text(320, VIEW_H - 24, "Space to start the swing, and Space again to hit.", INK, 14, "center")


def draw_words(words):
    if words:
        panel(120, 140, 520, 186)
        text(320, 150, words, GOLD, 24, "center")
