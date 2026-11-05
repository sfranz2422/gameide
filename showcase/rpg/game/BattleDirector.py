# object: BattleDirector
# depth: -70000
# Runs a fight: everyone acts once a round, fastest first. The heroes and foes are
# Fighter instances; this only says whose turn it is and what happened.

# === create
music_play("battle")
self.info = S["battle"]
self.heroes, self.foes = [], []
for i, h in enumerate(S["party"]):
    # The last stands just clear of the party's box, which grows upward with each hero.
    f = instance_create(470 + i * 34, 264 - (len(S["party"]) - 1 - i) * 44, "HeroFighter")
    f.setup(h)
    self.heroes.append(f)
count = len(self.info["foes"])
for i, key in enumerate(self.info["foes"]):
    f = instance_create((240 if count == 1 else 220) + (i % 2) * 70, 244 + (i * 46 if count > 1 else 44) - (count - 1) * 20, "FoeFighter")
    f.setup(key)
    self.foes.append(f)
self.queue = []
self.state = "next"
self.wait = 30
self.line = ", ".join(sorted({f.name for f in self.foes})) + " attack!"
self.act = None
instance_create(0, 0, "BattleBack").sprite = BATTLE_BACK.get(self.info["room"], "back_fields")


def say_line(words, steps=45):
    self.line = words
    self.wait = steps

self.say_line = say_line


def alive(side):
    return [f for f in side if f.hp > 0]

self.alive = alive


def do_hit(user, target, power, stat_name=""):
    guard = target.guard()
    n = hit_for(power, guard)
    if target.guarding:
        n = max(1, n // 2)
    target.hurt(n)

self.do_hit = do_hit


def finish_turn():
    close_menus()
    self.state = "next"

self.finish_turn = finish_turn


def attack(user, target):
    user.lunge()
    sound_play("hit")
    do_hit(user, target, user.power())
    say_line(f"{user.name} strikes {target.name}!")
    finish_turn()

self.attack = attack


def use_skill(user, key, target=None):
    skill = SKILLS[key]
    user.spend(skill["mp"])
    user.lunge()
    power = user.stat_of(skill["stat"]) * skill["power"]
    if skill["kind"] == "foe":
        do_hit(user, target, power)
        sound_play("magic" if skill["stat"] == "mag" else "hit")
    elif skill["kind"] == "foes":
        for f in alive(self.foes):
            do_hit(user, f, power)
        sound_play("magic" if skill["stat"] == "mag" else "hit")
    elif skill["kind"] == "ally":
        target.heal(int(power))
        sound_play("heal")
    else:
        for f in alive(self.heroes):
            f.heal(int(power))
        sound_play("heal")
    say_line(f"{user.name} uses {skill['name']}!")
    finish_turn()

self.use_skill = use_skill


def use_item(user, key, target):
    use_item_on(key, target.hero)
    target.hp, target.mp = target.hero["hp"], target.hero["mp"]
    target.flash("green", 15)
    sound_play("heal")
    say_line(f"{user.name} uses a {ITEMS[key]['name']}.")
    finish_turn()

self.use_item = use_item


def try_run(user):
    close_menus()
    if random.random() < 0.7:
        sound_play("tick")
        self.state = "ran"
        self.wait = 30
        self.line = "You got away!"
    else:
        say_line("You couldn't get away!")
        self.state = "next"

self.try_run = try_run


def choose_target(side, then, back):
    targets = alive(side)
    open_menu("Who?", [f"{t.name}  {t.hp}/{t.max_hp}" for t in targets], lambda i: then(targets[i]), back,
              left=VIEW_W // 2 - 110, top=120, w=250, on_move=lambda i: setattr(self, "aim", targets[i]))

self.choose_target = choose_target
self.aim = None


def hero_menu(user):
    def back_to_root():
        newest_menu().destroy()
        self.aim = None

    def pick(i):
        kind = words[i]
        if kind == "Attack":
            choose_target(self.foes, lambda t: attack(user, t), back_to_root)
        elif kind == "Skill":
            skills = hero_skills(user.hero)

            def on_skill(j):
                key = skills[j]
                kind2 = SKILLS[key]["kind"]
                if kind2 == "foe":
                    choose_target(self.foes, lambda t: use_skill(user, key, t), back_to_root)
                elif kind2 == "ally":
                    choose_target(self.heroes, lambda t: use_skill(user, key, t), back_to_root)
                else:
                    use_skill(user, key)

            open_menu("Skills", [(f"{SKILLS[k]['name']}  {SKILLS[k]['mp']} MP", user.mp >= SKILLS[k]["mp"]) for k in skills], on_skill, back_to_root, left=150, top=170, w=230)
        elif kind == "Item":
            keys = [k for k in S["items"] if ITEMS[k].get("heal") or ITEMS[k].get("mana")]

            def on_item(j):
                choose_target(self.heroes, lambda t: use_item(user, keys[j], t), back_to_root)

            open_menu("Items", [f"{ITEMS[k]['name']} x{S['items'][k]}" for k in keys], on_item, back_to_root, left=150, top=170, w=230)
        elif kind == "Defend":
            user.guarding = True
            say_line(f"{user.name} takes guard.")
            finish_turn()
        else:
            try_run(user)

    words = ["Attack"]
    if hero_skills(user.hero):
        words.append("Skill")
    if any(ITEMS[k].get("heal") or ITEMS[k].get("mana") for k in S["items"]):
        words.append("Item")
    words.append("Defend")
    if self.info["run"]:
        words.append("Run")
    open_menu(user.name, words, pick, left=8, top=VIEW_H - 40 - len(words) * ROW_H, w=130)

self.hero_menu = hero_menu


def foe_turn(foe):
    move = random.choice(FOES[foe.key]["moves"])
    foe.lunge()
    sound_play("foe_hit")
    targets = alive(self.heroes)
    if move[2] == "all":
        for h in targets:
            do_hit(foe, h, foe.power() * move[1])
    else:
        do_hit(foe, random.choice(targets), foe.power() * move[1])
    say_line(f"{foe.name}: {move[0]}!")

self.foe_turn = foe_turn


def win():
    self.state = "won"
    music_stop()
    sound_play("win")
    xp = sum(FOES[f.key]["xp"] for f in self.foes)
    gold = sum(FOES[f.key]["gold"] for f in self.foes)
    S["gold"] += gold
    lines = [f"Won! {xp} XP and {gold} gold."]
    for h in self.heroes:
        h.hero["hp"] = max(h.hp, 1)    # Everyone gets up after a win.
        h.hero["mp"] = h.mp
        lines += give_xp(h.hero, xp)
    if self.info["tag"]:
        S["cleared"].append(self.info["tag"])
    for words in lines:
        say(words)

self.win = win


def leave():
    S.pop("battle", None)
    music_play("theme")
    room_goto(S["room"])

self.leave = leave


# === step
S["steps"] += 1
if self.state in ("menu",):
    return
if self.wait > 0:
    self.wait -= 1
    return
if self.state == "won":
    if not dialogue_open():
        then = self.info.get("then")
        if then:
            S["after_battle"] = then
        self.leave()
    return
if self.state == "ran":
    for h in self.heroes:
        h.hero["hp"], h.hero["mp"] = max(h.hp, 1), h.mp
    self.leave()
    return
if self.state == "lost":
    if not dialogue_open():
        music_stop()
        room_goto("GameOver")
    return
if not self.alive(self.foes):
    self.win()
    return
if not self.alive(self.heroes):
    self.state = "lost"
    sound_play("lose")
    say("The party has fallen...")
    return
while True:
    if not self.queue:
        self.queue = sorted(self.alive(self.heroes) + self.alive(self.foes), key=lambda f: -f.quickness())
        for f in self.heroes:
            f.guarding = False
    who = self.queue.pop(0)
    if who.hp > 0:
        break
if who.is_hero:
    who.guarding = False
    self.state = "menu"
    self.aim = None
    self.line = f"{who.name}'s turn."
    self.hero_menu(who)
else:
    self.foe_turn(who)

# === draw_gui
draw_set_alpha(0.85)
draw_set_color("#141a2e")
draw_rect(0, 0, VIEW_W, 30)
draw_rect(VIEW_W - 250, VIEW_H - 16 - 24 * len(self.heroes), VIEW_W - 4, VIEW_H - 4)
draw_set_alpha(1)
draw_set_font(None, 15)
draw_set_color("#ffffff")
draw_text(10, 7, self.line)
y = VIEW_H - 10 - 24 * len(self.heroes)
for f in self.heroes:
    draw_set_color("#ff8f8f" if f.hp <= 0 else "#ffffff")
    draw_text(VIEW_W - 242, y, f"{f.name}  {f.hp}/{f.max_hp}  {f.mp} MP")
    y += 24
if self.aim is not None and self.aim._alive:
    draw_set_color("#ffd166")
    draw_triangle(self.aim.x - 8, self.aim.y - 74, self.aim.x + 8, self.aim.y - 74, self.aim.x, self.aim.y - 62)
