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

How it talks, two ways. LIVE (one server process, GAMEIDE_ONE_PROCESS=1, the
Start Command on Render): each page holds a WebSocket (/api/net/ws), and rooms
are kept in this process's memory (`Live`): a player's update reaches the others
within a tick, with no database work per update; the database gets each
player's state and "last seen" every few seconds, which is what joining, the
twenty-player cap and coming back after a reload read. A page whose network
won't open a WebSocket polls /api/net/sync instead, served from the same
memory. Otherwise (several processes share no memory) the old way, below:

Each player's page POSTs /api/net/sync a few
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
import os
import random
import threading
import secrets
import time

from flask import Blueprint, jsonify, request, session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

import publishing
from gamestore import NetMessage, NetPlayer, NetRoom, Published
from publishing import _board_name, _need_user, _pub_or_404, _viewable, err

bp = Blueprint("multiplayer", __name__)

MAX_PLAYERS = 20
#: The most a game may ask for with settings.netPlayers (Undertow asks for 25:
#: the teacher's choice, 2026-11-09, for that game only). Measured: 20 players
#: at 20 updates a second is 3-5% of a core, so 25 is well within it.
BIGGEST_ROOM = 25


def room_size(db, room):
    """How many players a room of this game holds: the published game's settings.netPlayers
    (read from the snapshot, never the page), 2 to BIGGEST_ROOM; MAX_PLAYERS if it doesn't say."""
    pub = db.get(Published, room.published_id)
    try:
        asked = (json.loads(pub.data).get("settings") or {}).get("netPlayers") if pub else None
    except ValueError:
        asked = None
    if isinstance(asked, bool) or not isinstance(asked, int):
        return MAX_PLAYERS
    return max(2, min(BIGGEST_ROOM, asked))
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
#: One process (GAMEIDE_ONE_PROCESS=1): rooms live in memory, and pages use
#: WebSockets. With several processes they couldn't: each would have its own.
LIVE = os.environ.get("GAMEIDE_ONE_PROCESS") == "1"
#: How often a WebSocket hears of changes, at most (s), and how often a live
#: player's state and "last seen" go to the database (s).
LIVE_TICK = 0.05
WRITE_EVERY = 3.0
#: Messages kept in a live room, for pages polling with `after`.
LIVE_MESSAGES = 200

#: Codes have no vowels, so no code spells a word. 20^4 = 160,000 of them.
CODE_LETTERS = "BCDFGHJKLMNPQRSTVWXZ"
CODE_LENGTH = 4


def _code():
    return "".join(random.choice(CODE_LETTERS) for _ in range(CODE_LENGTH))


def _clean_code(text):
    return "".join(ch for ch in str(text or "").upper() if ch.isalpha())[:8]


# ---------------------------------------------------------------- live rooms (one process)

class LivePlayer:
    def __init__(self, row):
        self.id, self.room_id, self.user_id = row.id, row.room_id, row.user_id
        self.number, self.name, self.token = row.number, row.name, row.token
        self.state = json.loads(row.state or "{}")
        self.state_text = row.state or "{}"
        self.entry = self._entry()
        self.away = bool(row.away)
        self.seen = time.time()
        self.written = 0.0
        self.sockets = 0          # WebSockets open: while there's one, they're here

    def _entry(self):
        """How the others are sent this player, made once per change rather than once per page per tick."""
        return '{"number":%d,"name":%s,"state":%s}' % (self.number, json.dumps(self.name), self.state_text)


class LiveRoom:
    def __init__(self, room_id):
        self.id = room_id
        self.players = {}         # number -> LivePlayer
        self.msgs = []            # (id, sender, data, sent_at), oldest first
        self.next_id = 1
        self.version = 0          # goes up on any change: a WebSocket sends when it has
        self.active = time.time()


class Live:
    """The rooms in memory. One lock: every change is a few dict operations."""
    lock = threading.Lock()
    rooms = {}                    # room id -> LiveRoom
    tokens = {}                   # token -> LivePlayer

    @classmethod
    def reset(cls):
        with cls.lock:
            cls.rooms.clear()
            cls.tokens.clear()

    @classmethod
    def room(cls, room_id):
        r = cls.rooms.get(room_id)
        if r is None:
            r = cls.rooms[room_id] = LiveRoom(room_id)
        return r

    @classmethod
    def enter(cls, row):
        """A player joined (or came back): their row, with its new token."""
        with cls.lock:
            room = cls.room(row.room_id)
            old = next((p for p in room.players.values() if p.user_id == row.user_id), None)
            if old is not None:
                cls.tokens.pop(old.token, None)
                room.players.pop(old.number, None)
            # Someone gone may still hold the number this player was given.
            gone = room.players.get(row.number)
            if gone is not None:
                cls.tokens.pop(gone.token, None)
            p = LivePlayer(row)
            room.players[p.number] = p
            cls.tokens[p.token] = p
            room.version += 1
            room.active = time.time()
            return room.next_id - 1

    @classmethod
    def player(cls, token, uid):
        """The live player with this token and signed-in user, or None."""
        with cls.lock:
            p = cls.tokens.get(token)
            return p if p is not None and p.user_id == uid else None

    @classmethod
    def present(cls, room, t):
        return [p for p in room.players.values() if p.sockets > 0 or p.seen >= t - PRESENT_SECONDS]

    @classmethod
    def update(cls, p, body):
        """A page's state, away and messages: as /api/net/sync checks them. An error message, or None."""
        state_text = None
        if "state" in body:
            if not isinstance(body["state"], dict):
                return "A player's state is a dict."
            state_text, why = _json_text(body["state"], MAX_STATE, "A player's state")
            if why:
                return why
        msgs = body.get("msgs") or []
        if not isinstance(msgs, list) or len(msgs) > MAX_MESSAGES_PER_SYNC:
            return f"At most {MAX_MESSAGES_PER_SYNC} messages at a time."
        texts, why = _messages(body)
        if why:
            return why
        t = time.time()
        with cls.lock:
            room = cls.rooms.get(p.room_id)
            if room is None:
                return None
            if state_text is not None and state_text != p.state_text:
                p.state, p.state_text = json.loads(state_text), state_text
                p.entry = p._entry()
                room.version += 1
            if "away" in body:
                away = bool(body.get("away"))
                if away != p.away:
                    p.away = away
                    room.version += 1
            p.seen = t
            room.active = t
            # An away player's game is held: anything it sends is from before.
            if not p.away:
                for to, data in texts:
                    room.msgs.append((room.next_id, p.number, data, t, to))
                    room.next_id += 1
                    room.version += 1
                del room.msgs[:-LIVE_MESSAGES]
        return None

    @classmethod
    def frame(cls, p, after):
        """What a page is sent: everyone else here and not away, messages since `after`, how many here."""
        t = time.time()
        with cls.lock:
            room = cls.rooms.get(p.room_id)
            if room is None:
                return {"players": [], "msgs": [], "after": after, "here": 0, "every": SYNC_MS}
            here = cls.present(room, t)
            players = [{"number": o.number, "name": o.name, "state": o.state} for o in here if o is not p and not o.away]
            new = [m for m in room.msgs if m[0] > after]
            last = room.msgs[-1][0] if room.msgs else after
            last = max(last, after)
            msgs = [] if p.away else [_delivered(s, d, t - at, to) for i, s, d, at, to in new if _for(p.number, s, to)]
            return {"players": players, "msgs": msgs, "after": last, "here": len(here), "every": SYNC_MS, "host": _host(here), "v": room.version}

    @classmethod
    def frame_text(cls, p, after):
        """frame(), as the JSON a WebSocket sends: the players' entries are already made. (text, version, after)"""
        t = time.time()
        with cls.lock:
            room = cls.rooms.get(p.room_id)
            if room is None:
                return None, None, after
            here = cls.present(room, t)
            players = ",".join(o.entry for o in here if o is not p and not o.away)
            last = max(room.msgs[-1][0] if room.msgs else after, after)
            msgs = [] if p.away else [_delivered(s, d, t - at, to) for i, s, d, at, to in room.msgs if i > after and _for(p.number, s, to)]
            text = '{"players":[%s],"msgs":%s,"after":%d,"here":%d,"every":%d,"host":%s}' % (
                players, json.dumps(msgs, separators=(",", ":")), last, len(here), SYNC_MS, json.dumps(_host(here)))
            return text, room.version, last

    @classmethod
    def leave(cls, p):
        with cls.lock:
            room = cls.rooms.get(p.room_id)
            cls.tokens.pop(p.token, None)
            if room is not None and room.players.get(p.number) is p:
                room.players.pop(p.number)
                room.version += 1

    @classmethod
    def forget(cls, room_ids):
        with cls.lock:
            for i in room_ids:
                room = cls.rooms.pop(i, None)
                if room is not None:
                    for p in room.players.values():
                        cls.tokens.pop(p.token, None)

    @classmethod
    def write_back(cls, p, force=False):
        """Now and then, a live player's state and "last seen" to the database, for joins and reloads to read."""
        t = time.time()
        if not force and t - p.written < WRITE_EVERY:
            return
        p.written = t
        db = publishing._db()
        try:
            row = db.get(NetPlayer, p.id)
            if row is not None and row.token == p.token:
                row.state, row.away = p.state_text, int(p.away)
                # An open WebSocket is being here, whether or not it said anything lately.
                row.seen_at = t if p.sockets else p.seen
                db.query(NetRoom).filter(NetRoom.id == p.room_id).update({"active_at": t}, synchronize_session=False)
                db.commit()
        finally:
            db.close()


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
        Live.forget(ids)


def delete_rooms(db, published_id):
    """Every room of a game, for unpublishing it."""
    ids = [r.id for r in db.query(NetRoom.id).filter_by(published_id=published_id).all()]
    if ids:
        db.query(NetMessage).filter(NetMessage.room_id.in_(ids)).delete(synchronize_session=False)
        db.query(NetPlayer).filter(NetPlayer.room_id.in_(ids)).delete(synchronize_session=False)
        db.query(NetRoom).filter(NetRoom.id.in_(ids)).delete(synchronize_session=False)
        Live.forget(ids)


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
        most = room_size(db, room)
        if len(present) >= most:
            return err(f"That room is full: {most} players is the most.", 409)
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
    if LIVE:
        after = Live.enter(me)
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


def _messages(body):
    """
    A page's messages, checked: "msgs" for everyone else (net_shout) and "tells",
    [number, message] for one player only (net_tell: a secret role, say). As
    [(to, data)], to None for everyone; or an error.
    """
    msgs, tells = body.get("msgs") or [], body.get("tells") or []
    if not isinstance(msgs, list) or not isinstance(tells, list) or len(msgs) + len(tells) > MAX_MESSAGES_PER_SYNC:
        return None, f"At most {MAX_MESSAGES_PER_SYNC} messages at a time."
    out = []
    for to, m in [(None, m) for m in msgs] + [(t[0], t[1]) if isinstance(t, list) and len(t) == 2 else (False, None) for t in tells]:
        if to is False or (to is not None and (isinstance(to, bool) or not isinstance(to, int))):
            return None, "A message to one player is [their number, the message]."
        text, why = _json_text(m, MAX_MESSAGE, "A message")
        if why:
            return None, why
        out.append((to, json.loads(text)))
    return out, None


def _for(number, sender, to):
    """Does this message go to player `number`? Not their own, and only them if it was told to one."""
    return sender != number and (to is None or to == number)


def _delivered(sender, data, age, to):
    m = {"from": sender, "data": data, "age": round(max(0.0, age), 3)}
    if to is not None:
        m["private"] = True
    return m


def _host(players):
    """
    The game in charge (net_host): the lowest number here and not away, so the
    room's maker while they're in it; if they leave, or are answering a question,
    the next. None with nobody.
    """
    numbers = [p.number for p in players if not p.away]
    return min(numbers) if numbers else None


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
    if LIVE:
        p = _live_player(str(body.get("token") or ""), uid)
        if p is None:
            return err("You're not in this room any more. Join it again.", 410)
        why = Live.update(p, {**body, "away": bool(body.get("away"))})
        if why:
            return err(why, 400)
        try:
            after = int(body.get("after") or 0)
        except (TypeError, ValueError):
            after = 0
        frame = Live.frame(p, after)
        frame.pop("v", None)
        Live.write_back(p)
        return jsonify(frame)
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
        texts, why = _messages(body)
        if why:
            return err(why, 400)
        for to, data in texts:
            # An away player's game is held: anything it sends is from before.
            if not away:
                db.add(NetMessage(room_id=me.room_id, sender=me.number, to_number=to, data=json.dumps(data, separators=(",", ":")), sent_at=t))
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
        new = (db.query(NetMessage.id, NetMessage.sender, NetMessage.data, NetMessage.sent_at, NetMessage.to_number)
               .filter(NetMessage.room_id == me.room_id, NetMessage.id > after).order_by(NetMessage.id).all())
        last = new[-1].id if new else after
        out = [] if away else [_delivered(m.sender, json.loads(m.data), t - m.sent_at, m.to_number)
                               for m in new if _for(me.number, m.sender, m.to_number)]
        db.commit()
        return jsonify(players=players, msgs=out, after=last, here=len(rows), every=SYNC_MS, host=_host(rows))
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
        if LIVE and me is not None and me.user_id == uid:
            p = Live.player(me.token, uid)
            if p is not None:
                Live.leave(p)
        if me is not None and me.user_id == uid:
            # A new token too: a closing page's last sync can arrive after this,
            # and with the old token it would put them back in the room.
            me.seen_at, me.token = 0, secrets.token_urlsafe(24)
            db.commit()
        return jsonify(ok=True)
    finally:
        db.close()


def _live_player(token, uid):
    """The live player for a token. After a restart memory is empty: the database still knows them."""
    p = Live.player(token, uid)
    if p is not None or not token:
        return p
    db = publishing._db()
    try:
        row = db.query(NetPlayer).filter_by(token=token).first()
        if row is None or row.user_id != uid:
            return None
        Live.enter(row)
        return Live.player(token, uid)
    finally:
        db.close()


def socket(ws):
    """
    A page's WebSocket (LIVE only): it sends {"token"} first, then its updates
    ({"state", "msgs", "away"}) and pings; it's sent everyone else, as
    /api/net/sync answers, whenever anything in the room has changed, at most
    every LIVE_TICK. Several processes couldn't share rooms in memory: then it
    says {"fallback": true} and the page polls.
    """
    if not LIVE:
        ws.send(json.dumps({"fallback": True}))
        return
    uid = session.get("uid")
    try:
        hello = json.loads(ws.receive(timeout=10) or "{}")
    except (ValueError, TypeError):
        hello = {}
    p = _live_player(str(hello.get("token") or ""), uid) if uid else None
    if p is None:
        ws.send(json.dumps({"error": "You're not in this room any more. Join it again.", "status": 410}))
        return
    with Live.lock:
        p.sockets += 1
        p.seen = time.time()
    after, sent, sent_at = int(hello.get("after") or 0), -1, 0.0
    try:
        while True:
            data = ws.receive(timeout=LIVE_TICK)
            if data:
                try:
                    body = json.loads(data)
                except ValueError:
                    body = {}
                if "ping" in body:
                    ws.send(json.dumps({"pong": body["ping"]}))
                why = Live.update(p, body) if any(k in body for k in ("state", "msgs", "away")) else None
                if why:
                    ws.send(json.dumps({"error": why, "status": 400}))
            if Live.player(p.token, uid) is not p:
                ws.send(json.dumps({"error": "You're not in this room any more. Join it again.", "status": 410}))
                return
            room = Live.rooms.get(p.room_id)
            # What's changed, but no more than once a LIVE_TICK: a page's own updates
            # wake this loop early, and sending on each was half again as many frames.
            if room is not None and room.version != sent and time.time() - sent_at >= LIVE_TICK:
                text, version, after = Live.frame_text(p, after)
                if text is not None:
                    sent, sent_at = version, time.time()
                    ws.send(text)
            Live.write_back(p)
    finally:
        with Live.lock:
            p.sockets -= 1
            p.seen = time.time()
        Live.write_back(p, force=True)


def init(app):
    """The WebSocket route (flask-sock), and the blueprint."""
    from flask_sock import Sock
    Sock(app).route("/api/net/ws")(socket)
    app.register_blueprint(bp)
