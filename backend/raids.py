"""
Raids in a published game (2026-11-18, for Highmoor: the teacher's ask, "kids can attack
the other bases"): each player's kingdom is kept here (raid_share in the game), others at
the same school are matched against it by trophies while its owner is away, and a raid's
result moves trophies, gold and food. The game's runtime side is the raid_ functions in
runtime.py; the page's, player/raids.ts.

The server decides everything that matters, never the page: who is matched with whom
(same email domain, as the high-score boards; not shielded; not being raided already),
the loot on offer (a share of what the defender has, worked out here), the trophies at
stake, and the shield after. A result is checked against its offer. The battle itself is
played in the attacker's browser, so a student with browser tools could claim more stars
than they won: it moves trophies and a share of loot within the game, and touches no
grade. Say so if asked whether it's cheat-proof.

Names are first names (_board_name), never an email: every route that hands out another
player needs a leak check in test_server.py.
"""
import json
import random
import re
from datetime import timedelta, timezone

from flask import Blueprint, jsonify, request

import publishing
from accounts import User, now
from gamestore import Raid, RaidBase
from publishing import _board_name, _need_user, _pub_or_404, _viewable, err, school_domain

bp = Blueprint("raids", __name__)

LOOT_SHARE = 0.2                 # of the defender's gold and food, on offer
LOOT_MOST = 250_000              # of each, at most
SHIELD_HOURS = {1: 4, 2: 8, 3: 12}
PENDING = timedelta(minutes=8)   # a raid found must be finished within this; its defender isn't offered to anyone else meanwhile
BASE_FRESH = timedelta(days=45)  # a kingdom not shared for this long isn't offered
MATCH_FROM = 5                   # picked at random among this many nearest in trophies
MOST_BUILDINGS = 800
MOST_REPLAY = 600
KIND = re.compile(r"^[a-z_]{1,24}$")


def _aware(t):
    """A time from the database, in UTC: SQLite (the tests') gives them back without their zone."""
    return t if t is None or t.tzinfo else t.replace(tzinfo=timezone.utc)


def _db():
    return publishing._db()


def _user(db):
    return publishing._current_user(db)


def _game(db, slug):
    """The signed-in player and the published game, or an error to send."""
    user = _need_user(db)
    pub = _pub_or_404(db, slug)
    why = _viewable(db, pub, user)
    return user, pub, why


def _int(v, lo, hi):
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        return None
    v = int(v)
    return v if lo <= v <= hi else None


def clean_buildings(raw):
    """A kingdom's buildings as the game sent them, kept only if every one is a kind
    (lowercase letters), a place and a level: nothing else ever reaches another player."""
    if not isinstance(raw, list) or len(raw) > MOST_BUILDINGS:
        return None
    out = []
    for b in raw:
        if not isinstance(b, dict) or not isinstance(b.get("kind"), str) or not KIND.match(b["kind"]):
            return None
        gx, gy, lv = _int(b.get("gx"), 0, 500), _int(b.get("gy"), 0, 500), _int(b.get("level"), 0, 100)
        if None in (gx, gy, lv):
            return None
        out.append({"kind": b["kind"], "gx": gx, "gy": gy, "level": lv})
    return out


def stakes(attacker, defender):
    """The trophies at stake: (won with three stars, lost with none). More to win against
    someone ahead of you, less against someone behind."""
    gap = defender - attacker
    return max(6, min(40, 20 + gap // 12)), max(4, min(30, 14 - gap // 12))


def _base(db, pub, user):
    row = db.query(RaidBase).filter_by(published_id=pub.id, user_id=user.id).first()
    if row is None:
        row = RaidBase(published_id=pub.id, user_id=user.id, buildings="[]", trophies=0)
        db.add(row)
        db.flush()
    return row


def _shield_left(row):
    if row.shield_until is None:
        return 0
    return max(0, int((_aware(row.shield_until) - now()).total_seconds()))


@bp.put("/api/play/<slug>/raid/base")
def share(slug):
    """{buildings: [{kind, gx, gy, level}], gold, food, power}: this player's kingdom now."""
    db = _db()
    try:
        user, pub, why = _game(db, slug)
        if why:
            return err(*why)
        body = request.get_json(silent=True) or {}
        buildings = clean_buildings(body.get("buildings"))
        gold, food = _int(body.get("gold"), 0, 10**10), _int(body.get("food"), 0, 10**10)
        power = _int(body.get("power"), 0, 1000)
        if buildings is None or None in (gold, food, power):
            return err("That isn't a kingdom: buildings (kind, gx, gy, level), gold, food and power.", 400)
        row = _base(db, pub, user)
        row.buildings = json.dumps(buildings, separators=(",", ":"))
        row.gold, row.food, row.power, row.updated_at = gold, food, power, now()
        db.commit()
        return jsonify(ok=True)
    finally:
        db.close()


@bp.post("/api/play/<slug>/raid/find")
def find(slug):
    """A kingdom to raid: the nearest in trophies at the same school, not shielded, not
    being raided already. Raiding ends the raider's own shield. {raid: {id, name,
    trophies, buildings, gold, food, win, lose}} or {raid: None, why}."""
    db = _db()
    try:
        user, pub, why = _game(db, slug)
        if why:
            return err(*why)
        domain = school_domain(user)
        mine = _base(db, pub, user)
        mine.shield_until = None
        # Any raid of mine left unfinished is given up: no stars, as a raid that was left.
        for old in db.query(Raid).filter_by(published_id=pub.id, attacker_id=user.id, stars=None).all():
            db.delete(old)
        if domain is None:
            db.commit()
            return jsonify(raid=None, why="Raids are with others at your school: sign in with your school account.")
        t = now()
        busy = {r.defender_id for r in db.query(Raid).filter(Raid.published_id == pub.id, Raid.stars.is_(None),
                                                              Raid.created_at > t - PENDING).all()}
        rows = (db.query(RaidBase, User).join(User, User.id == RaidBase.user_id)
                .filter(RaidBase.published_id == pub.id, RaidBase.user_id != user.id,
                        RaidBase.updated_at > t - BASE_FRESH,
                        User.email.ilike("%@" + domain)).all())
        fair = [(b, u) for b, u in rows if b.user_id not in busy and _shield_left(b) == 0 and b.buildings != "[]"]
        if not fair:
            db.commit()
            return jsonify(raid=None, why="Nobody to raid at your school right now: everyone's shielded or not playing yet.")
        fair.sort(key=lambda bu: abs(bu[0].trophies - mine.trophies))
        b, u = random.choice(fair[:MATCH_FROM])
        win, lose = stakes(mine.trophies, b.trophies)
        r = Raid(published_id=pub.id, attacker_id=user.id, defender_id=u.id, buildings=b.buildings,
                 offer_gold=min(LOOT_MOST, int(b.gold * LOOT_SHARE)), offer_food=min(LOOT_MOST, int(b.food * LOOT_SHARE)),
                 win=win, lose=lose)
        db.add(r)
        db.commit()
        return jsonify(raid={"id": r.id, "name": _board_name(u), "trophies": b.trophies, "power": b.power,
                             "buildings": json.loads(r.buildings), "gold": r.offer_gold, "food": r.offer_food,
                             "win": win, "lose": lose})
    finally:
        db.close()


def trophy_change(r, stars, sent):
    """The attacker's trophies after a raid: a share of `win` by stars, or `lose` with none;
    nothing at all if no troop was sent (looked, and left)."""
    if not sent:
        return 0
    return -r.lose if stars == 0 else max(1, r.win * stars // 3)


@bp.post("/api/play/<slug>/raid/<int:raid_id>")
def finish(slug, raid_id):
    """{stars, percent, gold, food, replay}: how the raid went, checked against its offer.
    The trophies move, the defender's kingdom here loses what was taken, and a raid with a
    star gives the defender a shield. {trophies (the raider's change), mine (now)}."""
    db = _db()
    try:
        user, pub, why = _game(db, slug)
        if why:
            return err(*why)
        r = db.query(Raid).filter_by(id=raid_id, published_id=pub.id, attacker_id=user.id).first()
        if r is None or r.stars is not None:
            return err("That raid isn't yours to finish.", 404)
        if now() - _aware(r.created_at) > PENDING + timedelta(minutes=2):
            return err("That raid went on too long.", 409)
        body = request.get_json(silent=True) or {}
        stars, pct = _int(body.get("stars"), 0, 3), _int(body.get("percent"), 0, 100)
        gold, food = _int(body.get("gold"), 0, r.offer_gold), _int(body.get("food"), 0, r.offer_food)
        replay = body.get("replay", [])
        if None in (stars, pct, gold, food) or not isinstance(replay, list) or len(replay) > MOST_REPLAY:
            return err("That isn't how a raid ends: stars (0-3), percent, and no more loot than was there.", 400)
        steps = []
        for s in replay:
            if (not isinstance(s, list) or len(s) != 4 or not isinstance(s[1], str) or not KIND.match(s[1])
                    or any(isinstance(v, bool) or not isinstance(v, (int, float)) for v in (s[0], s[2], s[3]))):
                return err("That replay isn't a list of [time, troop, x, y].", 400)
            steps.append([round(float(s[0]), 3), s[1], round(float(s[2]), 3), round(float(s[3]), 3)])
        if stars and not steps:
            return err("Stars need troops: the replay is empty.", 400)
        change = trophy_change(r, stars, len(steps))
        mine = _base(db, pub, user)
        theirs = db.query(RaidBase).filter_by(published_id=pub.id, user_id=r.defender_id).first()
        mine.trophies = max(0, mine.trophies + change)
        if theirs is not None:
            theirs.trophies = max(0, theirs.trophies - change)
            theirs.gold = max(0, theirs.gold - gold)
            theirs.food = max(0, theirs.food - food)
            if stars:
                theirs.shield_until = now() + timedelta(hours=SHIELD_HOURS[stars])
        r.stars, r.percent, r.gold, r.food, r.trophies = stars, pct, gold, food, change
        r.replay = json.dumps(steps, separators=(",", ":"))
        r.finished_at = now()
        db.commit()
        return jsonify(trophies=change, mine=mine.trophies)
    finally:
        db.close()


@bp.get("/api/play/<slug>/raid/news")
def news(slug):
    """This player's trophies and shield, and the last raids on their kingdom, the ones
    their game hasn't taken the loss of yet marked new. {trophies, shield (seconds),
    defenses: [{id, name, stars, percent, gold, food, trophies (theirs: minus), at, new,
    buildings, replay}]}."""
    db = _db()
    try:
        user, pub, why = _game(db, slug)
        if why:
            return err(*why)
        mine = _base(db, pub, user)
        db.commit()
        raids = (db.query(Raid, User).join(User, User.id == Raid.attacker_id)
                 .filter(Raid.published_id == pub.id, Raid.defender_id == user.id, Raid.stars.isnot(None))
                 .order_by(Raid.finished_at.desc()).limit(10).all())
        return jsonify(trophies=mine.trophies, shield=_shield_left(mine), defenses=[
            {"id": r.id, "name": _board_name(u), "stars": r.stars, "percent": r.percent, "gold": r.gold, "food": r.food,
             "trophies": -r.trophies, "at": int(_aware(r.finished_at).timestamp()), "new": not r.seen,
             "buildings": json.loads(r.buildings), "replay": json.loads(r.replay)} for r, u in raids])
    finally:
        db.close()


@bp.post("/api/play/<slug>/raid/seen")
def seen(slug):
    """{ids}: raids on this player's kingdom whose loss their game has now taken off."""
    db = _db()
    try:
        user, pub, why = _game(db, slug)
        if why:
            return err(*why)
        ids = (request.get_json(silent=True) or {}).get("ids")
        if not isinstance(ids, list) or not all(isinstance(i, int) and not isinstance(i, bool) for i in ids):
            return err("Which raids?", 400)
        db.query(Raid).filter(Raid.published_id == pub.id, Raid.defender_id == user.id, Raid.id.in_(ids or [-1])) \
            .update({Raid.seen: 1}, synchronize_session=False)
        db.commit()
        return jsonify(ok=True)
    finally:
        db.close()


def delete_for(db, pub_id):
    """Unpublishing: its kingdoms and raids go too."""
    db.query(Raid).filter_by(published_id=pub_id).delete()
    db.query(RaidBase).filter_by(published_id=pub_id).delete()


def merge(db, src, dst):
    """A new version put in place of the old: kingdoms and raids move to it (a player with
    a kingdom in both keeps the newer one)."""
    for b in db.query(RaidBase).filter_by(published_id=src.id).all():
        d = db.query(RaidBase).filter_by(published_id=dst.id, user_id=b.user_id).first()
        if d is None:
            b.published_id = dst.id
        else:
            if _aware(b.updated_at) > _aware(d.updated_at):
                d.buildings, d.gold, d.food, d.power, d.updated_at = b.buildings, b.gold, b.food, b.power, b.updated_at
            d.trophies = max(d.trophies, b.trophies)
            db.delete(b)
    db.query(Raid).filter_by(published_id=src.id).update({Raid.published_id: dst.id}, synchronize_session=False)


def init(app):
    app.register_blueprint(bp)
