# script: crew
# The suits, the jobs each player is given, and words on the screen.
import random

# The suits to pick from: their name in the game, what the picker calls them, and their colour.
SUITS = [
    ("coral", "Coral", "#ff6b5a"), ("sea", "Sea Green", "#3ecf8e"), ("sun", "Sunshine", "#ffd23f"),
    ("violet", "Violet", "#9b6bff"), ("orange", "Orange", "#ff9a3c"), ("white", "White", "#e8f1ff"),
    ("black", "Black", "#2b3442"), ("pink", "Pink", "#ff7ac6"),
]
JOB_OBJECT = {"wires": "WiresJob", "crystals": "CrystalsJob", "valve": "ValveJob", "scan": "ScanJob"}
PANEL = (120, 40, 520, 320)      # where a job's panel is on the screen


def words(x, y, text, size=16, color="white", align="left"):
    """Text with a dark edge, so it reads on the dark station and the bright panels alike."""
    draw_set_font("Ubuntu", size)
    draw_set_halign(align)
    draw_set_color("#020a14")
    for dx, dy in ((-2, 0), (2, 0), (0, -2), (0, 2)):
        draw_text(x + dx, y + dy, text)
    draw_set_color(color)
    draw_text(x, y, text)
    draw_set_halign("left")


def deal_jobs(seed):
    """Which panels a player must fix: JOBS_EACH of them, by number in STATIONS."""
    return sorted(random.Random(seed).sample(range(len(STATIONS)), JOBS_EACH))


def gui_mouse():
    """Where the mouse is on the screen (a job's panel is drawn there), not in the room."""
    return mouse_x - view_x, mouse_y - view_y


def job_finished(job):
    """A job's done: ticked off, its panel goes green, and the player can move again."""
    global_vars.done.add(job.station)
    global_vars.job = None
    job.destroy()
    sound_play("done", volume=0.6)
    if all(i in global_vars.done for i in global_vars.jobs):
        global_vars.all_done = 240


def job_closed(job):
    """Walked away from (Esc): nothing kept, it starts afresh next time."""
    global_vars.job = None
    job.destroy()
