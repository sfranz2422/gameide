# object: Hud
# depth: -1000
# What's on the glass: the room you're in, your jobs (ticked when done), and how
# to use the panel you're next to.

# === draw_gui
me = global_vars.player
words(VIEW_W / 2, 8, room_at(me.x, me.y), 16, "#cfeaff", "center")
draw_set_alpha(0.55)
draw_set_color("#020a14")
draw_rect(6, 6, 206, 30 + 18 * len(global_vars.jobs))
draw_set_alpha(1)
words(14, 10, f"Jobs {len([i for i in global_vars.jobs if i in global_vars.done])}/{len(global_vars.jobs)}", 14, "#ffd23f")
for k, i in enumerate(global_vars.jobs):
    kind, c, r = STATIONS[i]
    done = i in global_vars.done
    x, y = tile_middle(c, r)
    words(14, 30 + 18 * k, ("✓ " if done else "• ") + f"{JOB_KINDS[kind]}: {room_at(x, y)}", 12, "#3ecf8e" if done else "white")
if global_vars.near is not None and global_vars.job is None:
    words(VIEW_W / 2, VIEW_H - 40, "E: " + JOB_KINDS[global_vars.near.kind], 16, "#ffd23f", "center")
if global_vars.all_done > 0:
    global_vars.all_done -= 1
    words(VIEW_W / 2, 60, "All your jobs are done!", 24, "#3ecf8e", "center")
