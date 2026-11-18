# object: Second
# depth: 1000
# The second stand, from the morning: whether it opens today, where (another place you
# sell at), its price, and how many cups' worth to send it from your shelf, at your
# recipe. A helper runs it; its sales and what's left come back in the evening.

# === create
global_vars.focus = None
y = 120
for k in ("s_open", "s_place", "s_price", "s_cups"):
    make_stepper(352, y, k, 316)
    y += 54
self.done = make_button(VIEW_W / 2 - 150, 498, 300, 56, "Done", "done_second", size=24)
self.done.hot = True
self.first = self.done

# === step
question_ok(True)
run_controls(self.first)

# === draw
s = global_vars.s
at = s["plan"]["second"]["place"]
draw_sprite("place_" + PLACES[at if at is not None else s["plan"]["place"]]["key"], 0, 0, 0)

# === draw_gui
s = global_vars.s
sec = s["plan"]["second"]
day = today(s)
draw_set_alpha(0.45)
draw_set_color("#000000")
draw_rect(0, 0, VIEW_W, VIEW_H)
draw_set_alpha(1)
text(20, 14, "Your second stand", GOLD, 28)
text(VIEW_W - 20, 14, f"Money {money(s['money'])}", INK, 26, "right")
text(20, 52, "A helper sells for you at another of your places. Its sales come in the evening.", DIM, 15)

# Today there: who'll come by, and what it costs.
panel(16, 96, 332, 470)
text(30, 104, "Today there", GOLD, 20)
if sec["place"] in second_places(s):
    p = PLACES[sec["place"]]
    guess = dict(day, temp=day["forecast"], sky="rain" if day["rain_pct"] >= 60 else "sunny")
    text(30, 136, p["name"], INK, 20)
    text(30, 166, f"{day['forecast']}°F, {forecast_words(day)}", INK, 15)
    text(30, 190, f"About {crowd_size(s, guess, sec['place'])} people walk by", INK, 15)
    text(30, 222, f"Rent {money(p['rent'])}", INK, 15)
    text(30, 244, f"Helper {money(SECOND_WAGE)}", INK, 15)
    text(30, 268, f"Costs {money(p['rent'] + SECOND_WAGE)} a day it opens", GOLD, 16)
    if day["parade"] and p["key"] == "downtown":
        text(30, 296, "Parade downtown today!", "#ffb36b", 14)
else:
    text(30, 136, "It needs a place of its own:", INK, 15)
    text(30, 160, "unlock another place in the", DIM, 14)
    text(30, 180, "evening, or move your own stand.", DIM, 14)
last = next((h["second"] for h in reversed(s["history"]) if h.get("second")), None)
if last is not None:
    text(30, 336, "Last time it opened", GOLD, 16)
    text(30, 362, f"{PLACES[last['place']]['name']}: sold {last['cups']} of {last['sent']['cups']}", INK, 14)
    text(30, 384, f"at {money(last['price'])}: {money(last['income'])}", INK, 14)
    gone = last["said"]["thirsty"]
    if gone:
        text(30, 408, f"{gone} went away thirsty: it ran out", "#ffb36b", 13)
    pricey = last["said"]["pricey"]
    if pricey:
        text(30, 428, f"{pricey} thought it too pricey", "#ffb36b", 13)

panel(340, 96, 676, 470)
text(352, 100, "Set it up", GOLD, 18)
text(352, 340, "The helper pours your recipe:", DIM, 13)
text(352, 360, f"{s['plan']['lemons']} lemons and {s['plan']['sugar']} scoops a pitcher, {s['plan']['ice']} cubes a cup",
     INK, 13)
text(352, 390, "Ice melts there too: send more on hot days.", DIM, 13)
text(352, 410, "What comes back goes on your shelf.", DIM, 13)

# From your shelf: what it takes, against what you'll have once the shopping's in.
panel(684, 96, 1010, 470)
text(696, 104, "From your shelf", GOLD, 20)
need = second_needs(s)
shelf = shelf_after_shopping(s)
names = dict((x[0], x[3]) for x in SUPPLIES)
for i, k in enumerate(SUPPLY_KEYS):
    y = 146 + i * 44
    icon({"lemons": "lemon", "sugar": "sugar", "ice": "ice", "cups": "cups"}[k], 716, y + 12, 0.5)
    text(740, y, f"{need[k]} {names[k]}", INK, 16)
    text(996, y + 2, f"of {shelf[k]}", MINT if need[k] <= shelf[k] else RED, 14, "right")
text(696, 330, "Counting the morning's shopping.", DIM, 13)
mine = cups_from(s, {k: shelf[k] - (need[k] if sec["open"] else 0) for k in SUPPLY_KEYS})
text(696, 356, f"Left for your own stand: about {mine} cups", INK, 14)
if global_vars.problem:
    text(VIEW_W / 2, 474, global_vars.problem, RED, 15, "center")
elif sec["open"] and second_problem(s):
    text(VIEW_W / 2, 474, second_problem(s), "#ffb36b", 15, "center")
text(VIEW_W / 2, 558, "Arrows choose · Left and Right change a number · Space presses", "#fff6d8", 13, "center")
