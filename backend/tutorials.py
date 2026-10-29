"""
Tutorials (Phase 11b): the built-in ones the editor ships with, the ones
teachers write, sharing them, and the XP for working through one.

A tutorial is markdown — a header, then one step per `---` slide, each with
```check blocks (frontend/src/tutorials/tutorial.ts). It runs in the
editor's Notes tab, step by step, Next locked until a step's checks pass.
Where a student has got to is kept in their game's own JSON (`tutorial`:
{key, step, steps, title}), so it saves offline and signed out like any
change, and the library reads progress from the games themselves.

Keys name where a tutorial's markdown is:
  builtin:<name>    frontend/public/tutorials/<name>.md
  t:<slug>          a teacher's, in the tutorial library (library_items)
  a:<slug>          an assignment made from one: its notes are the tutorial

Assigned to a class, a tutorial is an ordinary assignment whose notes are
the tutorial (classes.new_assignment, `notes`): marking, Check all (its
```check blocks count as tests — grades.tests_of), results and Classroom
work unchanged.
"""
import json
import os
import re
from pathlib import Path

from sqlalchemy.exc import SQLAlchemyError
from flask import Blueprint, abort, jsonify, make_response, request

import accounts
import checks
import grades
import rewards
import xp
from accounts import now
from gamestore import AssignmentWork, HiddenBuiltin, Tutorial

bp = Blueprint("tutorials", __name__)

APP_NAME = "gameide"
MAX_TUTORIAL = 100_000
# "site" is the public Learn page (#/tutorials); everything else is the
# teacher's own. A class gets a tutorial by having it as an assignment's
# notes, as in the other editors — so there is no "classes" any more, and
# rows left at it are made private (migrate).
VISIBILITIES = ("private", "site")

_db = None
_current_user = None
_dist = None


def init(app, session_factory, current_user, dist):
    global _db, _current_user, _dist
    _db, _current_user, _dist = session_factory, current_user, dist
    app.register_blueprint(bp)


def err(message, status):
    return jsonify(error=message), status


def fail(message, status):
    abort(make_response(jsonify(error=message), status))


def _need_user(db):
    user = _current_user(db)
    if user is None:
        fail("Sign in first.", 401)
    return user


def _is_teacher(user):
    return bool(user) and accounts.is_teacher(user.email)


def _is_admin(user):
    return bool(user) and user.email.lower() in [e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()]


# ---------------------------------------------------------------- the format (as tutorial.ts reads it)

HEADER = re.compile(r"^\s*---[ \t]*\n(.*?)\n---[ \t]*(?:\n|$)", re.S)
FENCE = re.compile(r"^ {0,3}(`{3,}|~{3,})")
RULE = re.compile(r"^ {0,3}-{3,}\s*$")


def split_header(md):
    """({field: value}, body) — the header's fields, and the steps after it."""
    text = str(md or "").replace("\r\n", "\n").replace("\r", "\n")
    m = HEADER.match(text)
    fields = {}
    if m:
        for line in m.group(1).split("\n"):
            f = re.match(r"^([a-z]+)\s*:\s*(.*)$", line.strip(), re.I)
            if f:
                fields[f.group(1).lower()] = f.group(2).strip()
    return fields, (text[m.end():] if m else text)


def _slides(md):
    """notes/quiz.ts slides(), in Python: cut at --- lines outside code, [] for none."""
    out, cur, fence, cuts = [], [], None, 0
    for ln in md.split("\n"):
        f = FENCE.match(ln)
        if f:
            if fence is None:
                fence = f.group(1)
            elif f.group(1)[0] == fence[0] and len(f.group(1)) >= len(fence):
                fence = None
        elif fence is None and RULE.match(ln):
            out.append(cur)
            cur, cuts = [], cuts + 1
            continue
        cur.append(ln)
    out.append(cur)
    if not cuts:
        return []
    return [s for s in ("\n".join(x).strip("\n").strip() for x in out) if s.strip()]


def steps_of(md):
    """The tutorial's steps, as the editor counts them."""
    _, body = split_header(md)
    cut = _slides(body)
    return cut if cut else ([body.strip()] if body.strip() else [])


def is_tutorial(md):
    fields, _ = split_header(md)
    return bool(fields.get("title")) and bool(HEADER.match(str(md or "").replace("\r\n", "\n")))


def meta(md):
    fields, _ = split_header(md)
    return {"title": fields.get("title") or "Untitled tutorial", "level": fields.get("level") or "Getting Started",
            "time": fields.get("time", ""), "starter": fields.get("starter") or "empty",
            "description": fields.get("description", ""), "steps": len(steps_of(md))}


# ---------------------------------------------------------------- where tutorials are

def _builtin_dir():
    """The built-in tutorials: in the build (dist/tutorials), or in the source
    when there's no build (the tests, and a server run without one)."""
    built = Path(_dist() if callable(_dist) else _dist) / "tutorials"
    return built if built.exists() else Path(__file__).resolve().parent.parent / "frontend" / "public" / "tutorials"


def builtin(name):
    if not re.fullmatch(r"[a-z0-9-]{1,40}", name or ""):
        return None
    f = _builtin_dir() / (name + ".md")
    return f.read_text(encoding="utf-8") if f.exists() else None


def _can_see(db, user, t):
    if t.visibility == "site":
        return True
    return user is not None and (t.teacher_id == user.id or _is_admin(user))


def markdown_for(db, user, key):
    """A tutorial's markdown by key, if this person may follow it; else None."""
    kind, _, rest = str(key or "").partition(":")
    if kind == "builtin":
        return builtin(rest)
    if kind == "t":
        t = _row(db, rest)
        return t.body if t is not None and _can_see(db, user, t) else None
    if kind == "a" and user is not None:
        a = db.query(accounts.Assignment).filter_by(slug=rest[:16], app=APP_NAME).first()
        if a is None:
            return None
        mine = db.query(AssignmentWork).filter_by(assignment_id=a.id, owner_id=user.id).first() is not None
        return grades.notes_of(a) if mine or a.teacher_id == user.id else None
    return None


def _out(db, t, user):
    owner = db.query(accounts.User).filter_by(id=t.teacher_id).first()
    return {"slug": t.slug, "key": "t:" + t.slug, **meta(t.body), "visibility": t.visibility,
            "owner": owner.display_name() if owner else "", "mine": user is not None and t.teacher_id == user.id,
            "origin": t.origin,
            "updated": t.updated_at.isoformat() + ("Z" if t.updated_at.tzinfo is None else "")}


# ---------------------------------------------------------------- kept in the library

def _rows():
    """Teachers' tutorials: rows of the tutorial library (library.py), which
    is where they're written and edited. A row is a tutorial to follow (on
    the Tutorials page) when it has a tutorial's header; plain notes taken in
    from an assignment are in the library but not on these shelves."""
    L = accounts.LibraryItem
    return L.app == APP_NAME, L.kind == "tutorial", L.archived == 0


def _row(db, slug):
    t = db.query(accounts.LibraryItem).filter(accounts.LibraryItem.slug == str(slug)[:16], *_rows()).first()
    return t if t is not None and is_tutorial(t.body) else None


def migrate(db):
    """Tutorials written before the library (gameide_tutorials) move into it,
    each keeping its slug, so a student's progress (t:<slug>) still finds it.

    MOVE, not copy: each old row is deleted once it's in the library. It once
    stayed behind, and a tutorial deleted from the library was put back from
    it the next time the Learn page loaded — a delete that didn't delete."""
    L = accounts.LibraryItem
    # "Shared with my classes" is gone (VISIBILITIES): those are private now.
    if db.query(L.id).filter(L.app == APP_NAME, L.visibility == "classes").first() is not None:
        db.query(L).filter(L.app == APP_NAME, L.visibility == "classes").update({"visibility": "private"})
        db.commit()
    # A teacher's row made from a built-in is "<title> (copy)": the library
    # lists the built-in itself beside it now. Rows made before keep the
    # built-in's own title and are renamed, once — a title they've changed is
    # theirs and left alone.
    made = db.query(L).filter(L.app == APP_NAME, L.origin.like("builtin:%")).all()
    renamed = False
    for row in made:
        md = builtin(row.origin[len("builtin:"):])
        if md is not None and row.title == meta(md)["title"]:
            row.title = (row.title + " (copy)")[:200]
            renamed = True
    if renamed:
        db.commit()
    have = {s for (s,) in db.query(accounts.LibraryItem.slug).filter(accounts.LibraryItem.app == APP_NAME)}
    moved = 0
    old = db.query(Tutorial).all()
    for t in old:
        if t.slug in have:
            db.delete(t)      # moved before this deleted them: in the library already
            continue
        db.add(accounts.LibraryItem(slug=t.slug, app=APP_NAME, teacher_id=t.owner_id, kind="tutorial", title=t.title,
                                    body=t.markdown, size=len(t.markdown.encode("utf-8")),
                                    visibility=t.visibility if t.visibility in VISIBILITIES else "private",
                                    created_at=t.created_at, updated_at=t.updated_at))
        db.delete(t)
        moved += 1
    if old:
        # Two workers (gunicorn --workers 2) can move the same rows at once:
        # the second finds them moved or gone, and leaves it to the first.
        try:
            db.commit()
        except SQLAlchemyError:
            db.rollback()
            return 0
    return moved


# ---------------------------------------------------------------- routes

@bp.get("/api/tutorials")
def list_tutorials():
    """Tutorials beyond the built-in ones on the Learn page: those published
    for everyone ("site"), and nothing else — a teacher's own are in their
    library, and their classes get them as assignments."""
    db = _db()
    try:
        user = _current_user(db)
        migrate(db)
        L = accounts.LibraryItem
        rows = db.query(L).filter(L.visibility == "site", *_rows()).all()
        seen, out = set(), []
        for t in sorted(rows, key=lambda t: t.title.lower()):
            # Plain notes taken in from an assignment aren't tutorials to follow.
            if t.id not in seen and is_tutorial(t.body):
                seen.add(t.id)
                out.append(_out(db, t, user))
        hidden = sorted(k for (k,) in db.query(HiddenBuiltin.key))
        return jsonify(tutorials=out, hidden=hidden, teacher=_is_teacher(user), admin=_is_admin(user))
    finally:
        db.close()


@bp.post("/api/tutorials/builtin/<name>/audience")
def builtin_audience(name):
    """A built-in on the Learn page ("site") or off it ("hidden"). An admin's
    choice, for the whole site: the built-ins are everyone's."""
    db = _db()
    try:
        user = _current_user(db)
        if not _is_admin(user):
            return err("Only an admin can do that.", 403)
        if builtin(name) is None:
            return err("There's no built-in tutorial called that.", 404)
        audience = (request.get_json(silent=True) or {}).get("audience")
        if audience not in ("site", "hidden"):
            return err("Choose Everyone or Hidden.", 400)
        row = db.get(HiddenBuiltin, name)
        if audience == "hidden" and row is None:
            db.add(HiddenBuiltin(key=name))
        elif audience == "site" and row is not None:
            db.delete(row)
        db.commit()
        return jsonify(ok=True, audience=audience)
    finally:
        db.close()


@bp.get("/api/tutorials/<slug>")
def get_tutorial(slug):
    db = _db()
    try:
        user = _current_user(db)
        migrate(db)
        t = _row(db, slug)
        if t is None or not _can_see(db, user, t):
            return err("There's no tutorial here.", 404)
        return jsonify(markdown=t.body, **_out(db, t, user))
    finally:
        db.close()


# Writing, changing and deleting tutorials is the library's (library.py,
# /api/library): the one place a tutorial's text changes. These routes only
# read them, for following.


@bp.post("/api/tutorials/step")
def step_done():
    """A student passed a step's checks (or reached the end). The checks run
    in their browser, so this trusts the page — and pays accordingly: a
    little XP once per step that has checks, ever, and a bonus once for
    finishing. A faked claim takes at most that, for tutorials they can open."""
    db = _db()
    try:
        user = _need_user(db)
        body = request.get_json(silent=True) or {}
        key = str(body.get("key") or "")[:60]
        md = markdown_for(db, user, key)
        if md is None:
            return err("There's no tutorial here.", 404)
        steps = steps_of(md)
        try:
            n = int(body.get("step"))
        except (TypeError, ValueError):
            return err("No such step.", 400)
        if not 0 <= n < len(steps):
            return err("No such step.", 400)
        if not rewards.earns_xp(user):
            return jsonify(xp=0)
        title = meta(md)["title"]
        got = 0
        if checks.blocks(steps[n], "check"):
            got += xp.award(db, user.id, "tutstep:%s:%d" % (key, n), xp.SELF_TEST_XP,
                            ("Tutorial step: %s, step %d" % (title, n + 1))[:200], APP_NAME)
        if n == len(steps) - 1:
            got += xp.award(db, user.id, "tutdone:%s" % key, xp.ALL_ANSWERED_XP,
                            ("Finished the tutorial %s" % title)[:200], APP_NAME)
        return jsonify(xp=got)
    finally:
        db.close()
