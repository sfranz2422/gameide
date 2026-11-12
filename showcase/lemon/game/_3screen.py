# script: screen
# Words, panels and little pictures, shared by every screen.
INK, SHADOW, GOLD, RED, MINT, SKY, DIM = "#ffffff", "#3a2a10", "#ffd23f", "#ff6b5f", "#9ff0c0", "#bfe6ff", "#d9d2bf"
PANEL, PANEL_EDGE = "#4a3418", "#ffe38a"
ICONS = ["lemon", "sugar", "ice", "cups", "pitcher", "pitcher_pink", "coin", "cooler", "juicer", "sign", "second", "strawberry", "soft_lemon"]


def text(x, y, words, colour=INK, size=16, align="left"):
    """Words with a shadow, so they read on a bright summer picture."""
    draw_set_font("Ubuntu", size)
    draw_set_halign(align)
    draw_set_color(SHADOW)
    draw_text(x + 2, y + 2, words)
    draw_set_color(colour)
    draw_text(x, y, words)
    draw_set_halign("left")


def panel(x1, y1, x2, y2, alpha=0.86):
    draw_set_alpha(alpha)
    draw_set_color(PANEL)
    draw_rect(x1, y1, x2, y2)
    draw_set_alpha(1)
    draw_set_color(PANEL_EDGE)
    draw_rect(x1, y1, x2, y2, True)


def icon(name, x, y, size=1):
    """One picture from the supplies sheet (ICONS), its middle at (x, y)."""
    draw_sprite_ext("icons", ICONS.index(name), x, y, size, size, 0, "white", 1)


def sky_words(day):
    return {"sunny": "Sunny", "cloudy": "Cloudy", "rain": "Rain"}[day["sky"]]


def forecast_words(day):
    """The forecast's sky, from its chance of rain: a forecast, so not always right."""
    p = day["rain_pct"]
    return "sunny" if p <= 10 else "some clouds" if p < 50 else "rain likely"


def event_notes(s, day):
    """What's special about a day, in words, for the forecast."""
    out = []
    if day["heat"]:
        out.append("Heat wave! Hot for days.")
    if day["rainy_week"]:
        out.append("A rainy spell.")
    if day["parade"]:
        out.append("Parade downtown today!")
    if day["rival"] is not None:
        out.append(f"A rival stand opens next to you, at {money(day['rival'])} a cup.")
    return out


def draw_stars(x, y, rep, size=14):
    """Reputation as five stars (half stars too)."""
    st = stars(rep)
    for k in range(5):
        fill = 1 if st >= k + 1 else 0.5 if st >= k + 0.5 else 0
        draw_set_color("#6b5a3a")
        draw_circle(x + k * (size + 4), y, size / 2)
        if fill:
            draw_set_color(GOLD)
            if fill == 1:
                draw_circle(x + k * (size + 4), y, size / 2)
            else:
                draw_rect(x + k * (size + 4) - size / 2, y - size / 2, x + k * (size + 4), y + size / 2)
