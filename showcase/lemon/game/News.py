# object: News
# depth: 1000
# The Monday paper (every WEEK days, before the morning): this week's supply prices
# against last week's, what the forecasts say is coming (heat, rain, the parade, rivals,
# bad luck), and how last week went. Everything in it is true: it's read from the days'
# own plans and the history.

# === create
global_vars.focus = None
self.done = make_button(VIEW_W / 2 - 150, 504, 300, 52, "To the morning", "paper_done", size=22)
self.done.hot = True
self.first = self.done

# === step
question_ok(True)
run_controls(self.first)

# === draw_gui
s = global_vars.s
draw_set_color("#f3ead2")
draw_rect(40, 16, VIEW_W - 40, 494)
draw_set_color("#3a2e1c")
draw_rect(40, 16, VIEW_W - 40, 494, True)
draw_line(60, 92, VIEW_W - 60, 92, 3)
week = s["day"] // WEEK + 1
plain(VIEW_W / 2, 26, "The Lemon Ledger", "#2a1d10", 40, "center")
plain(VIEW_W / 2, 70, f"Week {week} · Monday, day {s['day'] + 1}", "#5a4a30", 15, "center")
# Prices this week.
plain(70, 104, "Prices this week", "#2a1d10", 22)
for i, (k, name, pack, unit, _, _) in enumerate(SUPPLIES):
    now_, then, pct = price_trend(s, k)
    y = 140 + i * 30
    plain(80, y, f"{name}", "#2a1d10", 16)
    plain(220, y, f"about {money(round(now_))}", "#2a1d10", 16)
    arrow = "up" if pct > 3 else "down" if pct < -3 else "steady"
    plain(360, y, f"{arrow} {abs(pct)}%" if arrow != "steady" else "steady", "#a8321e" if pct > 3 else "#2f7a3a" if pct < -3 else "#5a4a30", 16)
plain(70, 270, "Buy what's cheap this week; lemons keep a few days.", "#5a4a30", 13)
# The week ahead.
plain(530, 104, "The week ahead", "#2a1d10", 22)
ahead = week_ahead(s)
if not ahead:
    plain(540, 140, "A quiet week: no heat waves, rain, parades", "#2a1d10", 15)
    plain(540, 162, "or rivals in the forecasts.", "#2a1d10", 15)
for i, (day_name, words) in enumerate(ahead[:9]):
    plain(540, 140 + i * 26, f"{day_name}: {words}", "#2a1d10", 15)
# Last week.
lw = last_week(s)
plain(70, 310, "Last week", "#2a1d10", 22)
if lw is not None:
    cups, profit, best = lw
    plain(80, 346, f"{cups} cups sold", "#2a1d10", 16)
    plain(80, 372, f"Profit {money(profit)}", "#2f7a3a" if profit >= 0 else "#a8321e", 16)
    plain(80, 398, f"Best day {money(best)}", "#2a1d10", 16)
plain(80, 436, f"Reputation now: {stars(s['rep'])} stars", "#2a1d10", 16)
