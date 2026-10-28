# object: Book
# The whole game is this one object: the title, the pages, the map and the
# duels, all drawn in Draw GUI over a picture. What it shows comes from
# STATE (book); the words from PAGES (story).

# === create
self.t = 0
self.mode = "title"
self.shown = None         # the page (or map, or duel round) on screen: a new one starts typing afresh
self.typed = 0.0          # letters of it typed so far
self.pic = "title"        # the picture behind, and the one fading out under it
self.old_pic = None
self.fade = 1.0
self.rows = []            # the choices on screen: (top, bottom) of each, from the last frame drawn
self.lit = 0              # the choice the keys have lit up
self.mouse = (0, 0)
self.token = PLACES["landing"]["at"]
self.route = []           # where the lantern still has to walk on the map
self.going = None
self.saved = save_get("journey", None) is not None and save_get("journey")["page"] != "intro"
self.menu = ["Continue the journey", "Begin a new journey"] if self.saved else ["Begin the journey"]
music_play("marsh", volume=0.55)

# === step
self.t += 1
self.fade = min(1.0, self.fade + 0.04)
clicked = mouse_check_pressed("left")
moved = (mouse_x, mouse_y) != self.mouse
self.mouse = (mouse_x, mouse_y)

# Rewind, top left, wherever there's something to go back to.
if self.mode != "title" and HISTORY and not self.route and (keyboard_check_pressed("backspace") or (clicked and on_rewind())):
    rewind()
    self.shown = None
    self.mode = STATE["mode"]
    sound_play("page", volume=0.6)
    return

if self.mode == "map":
    step_map(self, clicked)
    return

options = current_options(self)
key = screen_key(self)
if key != self.shown:
    self.shown = key
    self.typed = 0
    self.lit = 0
    self.rows = []
    turn_to(self, current_pic(self))
words = current_text(self)
if self.typed < len(words):
    self.typed += 1.6
    if clicked or keyboard_check_pressed("space") or keyboard_check_pressed("enter"):
        self.typed = len(words)
    return

picked = None
for i in range(len(options)):
    if keyboard_check_pressed(str(i + 1)):
        picked = i
if keyboard_check_pressed("up"):
    self.lit = (self.lit - 1) % len(options)
if keyboard_check_pressed("down"):
    self.lit = (self.lit + 1) % len(options)
over = next((i for i, (a, b) in enumerate(self.rows) if a <= mouse_y < b and PANEL_X <= mouse_x < PANEL_X + PANEL_W), None)
if over is not None and moved:
    self.lit = over
if clicked and over is not None:
    picked = over
if picked is None and (keyboard_check_pressed("space") or keyboard_check_pressed("enter")):
    picked = self.lit
if picked is not None and picked < len(options):
    sound_play("pick", volume=0.5)
    choose(self, options[picked])

# === draw_gui
draw_set_alpha(1)
if self.mode == "map":
    draw_map(self)
else:
    draw_picture(self)
    if self.mode == "title":
        draw_title(self)
    else:
        draw_page(self)
        draw_status()
if self.mode != "title" and HISTORY and not self.route:
    draw_rewind()
