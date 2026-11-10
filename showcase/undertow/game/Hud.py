# object: Hud
# depth: -1000
# What's on the glass: the room you're in, who you are this round, your jobs
# (ticked when done), the crew's progress, what E (or F) would do, and at the
# end, who won.

# === draw_gui
me = global_vars.player
g = global_vars.g
if g["ph"] in ("meeting", "result"):
    return          # the meeting has the whole screen
words(VIEW_W / 2, 8, room_at(me.x, me.y), 16, "#cfeaff", "center")
room = in_room()

# Waiting for a round.
if room and g["ph"] == "lobby":
    here = 1 + len(net_players())
    if net_host() == net_me().number:
        text = f"{here} here. Press Enter to start!" if here >= MIN_PLAYERS else f"{here} here: {MIN_PLAYERS} are needed to start."
    else:
        text = f"{here} here. Waiting for #{net_host()} to start."
    words(VIEW_W / 2, VIEW_H - 40, text, 16, "#ffd23f", "center")
    words(VIEW_W / 2, 30, f"Room {net_room()}: walk about while everyone joins.", 12, "#9fb9cf", "center")
    return
if room and net_me().number not in g["in"] and g["ph"] != "over":
    words(VIEW_W / 2, VIEW_H - 40, "A round is on: you'll be in the next one.", 14, "#9fb9cf", "center")

# Who you are: big, for a moment at the start of a round, then off your screen, so
# nobody glancing at it can tell (the teacher's ask). Ghosts are no secret.
role = global_vars.role
if room and role is not None and g["ph"] == "play":
    if am_ghost():
        words(VIEW_W - 10, 10, "You're a ghost", 14, "#9fb9cf", "right")
        words(VIEW_W - 10, 28, "Your jobs still count" if role == "crew" else "Watch the crew", 11, "#9fb9cf", "right")
    elif global_vars.role_flash > 0:
        global_vars.role_flash -= 1
        draw_set_alpha(min(1, global_vars.role_flash / 30) * 0.8)
        draw_set_color("#020a14")
        draw_rect(120, 120, VIEW_W - 120, 240)
        draw_set_alpha(1)
        if role == "mimic":
            words(VIEW_W / 2, 132, "You are a Mimic", 30, "#ff5a4f", "center")
            mates = ", ".join(f"#{n}" for n in global_vars.mates)
            words(VIEW_W / 2, 176, ("The other Mimics: " + mates + ". " if mates else "") + "Freeze the crew with F.", 14, "#ff9a8f", "center")
            words(VIEW_W / 2, 200, "Your jobs are pretend: act like crew.", 12, "#ff9a8f", "center")
        else:
            words(VIEW_W / 2, 132, "You are crew", 30, "#3ecf8e", "center")
            words(VIEW_W / 2, 176, "Do your jobs. Watch for Mimics.", 14, "#9fd0b9", "center")

# Your jobs.
if global_vars.jobs:
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
# The whole crew's jobs, as a bar: all done, and the crew win.
if room and g["ph"] == "play" and g["jobs"][1]:
    done, total = g["jobs"]
    draw_set_color("#020a14")
    draw_rect(220, 30, 420, 38)
    draw_set_color("#3ecf8e")
    draw_rect(220, 30, 220 + 200 * done / total, 38)

near = global_vars.near
if near is not None and global_vars.job is None:
    what, thing = near
    text = {"body": f"E: tell everyone about #{getattr(thing, 'number', 0)}", "beacon": "E: call a meeting"}.get(what) or "E: " + JOB_KINDS[thing.kind]
    words(VIEW_W / 2, VIEW_H - 40, text, 16, "#ffd23f", "center")
if global_vars.target is not None and global_vars.cool <= 0:
    words(VIEW_W / 2, VIEW_H - 62, f"F: freeze #{global_vars.target.number}", 16, "#9fe3ff", "center")
if global_vars.all_done > 0:
    global_vars.all_done -= 1
    words(VIEW_W / 2, 60, "All your jobs are done!", 24, "#3ecf8e", "center")

# The end of a round.
if room and g["ph"] == "over":
    draw_set_alpha(0.8)
    draw_set_color("#020a14")
    draw_rect(0, 90, VIEW_W, 250)
    draw_set_alpha(1)
    crew_won = g["win"] == "crew"
    draw_sprite("mimic_shown" if crew_won else "mimic_open", 0, 90, 236)
    words(VIEW_W / 2, 104, "The crew win!" if crew_won else "The Mimics win!", 32, "#3ecf8e" if crew_won else "#ff5a4f", "center")
    words(VIEW_W / 2, 152, g["why"], 16, "white", "center")
    mm = ", ".join(f"#{n} {who(n)[0]}" for n in g["mm"])
    words(VIEW_W / 2, 184, ("The Mimics were " if len(g["mm"]) > 1 else "The Mimic was ") + mm + ".", 14, "#ff9a8f", "center")
    words(VIEW_W / 2, 214, f"Back to the hub in {g['t'] // 60 + 1}s", 12, "#9fb9cf", "center")
