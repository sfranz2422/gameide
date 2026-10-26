"""
XP (Phase 10b): points for doing the work, the levels and badges they add
up to, tokens the teacher trades for real things by hand, leaderboards, an
avatar to put on them, the token shop, and the teacher's rewards, penalties
and random events.

PyIDE's, joined rather than copied. A student's XP is ONE NUMBER across
PyIDE, WebIDE, FlaskIDE and GameIDE: the rules are `xp.py`, byte-identical
in all four repos (change it in PyIDE first), and the rows are the shared
tables — `xp_awards`, `shop_items`, `shop_requests`, `student_photos`,
`class_events`. XP earned here counts on a PyIDE leaderboard, and the other
way round; a teacher's token shop is the same shelf in every editor.

What pays in GameIDE (xp.py says why each is safe to pay):

  * a game that ran without an error: RUN_XP, at most once per
    RUN_EVERY_SECONDS of time the student was working (session "busy",
    counted in app.py's _sign_out_idle_student), and only when the code
    changed since the last run that paid. The server can't see a game run,
    so the page claims it (`xp_run`); the limits make a faked claim worth
    exactly what a real one is.
  * full marks on an assignment with a quest reward (Assignment.xp_bonus):
    paid once, when the score reaches its points (`full_marks_xp`).
  * XP the teacher gives or takes, with a reason; random events.

Questions and tests in the notes (Phase 11) will pay as PyIDE's do.

Only students earn: a teacher trying their own game is recorded nowhere.
Nothing here touches a grade.
"""
import random
import re
import time
from datetime import timedelta, timezone

from flask import Blueprint, Response, abort, jsonify, make_response, request, session
from sqlalchemy import func

import accounts
import gamestore
import grades
import xp
from accounts import now

bp = Blueprint("rewards", __name__)

APP_NAME = "gameide"

_db = None
_current_user = None


def init(app, session_factory, current_user):
    global _db, _current_user
    _db, _current_user = session_factory, current_user
    app.register_blueprint(bp)


def err(message, status):
    return jsonify(error=message), status


def fail(message, status):
    abort(make_response(jsonify(error=message), status))


def _iso(t):
    if t is None:
        return None
    return t.isoformat() + ("Z" if t.tzinfo is None else "")


def _clean(value, limit):
    return re.sub(r"\s+", " ", str(value or "")).strip()[:limit]


def _need_user(db):
    user = _current_user(db)
    if user is None:
        fail("Sign in first.", 401)
    return user


def _is_teacher(user):
    return bool(user) and accounts.is_teacher(user.email)


def earns_xp(user):
    return user is not None and not _is_teacher(user)


def _courses(db):
    return db.query(accounts.Course).filter(accounts.Course.app == APP_NAME)


def my_classes(db, user):
    """GameIDE's classes a student's email is on the roster of (a teacher's own, for a teacher)."""
    if _is_teacher(user):
        return _courses(db).filter_by(teacher_id=user.id).order_by(accounts.Course.name, accounts.Course.id).all()
    return (_courses(db).join(accounts.Enrollment, accounts.Enrollment.class_id == accounts.Course.id)
            .filter(func.lower(accounts.Enrollment.email) == user.email.lower())
            .order_by(accounts.Course.name, accounts.Course.id).all())


def _own_class(db, user, class_id):
    course = _courses(db).filter(accounts.Course.id == class_id).first()
    if course is None or course.teacher_id != user.id:
        fail("That isn't one of your classes.", 403)
    return course


def class_students(db, course):
    """[(Enrollment, User or None)] for a class's roster, by name. None is a
    student who has never signed in, who has no XP and nowhere to keep it."""
    roster = (db.query(accounts.Enrollment).filter_by(class_id=course.id)
              .order_by(accounts.Enrollment.name, accounts.Enrollment.email).all())
    users = {}
    emails = [e.email.lower() for e in roster]
    if emails:
        for u in db.query(accounts.User).filter(func.lower(accounts.User.email).in_(emails)):
            users[u.email.lower()] = u
    return [(e, users.get(e.email.lower())) for e in roster]


def _class_student(db, course, raw_id):
    """The User for a student id a teacher's page sent, if they're on this
    class's roster — checked, not trusted, or any teacher could give XP to anyone."""
    try:
        sid = int(raw_id)
    except (TypeError, ValueError):
        return None
    for _, u in class_students(db, course):
        if u is not None and u.id == sid:
            return u
    return None


# ---------------------------------------------------------------- leaderboards

def board(db, courses, me=None):
    """The signed-in students of a class (or several), ranked by their whole
    XP — every class, every editor — first name and last initial only, never
    an email. Those who hid themselves are left off. Equal XP, equal place."""
    if not isinstance(courses, (list, tuple)):
        courses = [courses]
    people = {}
    for course in courses:
        for _, u in class_students(db, course):
            if u is not None and not u.board_hidden:
                people[u.id] = u
    people = list(people.values())
    have = xp.totals(db, [u.id for u in people])
    people.sort(key=lambda u: (-have.get(u.id, 0), xp.board_name(u).lower()))
    out, place, last = [], 0, None
    for i, u in enumerate(people):
        total = have.get(u.id, 0)
        if total != last:
            place, last = i + 1, total
        out.append({"place": place, "name": xp.board_name(u), "xp": total, "level": xp.level_of(total),
                    "avatar": xp.avatar_of(u), "me": me is not None and u.id == me.id})
    return out


def _all_classes_board(db, teacher_id, me=None):
    """All of a teacher's GameIDE classes together, or None when they have only one."""
    courses = _courses(db).filter_by(teacher_id=teacher_id).all()
    return board(db, courses, me=me) if len(courses) > 1 else None


def _event_rows(db, course, limit=10):
    return (db.query(accounts.ClassEvent).filter_by(class_id=course.id, app=APP_NAME)
            .order_by(accounts.ClassEvent.created_at.desc(), accounts.ClassEvent.id.desc()).limit(limit).all())


def _event_out(db, row, show_hidden=True):
    """An event and who it moved. A student hidden from the leaderboard is
    "A classmate" to the class: hiding means not being named to it."""
    awards = db.query(accounts.XpAward).filter(accounts.XpAward.source.like("event:%d:%%" % row.id)).all()
    users = {u.id: u for u in db.query(accounts.User).filter(accounts.User.id.in_([a.user_id for a in awards] or [0]))}
    hits = []
    for a in awards:
        u = users.get(a.user_id)
        name = xp.board_name(u) if u is not None and (show_hidden or not u.board_hidden) else "A classmate"
        hits.append({"name": name, "xp": a.xp})
    hits.sort(key=lambda h: h["name"].lower())
    icon = next((e["icon"] for e in xp.EVENTS if e["id"] == row.kind), "\U0001F3B2")
    return {"id": row.id, "title": row.title, "text": row.text, "icon": icon, "when": _iso(row.created_at),
            "undone": bool(row.undone), "hits": hits}


def _latest_event(db, course):
    """The class's last random event, for the top of its page — for a day, and not once undone."""
    rows = _event_rows(db, course, limit=1)
    if not rows or rows[0].undone:
        return None
    t = rows[0].created_at
    if t.tzinfo is None:
        t = t.replace(tzinfo=timezone.utc)
    if now() - t > timedelta(days=1):
        return None
    return _event_out(db, rows[0], show_hidden=False)


@bp.get("/api/classes/<int:class_id>/board")
def class_board(class_id):
    """A class's leaderboard (and its teacher's all-classes one), and its
    latest random event — for the class's page, to its teacher and its students."""
    db = _db()
    try:
        user = _need_user(db)
        course = _courses(db).filter(accounts.Course.id == class_id).first()
        teaching = course is not None and course.teacher_id == user.id
        if course is None or not (teaching or any(c.id == class_id for c in my_classes(db, user))):
            return err("That isn't one of your classes.", 403)
        return jsonify(board=board(db, course, me=user), all=_all_classes_board(db, course.teacher_id, me=user),
                       event=_latest_event(db, course))
    finally:
        db.close()


# ---------------------------------------------------------------- quests (full marks)

def _has_full_marks(db, a, student_id):
    """Full marks: the grade (score, questions and checked tests) reaching
    the points — grades.py has the rule, shared with every total."""
    return grades.has_full_marks(db, a, student_id)


def full_marks_xp(db, a, student_id):
    """The assignment's quest reward, once, to a student with full marks.
    Asked whenever their score moves and for everyone when the reward is set.
    Kept if marks later fall: taking XP back is the teacher's to do."""
    if (a.xp_bonus or 0) <= 0 or not _has_full_marks(db, a, student_id):
        return 0
    return xp.award(db, student_id, "bonus:%d" % a.id, a.xp_bonus, "Full marks on %s" % a.title, APP_NAME)


def quests_done(db, user):
    """Assignment ids whose quest reward this student has had: what "complete" means."""
    done = set()
    for (src,) in db.query(accounts.XpAward.source).filter(accounts.XpAward.user_id == user.id,
                                                            accounts.XpAward.source.like("bonus:%")):
        try:
            done.add(int(src.split(":", 1)[1]))
        except ValueError:
            pass
    return done


def _open_quests(db, user):
    """Quests in a student's classes not completed yet: shown, not archived."""
    courses = {c.id: c for c in my_classes(db, user)}
    if not courses:
        return []
    done = quests_done(db, user)
    rows = (db.query(accounts.Assignment, accounts.ClassItem)
            .join(accounts.ClassItem, accounts.ClassItem.assignment_id == accounts.Assignment.id)
            .filter(accounts.ClassItem.class_id.in_(list(courses)), accounts.ClassItem.hidden == 0,
                    accounts.Assignment.archived == 0, accounts.Assignment.xp_bonus > 0)
            .order_by(accounts.Assignment.xp_bonus.desc(), accounts.Assignment.title))
    return [{"title": a.title, "xp": a.xp_bonus, "class": courses[item.class_id].name, "slug": a.slug}
            for a, item in rows if a.id not in done]


@bp.post("/api/assignments/<slug>/xp-bonus")
def set_xp_bonus(slug):
    """The quest reward: XP for full marks, 0 for none. Setting it pays
    everyone who already has full marks, so the early finishers don't miss out."""
    db = _db()
    try:
        user = _need_user(db)
        a = db.query(accounts.Assignment).filter_by(slug=slug, app=APP_NAME).first()
        if a is None or a.teacher_id != user.id:
            return err("That's not one of your assignments.", 403)
        raw = (request.get_json(silent=True) or {}).get("xp")
        try:
            value = int(str(raw if raw not in (None, "") else 0).strip())
        except ValueError:
            return err("The reward has to be a whole number.", 400)
        if value < 0 or value > xp.GRANT_LIMIT:
            return err("The reward has to be between 0 and %d." % xp.GRANT_LIMIT, 400)
        a.xp_bonus = value
        a.updated_at = now()
        db.commit()
        paid = 0
        if value:
            students = {sid for (sid,) in db.query(accounts.Submission.student_id).filter_by(assignment_id=a.id)}
            paid = sum(1 for sid in students if full_marks_xp(db, a, sid))
        return jsonify(ok=True, xpBonus=value, paid=paid)
    finally:
        db.close()


# ---------------------------------------------------------------- a student's own

def _held(db, student_id):
    """Tokens asked for and not answered yet."""
    return sum(c for (c,) in db.query(accounts.ShopRequest.cost).filter_by(student_id=student_id, status="pending"))


def _tokens_free(db, student):
    earned = xp.tokens_earned(xp.total(db, student.id))
    return max(0, earned - (student.tokens_used or 0) - _held(db, student.id))


def _ensure_shop(db, teacher):
    """Stock a teacher's shop the first time it is opened — only then: a
    teacher who emptied the shelf has rows, all inactive, and isn't restocked.
    (PyIDE also adds its editor themes for sale; those change PyIDE's editor
    only, so GameIDE never lists them.)"""
    if db.query(accounts.ShopItem.id).filter_by(teacher_id=teacher.id).first() is None:
        for name, cost, what in xp.SHOP_STARTER:
            db.add(accounts.ShopItem(teacher_id=teacher.id, name=name, cost=cost, description=what))
        db.commit()


def _shop_items(db, teacher_id, everything=False):
    q = db.query(accounts.ShopItem).filter_by(teacher_id=teacher_id).filter(accounts.ShopItem.theme == "")
    if not everything:
        q = q.filter_by(active=1)
    return q.order_by(accounts.ShopItem.active.desc(), accounts.ShopItem.cost, accounts.ShopItem.name).all()


def _item_out(i):
    return {"id": i.id, "name": i.name, "cost": i.cost, "description": i.description, "active": bool(i.active)}


def _request_out(r, student=None):
    return {"id": r.id, "name": r.name, "cost": r.cost, "status": r.status, "when": _iso(r.created_at),
            "student": student.display_name() if student is not None else "", "studentId": r.student_id}


def _photo(db, user, status):
    return (db.query(accounts.StudentPhoto).filter_by(user_id=user.id, status=status, app=APP_NAME)
            .order_by(accounts.StudentPhoto.id.desc()).first())


@bp.get("/api/me/xp")
def my_xp():
    """Everything about one person's XP, for their Classes page: the total,
    level, badges and tokens, their avatar, the boards they're on, open
    quests, their teachers' shops and their requests. A teacher gets the
    avatar part only — teachers don't earn."""
    db = _db()
    try:
        user = _need_user(db)
        approved, pending = _photo(db, user, "approved"), _photo(db, user, "pending")
        base = {"avatar": xp.avatar_of(user), "avatars": xp.avatars_for_page(), "earns": earns_xp(user),
                "photo": ("photo:" + approved.slug) if approved else "",
                "pending": ("photo:" + pending.slug) if pending else ""}
        if not earns_xp(user):
            return jsonify(base)
        total = xp.total(db, user.id)
        card = {**base, **xp.summary(total, user.tokens_used)}
        card["hidden"] = bool(user.board_hidden)
        card["recent"] = [{"xp": a.xp, "reason": a.reason, "when": _iso(a.created_at)} for a in xp.recent(db, user.id)]
        mine = my_classes(db, user)
        boards = [(c.name, board(db, c, me=user), c.id) for c in mine]
        teachers = sorted({c.teacher_id for c in mine})
        for tid in teachers:
            b = _all_classes_board(db, tid, me=user)
            if b is not None:
                who = db.query(accounts.User).filter_by(id=tid).first()
                first = next(c for c in mine if c.teacher_id == tid)
                boards.append(("All classes" + (" — " + who.display_name() if len(teachers) > 1 and who else ""), b, first.id))
        card["ranks"] = []
        for name, b, class_id in boards:
            me_row = [r for r in b if r["me"]]
            top = b[:5]
            card["ranks"].append({"name": name, "of": len(b), "place": me_row[0]["place"] if me_row else None,
                                  "top": top, "meRow": me_row[0] if me_row and me_row[0] not in top else None,
                                  "classId": class_id})
        card["quests"] = _open_quests(db, user)
        card["held"] = _held(db, user.id)
        card["free"] = max(0, card["tokens"] - card["held"])
        card["shops"] = []
        for tid in teachers:
            teacher = db.query(accounts.User).filter_by(id=tid).first()
            if teacher is None:
                continue
            _ensure_shop(db, teacher)
            card["shops"].append({"teacher": teacher.display_name(), "items": [_item_out(i) for i in _shop_items(db, tid)]})
        card["requests"] = [_request_out(r) for r in db.query(accounts.ShopRequest).filter_by(student_id=user.id)
                            .order_by(accounts.ShopRequest.created_at.desc()).limit(8)]
        # Roughly: the time counts as they work, not by the clock.
        card["runMinutes"] = max(0, (xp.RUN_EVERY_SECONDS - session.get("busy", 0)) // 60)
        card["runXp"] = xp.RUN_XP
        return jsonify(card)
    finally:
        db.close()


@bp.get("/api/me/xp/all")
def my_xp_all():
    """Every piece of XP this person has had, newest first, with why — from every editor."""
    db = _db()
    try:
        user = _need_user(db)
        rows = (db.query(accounts.XpAward).filter_by(user_id=user.id)
                .order_by(accounts.XpAward.created_at.desc(), accounts.XpAward.id.desc()).limit(1000).all())
        return jsonify(summary=xp.summary(xp.total(db, user.id), user.tokens_used),
                       awards=[{"xp": a.xp, "reason": a.reason, "app": a.app, "when": _iso(a.created_at)} for a in rows])
    finally:
        db.close()


@bp.post("/api/xp/run")
def xp_run():
    """A game ran without an error in this student's browser. Pays RUN_XP
    once they've worked RUN_EVERY_SECONDS since the last run that paid and
    the code (`code`, a hash the page makes of the game's code — never the
    code) differs from that run's. One per minute by the source, so two tabs
    claiming at once collide and only one is paid."""
    db = _db()
    try:
        user = _current_user(db)
        if not earns_xp(user):
            return jsonify(awarded=0)
        code = re.sub(r"[^0-9a-z]", "", str((request.get_json(silent=True) or {}).get("code", "")).lower())[:64]
        if not code:
            return err("No code.", 400)
        busy = session.get("busy", 0)
        if busy < xp.RUN_EVERY_SECONDS:
            return jsonify(awarded=0, minutes=(xp.RUN_EVERY_SECONDS - busy + 59) // 60)
        runs = db.query(accounts.XpAward).filter(accounts.XpAward.user_id == user.id,
                                                 accounts.XpAward.source.like("run:%"))
        cutoff = now() - timedelta(seconds=xp.RUN_EVERY_SECONDS)
        if runs.filter(accounts.XpAward.created_at > cutoff).first() is not None:
            return jsonify(awarded=0)
        last = runs.order_by(accounts.XpAward.id.desc()).first()
        if last is not None and last.detail == code:
            return jsonify(awarded=0, same=True)
        got = xp.award(db, user.id, "run:%d" % (int(time.time()) // 60), xp.RUN_XP, "Ran a game", APP_NAME, detail=code)
        if got:
            session["busy"] = 0
        return jsonify(awarded=got, xp=xp.total(db, user.id))
    finally:
        db.close()


@bp.get("/api/me/xp/news")
def xp_news():
    """XP given since award `after`, for the pop-up every page shows. A GET
    to /api/, so polling it is never activity. Leaves out runs, which the
    editor announces as they happen. No `after`: just where to count from,
    so a first visit isn't a flood of their whole history; `user` lets a
    shared Chromebook's browser notice a different student."""
    db = _db()
    try:
        user = _current_user(db)
        if not earns_xp(user):
            return jsonify(user=None, latest=0, awards=[])
        mine = db.query(accounts.XpAward).filter(accounts.XpAward.user_id == user.id)
        newest = mine.order_by(accounts.XpAward.id.desc()).first()
        latest = newest.id if newest is not None else 0
        try:
            after = int(request.args.get("after", ""))
        except ValueError:
            return jsonify(user=user.id, latest=latest, awards=[])
        awards = [{"xp": a.xp, "reason": a.reason, "kind": a.source.split(":", 1)[0]}
                  for a in mine.filter(accounts.XpAward.id > after).order_by(accounts.XpAward.id).limit(10)
                  if a.source.split(":", 1)[0] != "run"]
        return jsonify(user=user.id, latest=latest, awards=awards)
    finally:
        db.close()


@bp.post("/api/me/board")
def me_board():
    """Hide from, or come back to, every leaderboard. Hidden students still earn."""
    db = _db()
    try:
        user = _need_user(db)
        user.board_hidden = 1 if (request.get_json(silent=True) or {}).get("hidden") else 0
        db.commit()
        return jsonify(ok=True, hidden=bool(user.board_hidden))
    finally:
        db.close()


@bp.post("/api/me/avatar")
def save_avatar():
    """One picture from xp.AVATARS unlocked at their level — the page greys
    the rest out, but the page isn't what decides — or "photo", their own
    photo once a teacher has approved it."""
    db = _db()
    try:
        user = _need_user(db)
        wanted = (request.get_json(silent=True) or {}).get("avatar")
        if wanted == "photo":
            approved = _photo(db, user, "approved")
            if approved is None:
                return err("Your photo hasn't been approved yet.", 400)
            user.avatar = "photo:" + approved.slug
            db.commit()
            return jsonify(ok=True, avatar=user.avatar)
        avatar, why = xp.clean_avatar(wanted, xp.level_of(xp.total(db, user.id)))
        if why:
            return err(why, 400)
        user.avatar = avatar
        db.commit()
        return jsonify(ok=True, avatar=avatar)
    finally:
        db.close()


# ---------------------------------------------------------------- photos

#: The page shrinks a photo to 400px square first; this caps a page that didn't.
PHOTO_MAX_BYTES = 600 * 1024


def _teaches(db, teacher, student):
    """Whether `student` is on a roster of one of `teacher`'s GameIDE classes."""
    if teacher is None or student is None or not _is_teacher(teacher):
        return False
    return (db.query(accounts.Enrollment.id).join(accounts.Course, accounts.Course.id == accounts.Enrollment.class_id)
            .filter(accounts.Course.teacher_id == teacher.id, accounts.Course.app == APP_NAME,
                    func.lower(accounts.Enrollment.email) == student.email.lower()).first() is not None)


@bp.post("/api/me/photo")
def upload_photo():
    """A student's photo, sent for a teacher's approval: the raw picture as
    the body. Nobody else sees it until then; it replaces one already waiting."""
    db = _db()
    try:
        user = _need_user(db)
        if _is_teacher(user):
            return err("Only students upload photos.", 403)
        data = request.get_data(cache=False)
        if len(data) > PHOTO_MAX_BYTES:
            return err("That picture is too big.", 413)
        kind = gamestore.sniff_image(data)
        if kind is None:
            return err("That isn't a PNG, JPEG, GIF or WebP picture.", 400)
        db.query(accounts.StudentPhoto).filter_by(user_id=user.id, status="pending", app=APP_NAME).delete(
            synchronize_session=False)
        photo = accounts.StudentPhoto(slug=accounts.new_id(db, accounts.StudentPhoto), user_id=user.id, app=APP_NAME,
                                      content_type=kind, data=data, size=len(data), status="pending")
        db.add(photo)
        db.commit()
        return jsonify(ok=True, pending="photo:" + photo.slug)
    finally:
        db.close()


@bp.get("/photo/<slug>")
def serve_photo(slug):
    """A student's photo. Approved — in any editor, since an avatar is one
    per person — to anyone: it's on a leaderboard. Waiting: to the student
    and their GameIDE teachers only, never cached."""
    db = _db()
    try:
        photo = db.query(accounts.StudentPhoto).filter_by(slug=_clean(slug, 16)).first()
        if photo is None or (photo.status != "approved" and photo.app != APP_NAME):
            abort(404)
        if photo.status != "approved":
            viewer = _current_user(db)
            owner = db.query(accounts.User).filter_by(id=photo.user_id).first()
            if viewer is None or not (viewer.id == photo.user_id or _teaches(db, viewer, owner)):
                abort(404)
        r = Response(photo.data, mimetype=photo.content_type)
        r.headers["Cache-Control"] = "public, max-age=31536000, immutable" if photo.status == "approved" else "no-store"
        r.headers["X-Content-Type-Options"] = "nosniff"
        r.headers["Content-Security-Policy"] = "default-src 'none'; sandbox"
        return r
    finally:
        db.close()


# ---------------------------------------------------------------- the token shop

def _shop_clean(data, item=None):
    fields = {}
    if "name" in data or item is None:
        name = _clean(data.get("name"), 120)
        if not name:
            return None, "Give it a name."
        fields["name"] = name
    if "description" in data:
        fields["description"] = _clean(data.get("description"), 400)
    if "cost" in data or item is None:
        try:
            cost = int(str(data.get("cost", "")).strip())
        except ValueError:
            return None, "The price has to be a whole number of tokens."
        if cost < 1 or cost > xp.SHOP_MAX_COST:
            return None, "The price has to be between 1 and %d tokens." % xp.SHOP_MAX_COST
        fields["cost"] = cost
    if "active" in data:
        fields["active"] = 1 if data.get("active") else 0
    return fields, ""


def _need_teacher(db):
    user = _need_user(db)
    if not _is_teacher(user):
        fail("Only a teacher can do that.", 403)
    return user


@bp.get("/api/shop")
def shop():
    """The teacher's own shop — the same shelf in every editor."""
    db = _db()
    try:
        user = _need_teacher(db)
        _ensure_shop(db, user)
        return jsonify(items=[_item_out(i) for i in _shop_items(db, user.id, everything=True)],
                       tokenEvery=xp.TOKEN_EVERY, maxCost=xp.SHOP_MAX_COST)
    finally:
        db.close()


@bp.post("/api/shop/item")
def shop_item_new():
    db = _db()
    try:
        user = _need_teacher(db)
        fields, why = _shop_clean(request.get_json(silent=True) or {})
        if why:
            return err(why, 400)
        if db.query(accounts.ShopItem).filter_by(teacher_id=user.id).count() >= xp.SHOP_MAX_ITEMS:
            return err("That's as many items as a shop holds.", 400)
        item = accounts.ShopItem(teacher_id=user.id, **fields)
        db.add(item)
        db.commit()
        return jsonify(ok=True, id=item.id), 201
    finally:
        db.close()


@bp.post("/api/shop/item/<int:item_id>")
def shop_item_update(item_id):
    """Change an item, or take it off the shelf (active false) and back. Never deleted."""
    db = _db()
    try:
        user = _need_teacher(db)
        item = db.query(accounts.ShopItem).filter_by(id=item_id, teacher_id=user.id).first()
        if item is None:
            return err("No such item.", 404)
        fields, why = _shop_clean(request.get_json(silent=True) or {}, item)
        if why:
            return err(why, 400)
        for k, v in fields.items():
            setattr(item, k, v)
        db.commit()
        return jsonify(ok=True)
    finally:
        db.close()


@bp.post("/api/shop/request")
def shop_request():
    """A student asks for an item from one of their teachers' shops. Its
    tokens are held until the teacher answers; no asking past what they have."""
    db = _db()
    try:
        user = _need_user(db)
        if _is_teacher(user):
            return err("Teachers don't spend tokens.", 403)
        try:
            item_id = int((request.get_json(silent=True) or {}).get("item"))
        except (TypeError, ValueError):
            return err("No such item.", 404)
        item = db.query(accounts.ShopItem).filter_by(id=item_id, active=1).first()
        if item is None or item.theme or item.teacher_id not in {c.teacher_id for c in my_classes(db, user)}:
            return err("That isn't in your teacher's shop.", 404)
        free = _tokens_free(db, user)
        if free < item.cost:
            return err("That costs %d token%s; you have %d to spend." % (item.cost, "" if item.cost == 1 else "s", free), 409)
        row = accounts.ShopRequest(item_id=item.id, teacher_id=item.teacher_id, student_id=user.id,
                                   name=item.name, cost=item.cost)
        db.add(row)
        db.commit()
        return jsonify(ok=True, request=_request_out(row), free=_tokens_free(db, user))
    finally:
        db.close()


@bp.post("/api/shop/request/<int:request_id>/cancel")
def shop_request_cancel(request_id):
    db = _db()
    try:
        user = _need_user(db)
        row = db.query(accounts.ShopRequest).filter_by(id=request_id, student_id=user.id, status="pending").first()
        if row is None:
            return err("That request isn't waiting any more.", 404)
        row.status, row.decided_at = "cancelled", now()
        db.commit()
        return jsonify(ok=True, free=_tokens_free(db, user))
    finally:
        db.close()


@bp.post("/api/shop/request/<int:request_id>/<decision>")
def shop_request_decide(request_id, decision):
    """The teacher answers. Approving spends the tokens in one UPDATE that
    only happens if they still have them, so nothing is ever overspent."""
    db = _db()
    try:
        user = _need_teacher(db)
        if decision not in ("approve", "decline"):
            abort(404)
        row = db.query(accounts.ShopRequest).filter_by(id=request_id, teacher_id=user.id, status="pending").first()
        if row is None:
            return err("That request isn't waiting any more.", 404)
        if decision == "approve":
            earned = xp.tokens_earned(xp.total(db, row.student_id))
            spent = (db.query(accounts.User)
                     .filter(accounts.User.id == row.student_id, accounts.User.tokens_used + row.cost <= earned)
                     .update({"tokens_used": accounts.User.tokens_used + row.cost}, synchronize_session=False))
            if not spent:
                db.rollback()
                return err("They don't have enough tokens for it any more.", 409)
        row.status = "approved" if decision == "approve" else "declined"
        row.decided_at = now()
        db.commit()
        return jsonify(ok=True, status=row.status)
    finally:
        db.close()


# ---------------------------------------------------------------- a class's XP, for its teacher

def _class_requests(db, course, teacher):
    people = {u.id: u for _, u in class_students(db, course) if u is not None}
    if not people:
        return []
    rows = (db.query(accounts.ShopRequest).filter(accounts.ShopRequest.teacher_id == teacher.id,
                                                  accounts.ShopRequest.status == "pending",
                                                  accounts.ShopRequest.student_id.in_(list(people)))
            .order_by(accounts.ShopRequest.created_at))
    return [_request_out(r, people[r.student_id]) for r in rows]


def _pending_photos(db, course):
    people = {u.id: u for _, u in class_students(db, course) if u is not None}
    if not people:
        return []
    rows = (db.query(accounts.StudentPhoto).filter(accounts.StudentPhoto.user_id.in_(list(people)),
                                                   accounts.StudentPhoto.status == "pending",
                                                   accounts.StudentPhoto.app == APP_NAME)
            .order_by(accounts.StudentPhoto.created_at))
    return [{"id": p.id, "url": "/photo/" + p.slug, "name": people[p.user_id].display_name()} for p in rows]


@bp.get("/api/classes/<int:class_id>/xp")
def class_xp(class_id):
    """The class's XP page: each student's total, level and tokens, the
    reasons to give or take XP for, requests and photos waiting, events."""
    db = _db()
    try:
        user = _need_teacher(db)
        course = _own_class(db, user, class_id)
        pairs = class_students(db, course)
        have = xp.totals(db, [u.id for _, u in pairs if u is not None])
        students = []
        for e, u in pairs:
            row = {"name": e.name or (u.display_name() if u else e.email.split("@")[0]), "email": e.email, "id": None}
            if u is not None:
                row.update(xp.summary(have.get(u.id, 0), u.tokens_used))
                row.update(id=u.id, avatar=xp.avatar_of(u), hidden=bool(u.board_hidden), held=_held(db, u.id))
            students.append(row)
        return jsonify(name=course.name, students=students, tokenEvery=xp.TOKEN_EVERY, grantLimit=xp.GRANT_LIMIT,
                       behaviors=[{"reason": r, "xp": n} for r, n in xp.BEHAVIORS],
                       requests=_class_requests(db, course, user), photos=_pending_photos(db, course),
                       events=[_event_out(db, r) for r in _event_rows(db, course)])
    finally:
        db.close()


@bp.post("/api/classes/<int:class_id>/xp")
def class_give_xp(class_id):
    """XP from the teacher, with a reason the student sees, to one or several
    students. Negative is a penalty, but never below 0 XP (xp.penalty_for):
    a student it would move by nothing is left out and named in `skipped`."""
    db = _db()
    try:
        user = _need_teacher(db)
        course = _own_class(db, user, class_id)
        data = request.get_json(silent=True) or {}
        wanted = data.get("students")
        if not isinstance(wanted, list):
            wanted = [data.get("student")]
        students = []
        for raw in wanted[:200]:
            s = _class_student(db, course, raw)
            if s is None:
                return err("That student isn't in this class.", 404)
            if s not in students:
                students.append(s)
        if not students:
            return err("Choose a student first.", 400)
        try:
            amount = int(str(data.get("xp", "")).strip())
        except ValueError:
            return err("XP has to be a whole number.", 400)
        if amount == 0 or abs(amount) > xp.GRANT_LIMIT:
            return err("XP has to be between -%d and %d, and not 0." % (xp.GRANT_LIMIT, xp.GRANT_LIMIT), 400)
        reason = _clean(data.get("reason"), 200) or "From your teacher"
        have = xp.totals(db, [u.id for u in students])
        skipped = []
        for s in students:
            moved = xp.penalty_for(amount, have.get(s.id, 0))
            if not moved:
                skipped.append(xp.board_name(s))
            elif not xp.award(db, s.id, xp.grant_source(), moved, reason, APP_NAME, by_id=user.id):
                return err("That XP wasn't saved. Try again.", 500)
        return jsonify(ok=True, skipped=skipped)
    finally:
        db.close()


@bp.post("/api/classes/<int:class_id>/tokens")
def class_use_token(class_id):
    """Use one of a student's tokens (bought face to face). One conditional
    UPDATE, so a double click on two workers uses one, not two."""
    db = _db()
    try:
        user = _need_teacher(db)
        course = _own_class(db, user, class_id)
        student = _class_student(db, course, (request.get_json(silent=True) or {}).get("student"))
        if student is None:
            return err("That student isn't in this class.", 404)
        earned = xp.tokens_earned(xp.total(db, student.id))
        used = (db.query(accounts.User).filter(accounts.User.id == student.id, accounts.User.tokens_used < earned)
                .update({"tokens_used": accounts.User.tokens_used + 1}, synchronize_session=False))
        db.commit()
        if not used:
            return err("They have no tokens left.", 409)
        db.refresh(student)
        return jsonify(ok=True, tokens=max(0, earned - student.tokens_used))
    finally:
        db.close()


_rng = random.SystemRandom()


@bp.post("/api/classes/<int:class_id>/event")
def class_event(class_id):
    """Draw a random event (xp.EVENTS) and apply it to the class's signed-in
    students at once — pressed in front of the class. Undo takes it back."""
    db = _db()
    try:
        user = _need_teacher(db)
        course = _own_class(db, user, class_id)
        people = [u for _, u in class_students(db, course) if u is not None]
        if not people:
            return err("No one in this class has signed in yet.", 400)
        have = xp.totals(db, [u.id for u in people])
        event = xp.pick_event(_rng)
        row = accounts.ClassEvent(class_id=course.id, app=APP_NAME, kind=event["id"], title=event["title"],
                                  text=event["text"], by_id=user.id)
        db.add(row)
        db.commit()
        for u in xp.event_targets(event, people, have, _rng):
            moved = xp.penalty_for(event["xp"], have.get(u.id, 0))
            xp.award(db, u.id, "event:%d:%d" % (row.id, u.id), moved, "Random event: " + event["title"], APP_NAME,
                     by_id=user.id)
        return jsonify(ok=True, event=_event_out(db, row))
    finally:
        db.close()


@bp.post("/api/classes/<int:class_id>/event/<int:event_id>/undo")
def class_event_undo(class_id, event_id):
    """Take an event back: its XP rows go — the one place award rows are
    deleted — and the event is marked undone."""
    db = _db()
    try:
        user = _need_teacher(db)
        course = _own_class(db, user, class_id)
        row = db.query(accounts.ClassEvent).filter_by(id=event_id, class_id=course.id, app=APP_NAME).first()
        if row is None:
            return err("No such event.", 404)
        db.query(accounts.XpAward).filter(accounts.XpAward.source.like("event:%d:%%" % row.id)).delete(
            synchronize_session=False)
        row.undone = 1
        db.commit()
        return jsonify(ok=True)
    finally:
        db.close()


@bp.post("/api/classes/<int:class_id>/photo/<int:photo_id>/<decision>")
def decide_photo(class_id, photo_id, decision):
    """Approve (it becomes their avatar at once) or reject (deleted, picture
    and all) a waiting photo from a student in this class."""
    db = _db()
    try:
        user = _need_teacher(db)
        course = _own_class(db, user, class_id)
        if decision not in ("approve", "reject"):
            abort(404)
        photo = db.query(accounts.StudentPhoto).filter_by(id=photo_id, status="pending", app=APP_NAME).first()
        student = _class_student(db, course, photo.user_id) if photo is not None else None
        if photo is None or student is None:
            return err("That photo isn't waiting any more.", 404)
        if decision == "reject":
            db.delete(photo)
            db.commit()
            return jsonify(ok=True)
        db.query(accounts.StudentPhoto).filter_by(user_id=student.id, status="approved", app=APP_NAME).delete(
            synchronize_session=False)
        photo.status = "approved"
        photo.decided_by, photo.decided_at = user.id, now()
        student.avatar = "photo:" + photo.slug
        db.commit()
        return jsonify(ok=True)
    finally:
        db.close()
