# object: Job
# depth: -1100
# A job's panel, over the game (and the jobs list) while it's open. Its kinds (WiresJob,
# CrystalsJob, ValveJob, ScanJob) are the mini-games. Esc walks away; finished,
# it calls job_finished().

# === create
self.station = 0
self.t = 0

# === step
self.t += 1
if keyboard_check_pressed("escape"):
    job_closed(self)

# === draw_gui
x0, y0, x1, y1 = PANEL
draw_set_alpha(0.6)
draw_set_color("#000000")
draw_rect(0, 0, VIEW_W, VIEW_H)
draw_set_alpha(1)
# The machine's own panel behind, darkened so the job on it reads.
draw_sprite("panel_" + STATIONS[self.station][0], 0, x0, y0)
draw_set_alpha(0.72)
draw_set_color("#0b1620")
draw_rect(x0, y0, x1, y1)
draw_set_alpha(1)
draw_set_color("#5f7f99")
draw_rect(x0, y0, x1, y1, True)
words(VIEW_W / 2, y0 + 8, JOB_KINDS[STATIONS[self.station][0]], 18, "#cfeaff", "center")
words(VIEW_W / 2, y1 - 22, "Esc to walk away", 11, "#7f9fb9", "center")
