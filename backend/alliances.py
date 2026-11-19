"""
Alliances in a published game (2026-11-19, Highmoor's phase 6: the teacher's plan of
"alliances among classmates"): players at the same school band together, ask each other
for troops and send them, and talk in ready-made phrases. The game's side is the ally_
functions in runtime.py; the page's, player/raids.ts (one link carries raids and alliances).

**No typed words, ever** (a school's ask): an alliance's name is two numbers the game turns
into words from its own lists ("The Iron Wolves"), its banner a number, and a message a
number naming one of the game's phrases. So nothing a student writes reaches another, and
there's nothing to moderate. Names of players are first names (_board_name), never an email:
a new route handing out players needs a leak check in test_server.py.

The server keeps the alliance, its members, requests, gifts and messages, and checks that
you're in it, that a request is yours or your ally's, and that a gift fits what's asked. A
gift's troops come from the giver's own game (their browser): a changed game could give
troops it doesn't have. It touches no grade.
"""
from datetime import timedelta

from flask import Blueprint, jsonify, request
import publishing
from accounts import User, now
from gamestore import Alliance, AllianceGift, AllianceMember, AllianceMessage, AllianceRequest, RaidBase
from publishing import _board_name, _need_user, _pub_or_404, _viewable, err, school_domain

bp = Blueprint("alliances", __name__)

MOST_MEMBERS = 20
WORDS = 64                 # a name's word numbers, and a banner's, are below this
PHRASES = 64               # a message is a phrase number below this
MESSAGES_KEPT = 40
REQUEST_EVERY = timedelta(minutes=10)    # one request for troops at a time, a new one this often
REQUEST_LASTS = timedelta(hours=8)
GIVE_MOST = 5              # troops one player may give to one request


def _db():
    return publishing._db()


def _int(v, lo, hi):
    if isinstance(v, bool) or not isinstance(v, int):
        return None
    return v if lo <= v <= hi else None


def _game(db, slug):
    user = _need_user(db)
    pub = _pub_or_404(db, slug)
    why = _viewable(db, pub, user)
    return user, pub, why


def membership(db, pub, user):
    return db.query(AllianceMember).filter_by(published_id=pub.id, user_id=user.id).first()


def allies_of(db, pub_id, user_id):
    """The ids of everyone in the same alliance as a player (themselves too), or none."""
    m = db.query(AllianceMember).filter_by(published_id=pub_id, user_id=user_id).first()
    if m is None:
        return set()
    return {x.user_id for x in db.query(AllianceMember).filter_by(alliance_id=m.alliance_id).all()}


def _school(db, pub, domain):
    """The alliances of a game at one school: an alliance belongs to its founder's school."""
    rows = (db.query(Alliance, User).join(User, User.id == Alliance.founder_id)
            .filter(Alliance.published_id == pub.id, User.email.ilike("%@" + domain)).all())
    return [a for a, u in rows]


def _trophies(db, pub, user_ids):
    rows = db.query(RaidBase).filter(RaidBase.published_id == pub.id, RaidBase.user_id.in_(user_ids or [-1])).all()
    return {r.user_id: r for r in rows}


def _card(db, pub, a):
    members = db.query(AllianceMember).filter_by(alliance_id=a.id).all()
    bases = _trophies(db, pub, [m.user_id for m in members])
    return {"id": a.id, "words": [a.word1, a.word2], "banner": a.banner, "members": len(members),
            "trophies": sum(bases[m.user_id].trophies for m in members if m.user_id in bases)}


@bp.get("/api/play/<slug>/alliance")
def news(slug):
    """Your alliance (members, open requests for troops, the messages, gifts for you not yet
    taken) and your school's alliances, best first."""
    db = _db()
    try:
        user, pub, why = _game(db, slug)
        if why:
            return err(*why)
        domain = school_domain(user)
        mine = membership(db, pub, user)
        school = sorted((_card(db, pub, a) for a in _school(db, pub, domain)), key=lambda c: -c["trophies"]) if domain else []
        out = {"school": school, "alliance": None, "can": domain is not None}
        if mine is not None:
            a = db.get(Alliance, mine.alliance_id)
            members = (db.query(AllianceMember, User).join(User, User.id == AllianceMember.user_id)
                       .filter(AllianceMember.alliance_id == a.id).order_by(AllianceMember.joined_at).all())
            bases = _trophies(db, pub, [m.user_id for m, u in members])
            names = {u.id: _board_name(u) for m, u in members}
            t = now()
            reqs = (db.query(AllianceRequest).filter(AllianceRequest.alliance_id == a.id, AllianceRequest.created_at > t - REQUEST_LASTS)
                    .order_by(AllianceRequest.created_at.desc()).all())
            given = {}
            for g in db.query(AllianceGift).filter(AllianceGift.request_id.in_([r.id for r in reqs] or [-1])).all():
                given.setdefault(g.request_id, []).append(g)
            msgs = (db.query(AllianceMessage).filter_by(alliance_id=a.id).order_by(AllianceMessage.id.desc()).limit(MESSAGES_KEPT).all())
            gifts = (db.query(AllianceGift).filter_by(to_id=user.id, taken=0)
                     .join(AllianceRequest, AllianceRequest.id == AllianceGift.request_id)
                     .filter(AllianceRequest.alliance_id == a.id).all())
            out["alliance"] = {
                **_card(db, pub, a), "leader": names.get(a.leader_id, ""), "you_lead": a.leader_id == user.id,
                "members": [{"name": names[u.id], "you": u.id == user.id, "trophies": bases[u.id].trophies if u.id in bases else 0,
                             "power": bases[u.id].power if u.id in bases else 0, "leader": u.id == a.leader_id} for m, u in members],
                "requests": [{"id": r.id, "name": names.get(r.user_id, "Someone who left"), "yours": r.user_id == user.id,
                              "room": r.room, "filled": sum(g.space for g in given.get(r.id, [])),
                              "gave": sum(g.count for g in given.get(r.id, []) if g.from_id == user.id)} for r in reqs],
                "messages": [{"name": names.get(m.user_id, "Someone who left"), "phrase": m.phrase, "you": m.user_id == user.id,
                              "at": int(publishing_aware(m.created_at).timestamp())} for m in reversed(msgs)],
                "gifts": [{"id": g.id, "from": names.get(g.from_id, "An ally"), "kind": g.kind, "count": g.count} for g in gifts],
            }
        return jsonify(out)
    finally:
        db.close()


def publishing_aware(t):
    from raids import _aware
    return _aware(t)


@bp.post("/api/play/<slug>/alliance/create")
def create(slug):
    """{words: [a, b], banner}: a new alliance, its founder its leader (not in one already)."""
    db = _db()
    try:
        user, pub, why = _game(db, slug)
        if why:
            return err(*why)
        if school_domain(user) is None:
            return err("Alliances are with others at your school: sign in with your school account.", 403)
        if membership(db, pub, user):
            return err("You're in an alliance already: leave it first.", 409)
        body = request.get_json(silent=True) or {}
        words = body.get("words")
        w1, w2 = (_int(words[0], 0, WORDS - 1), _int(words[1], 0, WORDS - 1)) if isinstance(words, list) and len(words) == 2 else (None, None)
        banner = _int(body.get("banner"), 0, WORDS - 1)
        if None in (w1, w2, banner):
            return err("An alliance is two words and a banner, by number.", 400)
        a = Alliance(published_id=pub.id, word1=w1, word2=w2, banner=banner, founder_id=user.id, leader_id=user.id)
        db.add(a)
        db.flush()
        db.add(AllianceMember(alliance_id=a.id, published_id=pub.id, user_id=user.id))
        db.commit()
        return jsonify(id=a.id)
    finally:
        db.close()


@bp.post("/api/play/<slug>/alliance/<int:aid>/join")
def join(slug, aid):
    db = _db()
    try:
        user, pub, why = _game(db, slug)
        if why:
            return err(*why)
        domain = school_domain(user)
        a = db.get(Alliance, aid)
        if a is None or a.published_id != pub.id or domain is None or a not in _school(db, pub, domain):
            return err("There's no alliance like that at your school.", 404)
        if membership(db, pub, user):
            return err("You're in an alliance already: leave it first.", 409)
        if db.query(AllianceMember).filter_by(alliance_id=a.id).count() >= MOST_MEMBERS:
            return err(f"That alliance is full ({MOST_MEMBERS}).", 409)
        db.add(AllianceMember(alliance_id=a.id, published_id=pub.id, user_id=user.id))
        db.commit()
        return jsonify(ok=True)
    finally:
        db.close()


@bp.post("/api/play/<slug>/alliance/leave")
def leave(slug):
    """Out of your alliance: its leader passes to whoever's been in it longest; an alliance
    nobody's in goes."""
    db = _db()
    try:
        user, pub, why = _game(db, slug)
        if why:
            return err(*why)
        m = membership(db, pub, user)
        if m is None:
            return err("You're not in an alliance.", 404)
        a = db.get(Alliance, m.alliance_id)
        db.delete(m)
        db.flush()
        rest = db.query(AllianceMember).filter_by(alliance_id=a.id).order_by(AllianceMember.joined_at).all()
        if not rest:
            delete_alliance(db, a)
        elif a.leader_id == user.id:
            a.leader_id = rest[0].user_id
        db.commit()
        return jsonify(ok=True)
    finally:
        db.close()


def delete_alliance(db, a):
    reqs = [r.id for r in db.query(AllianceRequest).filter_by(alliance_id=a.id).all()]
    db.query(AllianceGift).filter(AllianceGift.request_id.in_(reqs or [-1])).delete(synchronize_session=False)
    db.query(AllianceRequest).filter_by(alliance_id=a.id).delete()
    db.query(AllianceMessage).filter_by(alliance_id=a.id).delete()
    db.query(AllianceMember).filter_by(alliance_id=a.id).delete()
    db.delete(a)


@bp.post("/api/play/<slug>/alliance/ask")
def ask(slug):
    """{room}: asks your alliance for troops, as much room as your hall has free (one
    request at a time, a new one every REQUEST_EVERY)."""
    db = _db()
    try:
        user, pub, why = _game(db, slug)
        if why:
            return err(*why)
        m = membership(db, pub, user)
        if m is None:
            return err("Join an alliance first.", 404)
        room = _int((request.get_json(silent=True) or {}).get("room"), 1, 200)
        if room is None:
            return err("How much room?", 400)
        last = (db.query(AllianceRequest).filter_by(alliance_id=m.alliance_id, user_id=user.id)
                .order_by(AllianceRequest.created_at.desc()).first())
        if last is not None and now() - publishing_aware(last.created_at) < REQUEST_EVERY:
            return err("You asked a moment ago: wait a little before asking again.", 429)
        db.add(AllianceRequest(alliance_id=m.alliance_id, user_id=user.id, room=room))
        db.commit()
        return jsonify(ok=True)
    finally:
        db.close()


@bp.post("/api/play/<slug>/alliance/give")
def give(slug):
    """{request, kind, count, space}: troops for an ally's request, if they fit what's still
    asked for (and no more than GIVE_MOST of yours to one request). Never to yourself."""
    db = _db()
    try:
        user, pub, why = _game(db, slug)
        if why:
            return err(*why)
        m = membership(db, pub, user)
        body = request.get_json(silent=True) or {}
        rid, count, space = _int(body.get("request"), 0, 10**12), _int(body.get("count"), 1, GIVE_MOST), _int(body.get("space"), 1, 50)
        kind = body.get("kind")
        import raids
        if m is None or None in (rid, count, space) or not isinstance(kind, str) or not raids.KIND.match(kind):
            return err("A gift is a request, a kind of troop, how many and how much room each.", 400)
        r = db.get(AllianceRequest, rid)
        if r is None or r.alliance_id != m.alliance_id or now() - publishing_aware(r.created_at) > REQUEST_LASTS:
            return err("That request isn't your alliance's (or it's over).", 404)
        if r.user_id == user.id:
            return err("That's your own request.", 400)
        gifts = db.query(AllianceGift).filter_by(request_id=r.id).all()
        if sum(g.count for g in gifts if g.from_id == user.id) + count > GIVE_MOST:
            return err(f"You've given {GIVE_MOST} to that request already.", 409)
        if sum(g.space for g in gifts) + count * space > r.room:
            return err("Those won't fit: the request is nearly filled.", 409)
        db.add(AllianceGift(request_id=r.id, from_id=user.id, to_id=r.user_id, kind=kind, count=count, space=count * space))
        db.commit()
        return jsonify(ok=True)
    finally:
        db.close()


@bp.post("/api/play/<slug>/alliance/taken")
def taken(slug):
    """{ids}: gifts to you that your game has put in your army."""
    db = _db()
    try:
        user, pub, why = _game(db, slug)
        if why:
            return err(*why)
        ids = (request.get_json(silent=True) or {}).get("ids")
        if not isinstance(ids, list) or not all(isinstance(i, int) and not isinstance(i, bool) for i in ids):
            return err("Which gifts?", 400)
        db.query(AllianceGift).filter(AllianceGift.to_id == user.id, AllianceGift.id.in_(ids or [-1])) \
            .update({AllianceGift.taken: 1}, synchronize_session=False)
        db.commit()
        return jsonify(ok=True)
    finally:
        db.close()


@bp.post("/api/play/<slug>/alliance/say")
def say(slug):
    """{phrase}: a message to your alliance: one of the game's phrases, by number."""
    db = _db()
    try:
        user, pub, why = _game(db, slug)
        if why:
            return err(*why)
        m = membership(db, pub, user)
        phrase = _int((request.get_json(silent=True) or {}).get("phrase"), 0, PHRASES - 1)
        if m is None or phrase is None:
            return err("A message is a phrase's number, to your own alliance.", 400)
        db.add(AllianceMessage(alliance_id=m.alliance_id, user_id=user.id, phrase=phrase))
        db.flush()
        old = (db.query(AllianceMessage.id).filter_by(alliance_id=m.alliance_id)
               .order_by(AllianceMessage.id.desc()).offset(MESSAGES_KEPT).all())
        if old:
            db.query(AllianceMessage).filter(AllianceMessage.id.in_([o[0] for o in old])).delete(synchronize_session=False)
        db.commit()
        return jsonify(ok=True)
    finally:
        db.close()


def delete_for(db, pub_id):
    """Unpublishing: its alliances go too."""
    for a in db.query(Alliance).filter_by(published_id=pub_id).all():
        delete_alliance(db, a)


def merge(db, src, dst):
    """A new version put in place of the old: its alliances move to it."""
    db.query(Alliance).filter_by(published_id=src.id).update({Alliance.published_id: dst.id}, synchronize_session=False)
    for m in db.query(AllianceMember).filter_by(published_id=src.id).all():
        if db.query(AllianceMember).filter_by(published_id=dst.id, user_id=m.user_id).first():
            db.delete(m)
        else:
            m.published_id = dst.id


def init(app):
    app.register_blueprint(bp)
