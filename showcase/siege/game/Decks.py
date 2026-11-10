# object: Decks
# depth: -300
# Your cards, on the title: pick 8 of them for your deck, upgrade them, and buy new
# ones with the coins you win. Click a card to take it in or leave it out (a card
# still in the shop is only chosen, to buy); the button under them upgrades or
# buys the card last clicked. Done when there are 8. Kept for next time (save_set).

# === create
self.chosen = my_deck()
self.about = None                # the card last clicked: its words and its button show

# === step
mx, my = mouse_x, mouse_y
if mouse_check_pressed("left"):
    for k, card in enumerate(ALL_CARDS):
        x, y = deck_slot(k)
        if x <= mx <= x + 72 and y <= my <= y + 66:
            self.about = card
            if not owns(card):
                sound_play("tick", volume=0.3)          # still in the shop: buy it first
            elif card in self.chosen:
                self.chosen.remove(card)
                sound_play("tick", volume=0.3)
            elif len(self.chosen) < DECK_SIZE:
                self.chosen.append(card)
                sound_play("tick", volume=0.3)
            else:
                sound_play("nope", volume=0.4)
            break
    if self.about and 180 <= mx <= 460 and 274 <= my <= 302:
        done = upgrade_card(self.about) if owns(self.about) else buy_card(self.about)
        sound_play("pop" if done else "nope", volume=0.5)
    if 250 <= mx <= 390 and 314 <= my <= 346 and len(self.chosen) == DECK_SIZE:
        save_set("deck", self.chosen)
        self.destroy()
if keyboard_check_pressed("escape"):
    self.destroy()

# === draw_gui
draw_set_alpha(0.92)
draw_set_color("#14263a")
draw_rect(0, 0, VIEW_W, VIEW_H)
draw_set_alpha(1)
words(16, 6, f"Your deck: pick {DECK_SIZE} ({len(self.chosen)} picked)", 16, "white")
coins_label(VIEW_W - 70, 6)
levels = my_levels()
for k, card in enumerate(ALL_CARDS):
    x, y = deck_slot(k)
    c = CARDS[card]
    taken = card in self.chosen
    mine = owns(card)
    draw_set_color("#ffd23f" if taken else "#5fb0ff" if card == self.about else "#1b1208")
    draw_rect(x - 2, y - 2, x + 74, y + 68)
    draw_set_color("#eef6fc" if taken else "#7d8a96" if mine else "#3a4654")
    draw_rect(x, y, x + 72, y + 66)
    card_picture(card, x + 36, y + 22, 0.75)
    words(x + 36, y + 42, c["name"], name_size(c["name"]), "white", "center")
    draw_set_color("#7a4fd0")
    draw_circle(x + 8, y + 8, 9)
    words(x + 8, y + 1, str(c["cost"]), 12, "white", "center")
    if mine:
        words(x + 36, y + 53, f"Level {levels[card]}", 9, "#ffd23f", "center")
    else:
        # In the shop: dimmed, with its price.
        draw_set_alpha(0.45)
        draw_set_color("#0a1420")
        draw_rect(x, y, x + 72, y + 40)
        draw_set_alpha(1)
        coin(x + 22, y + 59, 5)
        words(x + 42, y + 52, str(c["price"]), 10, "#ffd23f", "center")
if self.about:
    c = CARDS[self.about]
    words(VIEW_W / 2, 252, f"{c['name']}: {c['about']}.", 13, "#cfe8f8", "center")
    if owns(self.about):
        cost = upgrade_cost(self.about)
        label = f"Level {levels[self.about]}: the top" if cost is None else f"Upgrade to level {levels[self.about] + 1}: {cost} coins"
    else:
        cost = c["price"]
        label = f"Buy it: {cost} coins"
    ok = cost is not None and my_coins() >= cost
    draw_set_color("#e0a020" if ok else "#4a5a6a")
    draw_rect(180, 274, 460, 302)
    words(VIEW_W / 2, 279, label, 14, "white", "center")
draw_set_color("#3ecf8e" if len(self.chosen) == DECK_SIZE else "#4a5a6a")
draw_rect(250, 314, 390, 346)
words(VIEW_W / 2, 320, "Done" if len(self.chosen) == DECK_SIZE else f"{DECK_SIZE - len(self.chosen)} more", 16, "white", "center")
