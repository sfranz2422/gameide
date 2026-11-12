# object: PageButton
# sprite: button
# parent: Button
# The levels come 24 to a page: this shows another page. Its creation code in the
# room says which (.to).

# === create
super().on_create()
self.to = 0

# === step
first = self.to * CARDS_A_PAGE + 1
last = min(len(LEVELS), first + CARDS_A_PAGE - 1)
self.words = f"< Levels {first}-{last}" if self.to < global_vars.page else f"Levels {first}-{last} >"
self.off = self.to == global_vars.page or self.to >= pages()

# === mouse pressed left
if not self.off:
    global_vars.page = self.to
    sound_play("click", volume=0.5)
