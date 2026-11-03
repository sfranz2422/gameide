# object: WaveButton
# sprite: button
# parent: Button
# Sends the next wave, when you say. Sending it before the last is cleared pays extra.

# === step
d = global_vars.director
left = len(LEVELS[d.level]["waves"]) - global_vars.wave
self.hidden = global_vars.mode != "playing" or left <= 0
self.words = "Send wave" if global_vars.wave else "Start!"
self.small = f"+{EARLY_BONUS} early" if wave_busy() else "ready"

# === mouse pressed left
if not self.hidden:
    send_wave(global_vars.director)
