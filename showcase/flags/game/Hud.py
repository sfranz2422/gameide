# object: Hud
# The score, the clock, your snowballs, the minimap, and which way to go.

# === draw_gui
m = global_vars.m
me = global_vars.player
red, blue = TEAMS
if in_room() and m["ph"] == "lobby":
    # Waiting for the next match: who's here, and who will start it.
    here = 1 + len(net_players())
    reds = len([k for k in instances("Kid") if k.team == red and k.tag.startswith("p")])
    blues = len([k for k in instances("Kid") if k.team == blue and k.tag.startswith("p")])
    words(VIEW_W / 2, 10, f"Room {net_room()}: {here} here", 18, "#ffffff", "center")
    words(VIEW_W / 2, 36, f"{TEAM_NAMES[red]} {reds} · {TEAM_NAMES[blue]} {blues} · computer kids fill the rest", 12, "#ffffff", "center")
    if net_host() == net_me().number:
        words(VIEW_W / 2, VIEW_H - 40, "Press Enter to start the match!", 16, "#ffe27a", "center")
    else:
        words(VIEW_W / 2, VIEW_H - 40, f"Waiting for #{net_host()} to start the match.", 14, "#ffe27a", "center")
    if me.team is not None:
        words(VIEW_W / 2, VIEW_H - 18, f"You're on {TEAM_NAMES[me.team]}.", 12, TEAM_COLOURS[me.team], "center")
    return
if me.team is None:
    words(VIEW_W / 2, VIEW_H / 2, "Joining the match…", 18, "#ffffff", "center")
    return
words(VIEW_W / 2 - 14, 8, f"{TEAM_NAMES[red]} {m['score'][red]}", 20, TEAM_COLOURS[red], "right")
words(VIEW_W / 2, 8, "–", 20, "#ffffff", "center")
words(VIEW_W / 2 + 14, 8, f"{m['score'][blue]} {TEAM_NAMES[blue]}", 20, TEAM_COLOURS[blue], "left")
words(VIEW_W / 2, 34, "OVERTIME" if m["overtime"] else clock_text(m["t"]), 14, "#ffe27a" if m["overtime"] else "#ffffff", "center")
# Snowballs in hand.
for i in range(STOCK_MAX):
    draw_set_alpha(1 if i < me.stock else 0.25)
    draw_sprite("snowball", 0, 18 + i * 18, VIEW_H - 18)
draw_set_alpha(1)
if me.stock == 0:
    words(12, VIEW_H - 46, "Out of snowballs: hold E at a drift", 12, "#ffe27a")
draw_minimap(me.team)
if global_vars.woods_note > 0:
    draw_set_alpha(min(1, global_vars.woods_note / 30))     # fades out over its last half second
    words(VIEW_W / 2, VIEW_H / 2 + 50, WOODS_NOTE[0], 16, "#ffffff", "center")
    words(VIEW_W / 2, VIEW_H / 2 + 72, WOODS_NOTE[1], 12, "#dceeff", "center")
    draw_set_alpha(1)

# Which way: home with their flag, or to their flag.
mine, theirs = flag_of(me.team), flag_of(other_team(me.team))
if me.carry is not None:
    tx, ty = stand_of(me.team)
    tip = "Take it home!" if mine.state == "home" else "Your flag's gone: get it back to score"
elif mine.state == "carried":
    tx, ty, tip = mine.x, mine.y, "They've got your flag!"
else:
    tx, ty, tip = theirs.x, theirs.y, ""
a = point_direction(me.x, me.y, tx, ty)
cx, cy = me.x - view_x, me.y - view_y - 20
if point_distance(me.x, me.y, tx, ty) > 120:
    r = 46
    px, py = cx + math.cos(math.radians(a)) * r, cy - math.sin(math.radians(a)) * r
    col = TEAM_COLOURS[other_team(me.team)] if me.carry is None and mine.state != "carried" else TEAM_COLOURS[me.team]
    draw_set_color(col)
    l, w = 9, 6
    ca, sa = math.cos(math.radians(a)), -math.sin(math.radians(a))
    draw_triangle(px + ca * l, py + sa * l, px - sa * w, py + ca * w, px + sa * w, py - ca * w)
if tip:
    words(VIEW_W / 2, VIEW_H - 40, tip, 14, "#ffffff", "center")
if m["news"] is not None:
    words(VIEW_W / 2, 64, m["news"][0], 16, "#ffe27a", "center")
if me.stun > 0:
    words(VIEW_W / 2, VIEW_H / 2 - 60, "Splat! Back to your fort…", 18, "#ffffff", "center")
if m["over"] is not None:
    draw_set_color("#0b1a2a")
    draw_set_alpha(0.6)
    draw_rect(0, 120, VIEW_W, 230)
    draw_set_alpha(1)
    words(VIEW_W / 2, 140, f"{TEAM_NAMES[m['over']]} wins!", 36, TEAM_COLOURS[m["over"]], "center")
    words(VIEW_W / 2, 190, f"You captured {m['mine']} and hit {m['hits'].get(me.tag, 0)}.", 14, "#ffffff", "center")
