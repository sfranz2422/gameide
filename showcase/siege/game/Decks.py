# object: Decks
# depth: -300
# Picking your deck, on the title: 8 of the 16 cards. Click a card to take it in or
# leave it out; Done when there are 8. Kept for next time (save_set "deck").

# === create
self.chosen = my_deck()
self.about = None                # the card last clicked, whose words show

# === step
mx, my = mouse_x, mouse_y
if mouse_check_pressed("left"):
    for k, card in enumerate(ALL_CARDS):
        x, y = deck_slot(k)
        if x <= mx <= x + 72 and y <= my <= y + 66:
            self.about = card
            if card in self.chosen:
                self.chosen.remove(card)
            elif len(self.chosen) < DECK_SIZE:
                self.chosen.append(card)
            else:
                sound_play("nope", volume=0.4)
                break
            sound_play("tick", volume=0.3)
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
words(VIEW_W / 2, 8, f"Your deck: pick {DECK_SIZE} cards ({len(self.chosen)} picked)", 18, "white", "center")
for k, card in enumerate(ALL_CARDS):
    x, y = deck_slot(k)
    c = CARDS[card]
    taken = card in self.chosen
    draw_set_color("#ffd23f" if taken else "#1b1208")
    draw_rect(x - 2, y - 2, x + 74, y + 68)
    draw_set_color("#eef6fc" if taken else "#7d8a96")
    draw_rect(x, y, x + 72, y + 66)
    card_picture(card, x + 36, y + 24, 0.8)
    words(x + 36, y + 46, c["name"], 9, "white", "center")
    draw_set_color("#7a4fd0")
    draw_circle(x + 8, y + 8, 9)
    words(x + 8, y + 1, str(c["cost"]), 12, "white", "center")
if self.about:
    c = CARDS[self.about]
    words(VIEW_W / 2, 284, f"{c['name']}: {c['about']}.", 14, "#cfe8f8", "center")
draw_set_color("#3ecf8e" if len(self.chosen) == DECK_SIZE else "#4a5a6a")
draw_rect(250, 314, 390, 346)
words(VIEW_W / 2, 320, "Done" if len(self.chosen) == DECK_SIZE else f"{DECK_SIZE - len(self.chosen)} more", 16, "white", "center")
