# script: screen
# Words on the screen, and the minimap.


def words(x, y, text, size=16, color="white", align="left"):
    """Text with a dark edge, so it reads on bright snow and in the dark woods alike."""
    draw_set_font("Ubuntu", size)
    draw_set_halign(align)
    draw_set_color("#10202e")
    for dx, dy in ((-2, 0), (2, 0), (0, -2), (0, 2)):
        draw_text(x + dx, y + dy, text)
    draw_set_color(color)
    draw_text(x, y, text)
    draw_set_halign("left")


def clock_text(steps):
    s = max(0, steps) // 60
    return f"{s // 60}:{s % 60:02d}"


def minimap_spot(x, y):
    """Where a place in the park is on the minimap (on the screen: bottom right)."""
    mw, mh = SIZES["minimap"]
    left, top = VIEW_W - mw - 8, VIEW_H - mh - 8
    return left + x * MAP_K, top + y * MAP_K


def draw_minimap(team):
    """The park small: your team, the flags, and an enemy only while one of your team can see them."""
    mw, mh = SIZES["minimap"]
    left, top = VIEW_W - mw - 8, VIEW_H - mh - 8
    draw_set_alpha(0.85)
    draw_sprite("minimap", 0, left, top)
    draw_set_alpha(1)
    for f in instances("Flag"):
        x, y = minimap_spot(f.x, f.y)
        draw_set_color(TEAM_COLOURS[f.team])
        draw_rect(x - 2, y - 6, x + 3, y - 1)
        draw_set_color("#3a2a1a")
        draw_line(x - 2, y - 6, x - 2, y + 1)
    for k in kids(team):
        x, y = minimap_spot(k.x, k.y)
        draw_set_color("#ffffff" if getattr(k, "is_player", False) else TEAM_COLOURS[team])
        draw_circle(x, y, 3 if getattr(k, "is_player", False) else 2)
    for e in seen_by_team(team):
        x, y = minimap_spot(e.x, e.y)
        draw_set_color(TEAM_COLOURS[e.team])
        draw_circle(x, y, 2)


def add_print(x, y, angle):
    """A footprint pair, pointing the way the kid walked; the oldest go when there are too many."""
    global_vars.prints.append((x, y, angle, global_vars.m_t))
    if len(global_vars.prints) > PRINTS_MAX:
        global_vars.prints.pop(0)
