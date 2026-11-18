# object: Morning
# depth: 1000
# Before the stand opens: the forecast and what's in stock (left), the shopping
# (middle), the recipe, the price and where to set up (right), and Open the stand.
# Nothing is bought until the stand opens, so changing your mind costs nothing.

# === create
weather(None)
lighting(0)
global_vars.focus = None
global_vars.problem = ""
s = global_vars.s
x1, x2 = 352, 690
y = 136
for k in SUPPLY_KEYS:
    make_stepper(x1, y, "buy_" + k, 316)
    y += 54
y = 136
for k in ("lemons", "sugar", "ice", "price"):
    make_stepper(x2, y, k, 316)
    y += 54
if has(s, "pink"):
    make_stepper(x2, y, "pink", 316)
    y += 54
make_stepper(x2, y, "place", 316)
self.open = make_button(VIEW_W / 2 - 150, 498, 300, 56, "Open the stand", "open", size=24)
self.open.hot = True
self.first = self.open
# The second stand: set up on a screen of its own (this one is full).
self.second = make_button(16, 504, 316, 44, "", "second", size=16)
self.second.shown = has(s, "second")

# === step
question_ok(True)
s = global_vars.s
self.second.shown = has(s, "second")
sec = second_open(s)
self.second.words = f"Second stand: {PLACES[sec['place']]['name']}, {sec['cups']} cups" if sec and sec["place"] is not None else "Second stand: closed"
run_controls(self.first)

# === draw
draw_sprite("place_" + place_now(global_vars.s)["key"], 0, 0, 0)

# === draw_gui
s = global_vars.s
day = today(s)
draw_set_alpha(0.35)
draw_set_color("#000000")
draw_rect(0, 0, VIEW_W, VIEW_H)
draw_set_alpha(1)
text(20, 14, f"Morning, day {s['day'] + 1}", GOLD, 28)
text(22, 52, rank_of(s["money"]), DIM, 15)
text(VIEW_W - 20, 14, f"Money {money(s['money'])}", INK, 26, "right")
text(VIEW_W - 140, 52, "Reputation", DIM, 14, "right")
draw_stars(VIEW_W - 118, 62, s["rep"])

# The forecast, and what's on the shelf.
panel(16, 96, 332, 470)
text(30, 104, "Forecast", GOLD, 20)
text(30, 134, f"{day['forecast']}°F, {forecast_words(day)}", INK, 22)
text(30, 166, f"Chance of rain {day['rain_pct']}%", SKY, 15)
y = 192
for line in event_notes(s, day):
    text(30, y, line, "#ffb36b", 14)
    y += 20
news = s["news"] or {}
if news.get("soft") or news.get("melted"):
    text(30, y + 4, "Overnight:", DIM, 14)
    y += 24
    if news.get("soft"):
        text(40, y, f"{news['soft']} lemons went soft", RED, 14)
        y += 20
    if news.get("melted"):
        text(40, y, f"{news['melted']} ice cubes melted", RED, 14)
        y += 20
text(30, 330, "On the shelf", GOLD, 20)
soon = sum(n for d, n in s["lemons"] if d <= s["day"] - LEMON_DAYS + 1)
rows = [("lemon", f"{lemon_count(s)} lemons" + (f" ({soon} soft tomorrow)" if soon else "")),
        ("sugar", f"{s['sugar']} scoops of sugar"), ("ice", f"{int(s['ice'])} ice cubes"), ("cups", f"{s['cups']} cups")]
for i, (pic, words) in enumerate(rows):
    icon(pic, 44, 374 + i * 28, 0.5)
    text(64, 364 + i * 28, words, INK, 15)

panel(340, 96, 676, 470)
text(352, 104, "Shopping", GOLD, 20)
cost = shopping_cost(s)
rent = place_now(s)["rent"]
sec = second_open(s)
if sec and sec["place"] in second_places(s):
    rent += PLACES[sec["place"]]["rent"] + SECOND_WAGE
text(352, 356, f"Shopping {money(cost)}", INK, 16)
text(352, 378, f"Rent{', both stands and helper' if sec else ''} {money(rent)}", INK, 16)
text(352, 402, f"Total {money(cost + rent)}", GOLD if cost + rent <= s["money"] else RED, 20)
# What the stock makes once the shopping's in (less what the second stand takes).
shelf = shelf_after_shopping(s)
if second_open(s):
    need = second_needs(s)
    shelf = {k: max(0, shelf[k] - need[k]) for k in SUPPLY_KEYS}
text(352, 428, f"Makes about {cups_from(s, shelf)} cups" + (" (after the second stand's)" if second_open(s) else ""), MINT, 14)
text(352, 448, "Lemons go soft after 3 days.", DIM, 11)
text(352, 461, "Ice melts by morning (unless you've a cooler).", DIM, 11)

panel(684, 96, 1010, 470)
text(696, 104, "Your lemonade", GOLD, 20)
if global_vars.problem:
    text(VIEW_W / 2, 474, global_vars.problem, RED, 15, "center")
text(VIEW_W / 2, 558, "Arrows choose · Left and Right change a number · Space presses", "#fff6d8", 13, "center")
