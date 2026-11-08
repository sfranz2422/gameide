"""
Multiplayer rooms for published games: a few players in one game at once,
each seeing the others (net_* in runtime.py, player/NetLobby.tsx).

A room belongs to one published game and is joined by a short code. ANYONE
SIGNED IN, with any email, may make one and join any one by its code: the
teacher uses GameIDE across all their classes, not only GameIDE ones, so
rooms aren't tied to classes (their decision, 2026-11-08; until then a room
was for one GameIDE class). Signing in is still needed: the room shows names,
and they come from accounts. The names are `publishing._board_name` (students
by first name, teachers by last), never an email. Twenty at most.

How it talks: no websockets. Each player's page POSTs /api/net/sync a few
times a second — "here is my state (and any messages), give me everyone
else's" — and the server keeps the latest of each in Postgres. Two gunicorn
workers share no memory, so the database is the only place a room can live.
A sync is authenticated by the player's token AND the signed-in session, so a
token copied into another browser does nothing.

Away: a player answering a Python check, or whose tab is hidden, or whose
game asked (net_away), is away. Away players aren't sent to anyone, and get no
messages while away (the teacher's rule: during a question nothing can affect
them) — their `after` moves on past what they missed.

As with high scores, a game runs in the student's own browser, so what it
sends can be made up with the browser's tools. Nothing here touches a grade.
"""
import itertools
import json
import random
import secrets
import time

from flask import Blueprint, jsonify, request, session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

import publishing
from gamestore import NetMessage, NetPlayer, NetRoom
from publishing import _board_name, _need_user, _pub_or_404, _viewable, err

bp = Blueprint("multiplayer", __name__)

MAX_PLAYERS = 20
#: A player not heard from for this long isn't in the room any more.
PRESENT_SECONDS = 10
#: A room nobody has synced with for this long is deleted.
ROOM_IDLE_SECONDS = 30 * 60
#: Messages are delivered within a sync or two; older ones are deleted.
MESSAGE_SECONDS = 20
MAX_STATE = 2000            # characters of JSON
MAX_MESSAGE = 500
MAX_MESSAGES_PER_SYNC = 10
#: How often a page syncs, in ms. The server says, so it can be slowed down
#: for everyone without a new build if Render's CPU can't keep up.
SYNC_MS = 200
#: Codes have no vowels, so no code spells a word. 20^4 = 160,000 of them.
CODE_LETTERS = "BCDFGHJKLMNPQRSTVWXZ"
CODE_LENGTH = 4


def _code():
    return "".join(random.choice(CODE_LETTERS) for _ in range(CODE_LENGTH))


def _clean_code(text):
    return "".join(ch for ch in str(text or "").upper() if ch.isalpha())[:8]


def _tidy(db, published_id):
    """Deletes this game's idle rooms, and old messages everywhere. Run on join and create, not every sync."""
    t = time.time()
    db.query(NetMessage).filter(NetMessage.sent_at < t - MESSAGE_SECONDS).delete(synchronize_session=False)
    rooms = db.query(NetRoom.id).filter(NetRoom.published_id == published_id, NetRoom.active_at < t - ROOM_IDLE_SECONDS).all()
    ids = [r.id for r in rooms]
    if ids:
        # Children first: Render's Postgres enforces the foreign keys.
        db.query(NetMessage).filter(NetMessage.room_id.in_(ids)).delete(synchronize_session=False)
        db.query(NetPlayer).filter(NetPlayer.room_id.in_(ids)).delete(synchronize_session=False)
        db.query(NetRoom).filter(NetRoom.id.in_(ids)).delete(synchronize_session=False)


def delete_rooms(db, published_id):
    """Every room of a game, for unpublishing it."""
    ids = [r.id for r in db.query(NetRoom.id).filter_by(published_id=published_id).all()]
    if ids:
        db.query(NetMessage).filter(NetMessage.room_id.in_(ids)).delete(synchronize_session=False)
        db.query(NetPlayer).filter(NetPlayer.room_id.in_(ids)).delete(synchronize_session=False)
        db.query(NetRoom).filter(NetRoom.id.in_(ids)).delete(synchronize_session=False)


def _playable(db, slug):
    """The signed-in user and the game, or a refusal: rooms are for people who may play it."""
    user = _need_user(db)
    pub = _pub_or_404(db, slug)
    why = _viewable(db, pub, user)
    if why:
        publishing.fail(*why)
    import pycheck
    why = pycheck.play_refusal(db, pub, user)
    if why:
        publishing.fail(*why)
    return user, pub


def _last_message(db, room_id):
    return db.query(func.max(NetMessage.id)).filter(NetMessage.room_id == room_id).scalar() or 0


def _enter(db, room, user):
    """Puts the user in the room (again, if they were in it), and answers as join and create do."""
    t = time.time()
    # One room per game at a time: being in two would show you twice.
    others = (db.query(NetPlayer).join(NetRoom, NetRoom.id == NetPlayer.room_id)
              .filter(NetPlayer.user_id == user.id, NetRoom.published_id == room.published_id, NetRoom.id != room.id).all())
    for p in others:
        p.seen_at = 0
    present = db.query(NetPlayer).filter(NetPlayer.room_id == room.id, NetPlayer.seen_at >= t - PRESENT_SECONDS).all()
    me = db.query(NetPlayer).filter_by(room_id=room.id, user_id=user.id).first()
    if me is None or me.seen_at < t - PRESENT_SECONDS:
        if len(present) >= MAX_PLAYERS:
            return err(f"That room is full: {MAX_PLAYERS} players is the most.", 409)
    taken = {p.number for p in present if me is None or p.id != me.id}
    if me is None:
        # The lowest number nobody here has: the number over a player's head.
        number = next(n for n in itertools.count(1) if n not in taken)
        me = NetPlayer(room_id=room.id, user_id=user.id, token=secrets.token_urlsafe(24), number=number, name=_board_name(user))
        db.add(me)
    elif me.number in taken:
        # Back after a while, and someone else has their number now.
        me.number = next(n for n in itertools.count(1) if n not in taken)
    me.token = secrets.token_urlsafe(24)    # a new page: the old page's token stops working
    me.name, me.seen_at, me.away = _board_name(user), t, 0
    room.active_at = t
    db.flush()
    after = _last_message(db, room.id)
    db.commit()
    return jsonify(code=room.code, token=me.token, number=me.number, name=me.name,
                   state=json.loads(me.state or "{}"), after=after, every=SYNC_MS)


@bp.post("/api/play/<slug>/net/create")
def create(slug):
    db = publishing._db()
    try:
        user, pub = _playable(db, slug)
        _tidy(db, pub.id)
        used = {r.code for r in db.query(NetRoom.code).filter_by(published_id=pub.id).all()}
        code = next((c for c in (_code() for _ in range(50)) if c not in used), None)
        if code is None:
            return err("Couldn't find a free room code. Try again.", 503)
        # class_id stays in the table (0: no class) from when rooms were per class.
        room = NetRoom(published_id=pub.id, class_id=0, code=code, created_by=user.id, active_at=time.time())
        db.add(room)
        try:
            db.flush()
        except IntegrityError:   # someone took that code this very moment
            db.rollback()
            return err("Couldn't find a free room code. Try again.", 503)
        return _enter(db, room, user)
    finally:
        db.close()


@bp.post("/api/play/<slug>/net/join")
def join(slug):
    db = publishing._db()
    try:
        user, pub = _playable(db, slug)
        code = _clean_code((request.get_json(silent=True) or {}).get("code"))
        _tidy(db, pub.id)
        room = db.query(NetRoom).filter_by(published_id=pub.id, code=code).first() if code else None
        if room is None:
            db.commit()
            return err(f"There's no room {code or ''} in this game. Check the code, and that it's this game's room?".replace("  ", " "), 404)
        return _enter(db, room, user)
    finally:
        db.close()


def _json_text(value, limit, what):
    try:
        text = json.dumps(value, separators=(",", ":"))
    except (TypeError, ValueError):
        return None, f"{what} must be plain data."
    if len(text) > limit:
        return None, f"{what} is too big: {limit} characters of JSON at most."
    return text, None


@bp.post("/api/net/sync")
def sync():
    """
    One player's few-times-a-second: their state and messages in; everyone
    else's state, and the messages since `after`, out. Kept to a handful of
    queries, because twenty players make about a hundred of these a second.
    """
    body = request.get_json(silent=True) or {}
    uid = session.get("uid")
    if not uid:
        return err("Sign in first.", 401)
    db = publishing._db()
    try:
        me = db.query(NetPlayer).filter_by(token=str(body.get("token") or "")).first()
        if me is None or me.user_id != uid:
            return err("You're not in this room any more. Join it again.", 410)
        t = time.time()
        if "state" in body:
            if not isinstance(body["state"], dict):
                return err("A player's state is a dict.", 400)
            text, why = _json_text(body["state"], MAX_STATE, "A player's state")
            if why:
                return err(why, 400)
            me.state = text
        away = bool(body.get("away"))
        me.away, me.seen_at = int(away), t
        msgs = body.get("msgs") or []
        if not isinstance(msgs, list) or len(msgs) > MAX_MESSAGES_PER_SYNC:
            return err(f"At most {MAX_MESSAGES_PER_SYNC} messages at a time.", 400)
        for m in msgs:
            text, why = _json_text(m, MAX_MESSAGE, "A message")
            if why:
                return err(why, 400)
            # An away player's game is held: anything it sends is from before.
            if not away:
                db.add(NetMessage(room_id=me.room_id, sender=me.number, data=text, sent_at=t))
        # The room is active while anyone's in it; once a second is enough to say so.
        db.query(NetRoom).filter(NetRoom.id == me.room_id, NetRoom.active_at < t - 1).update({"active_at": t}, synchronize_session=False)
        db.flush()
        rows = (db.query(NetPlayer.number, NetPlayer.name, NetPlayer.state, NetPlayer.away, NetPlayer.id)
                .filter(NetPlayer.room_id == me.room_id, NetPlayer.seen_at >= t - PRESENT_SECONDS).all())
        players = [{"number": r.number, "name": r.name, "state": json.loads(r.state or "{}")}
                   for r in rows if r.id != me.id and not r.away]
        try:
            after = int(body.get("after") or 0)
        except (TypeError, ValueError):
            after = 0
        new = (db.query(NetMessage.id, NetMessage.sender, NetMessage.data, NetMessage.sent_at)
               .filter(NetMessage.room_id == me.room_id, NetMessage.id > after).order_by(NetMessage.id).all())
        last = new[-1].id if new else after
        out = [] if away else [{"from": m.sender, "data": json.loads(m.data), "age": round(max(0.0, t - m.sent_at), 3)}
                               for m in new if m.sender != me.number]
        db.commit()
        return jsonify(players=players, msgs=out, after=last, here=len(rows), every=SYNC_MS)
    finally:
        db.close()


@bp.post("/api/net/leave")
def leave():
    """The page is closing: gone at once, rather than ten seconds later."""
    body = request.get_json(silent=True) or {}
    uid = session.get("uid")
    db = publishing._db()
    try:
        me = db.query(NetPlayer).filter_by(token=str(body.get("token") or "")).first()
        if me is not None and me.user_id == uid:
            # A new token too: a closing page's last sync can arrive after this,
            # and with the old token it would put them back in the room.
            me.seen_at, me.token = 0, secrets.token_urlsafe(24)
            db.commit()
        return jsonify(ok=True)
    finally:
        db.close()
