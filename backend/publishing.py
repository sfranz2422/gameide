"""
Publishing: playable links, the class gallery, Explore, likes, remixes,
reports and the approval queue (gamestore.Published and its tables).

Who may see a game, in one place (`_viewable`):
  unlisted   anyone with the link
  class      signed in, and its owner, a member of its class (enrolled by
             email, as PyIDE's rosters are), that class's teacher, or an admin
  public     anyone; listed on Explore only once a teacher (or an admin)
             approves it, or straight away from a teacher or an auto-approve
             class. Until then it plays like unlisted.
  taken down only its owner and its moderators

A game's moderators are the teachers of any class its owner is enrolled in,
and the admins (ADMIN_EMAILS, an environment variable like TEACHER_EMAILS,
so nobody can make themselves one through the site).

Privacy (the spec's FERPA section): a page shows a game's title and the
author name chosen when publishing — a first name by default — never an
email. Explore lists nothing but approved public games.
"""
import base64
import json
from datetime import timedelta
import os
import re
import secrets

from flask import Blueprint, Response, abort, jsonify, make_response, request, session
from sqlalchemy import func, or_

import accounts
import gamestore
from accounts import now
from gamestore import ClassSettings, GameAsset, GameProject, Like, Published, PublishedAsset, Report

bp = Blueprint("publishing", __name__)

#: The classes table is shared by PyIDE, WebIDE, FlaskIDE and GameIDE, each
#: class belonging to one (its `app`). A teacher brings the classes that use
#: GameIDE into GameIDE; only those count here — never a student's PyIDE
#: class, or a teacher's web design class.
APP_NAME = "gameide"


def _courses(db):
    return db.query(accounts.Course).filter(accounts.Course.app == APP_NAME)

# Set by init(): the app's database session factory and its signed-in user.
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


def admin_emails():
    return [e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()]


def is_admin(user) -> bool:
    return bool(user) and user.email.lower() in admin_emails()


def is_teacher(user) -> bool:
    return bool(user) and accounts.is_teacher(user.email)


def _need_user(db):
    user = _current_user(db)
    if user is None:
        fail("Sign in first.", 401)
    return user


# ---------------------------------------------------------------- classes and moderators

def classes_of(db, user):
    """GameIDE's classes a user is in (enrolled by email) or teaches."""
    if user is None:
        return []
    enrolled = (_courses(db).join(accounts.Enrollment, accounts.Enrollment.class_id == accounts.Course.id)
                .filter(func.lower(accounts.Enrollment.email) == user.email.lower()).all())
    taught = _courses(db).filter_by(teacher_id=user.id).all()
    return list({c.id: c for c in enrolled + taught}.values())


def _member(db, user, class_id) -> bool:
    return any(c.id == class_id for c in classes_of(db, user))


def _teachers_of(db, owner_id):
    """Ids of the teachers of every GameIDE class the owner is enrolled in."""
    owner = db.query(accounts.User).get(owner_id)
    if owner is None:
        return set()
    rows = (db.query(accounts.Course.teacher_id).join(accounts.Enrollment, accounts.Enrollment.class_id == accounts.Course.id)
            .filter(func.lower(accounts.Enrollment.email) == owner.email.lower(), accounts.Course.app == APP_NAME).all())
    return {r.teacher_id for r in rows}


def moderates(db, user, pub) -> bool:
    return bool(user) and (is_admin(user) or user.id in _teachers_of(db, pub.owner_id))


def _viewable(db, pub, user):
    """None if this person may play the game; otherwise (message, status) saying why not."""
    owner = user is not None and user.id == pub.owner_id
    if pub.taken_down and not (owner or moderates(db, user, pub)):
        return ("This game was taken down by a teacher.", 404)
    if pub.visibility == "class" and not owner:
        if user is None:
            return ("This game is for a class. Sign in to play it.", 401)
        if not (_member(db, user, pub.class_id) or moderates(db, user, pub)):
            return ("This game is only for its class.", 403)
    return None


def _pub_or_404(db, slug):
    pub = db.query(Published).filter_by(slug=slug).first()
    if pub is None:
        fail("There's no game here. It may have been unpublished.", 404)
    return pub


def _first_name(user) -> str:
    return (user.first_name or (user.name or "").split(" ")[0] or "A student")[:30]


# ---------------------------------------------------------------- publishing a project

def _clean_author(text, user):
    text = re.sub(r"\s+", " ", str(text or "")).strip()[:30]
    # A display name, not an address or a link.
    if not text or "@" in text or "/" in text:
        return _first_name(user)
    return text


def _settings(pub):
    return {
        "id": pub.slug,
        "url": f"/play/{pub.slug}",
        "title": pub.title,
        "description": pub.description,
        "author": pub.author,
        "tags": [t for t in pub.tags.split(",") if t],
        "allowRemix": bool(pub.allow_remix),
        "visibility": pub.visibility,
        "classId": pub.class_id,
        "status": pub.status,
        "takenDown": bool(pub.taken_down),
        "takedownNote": pub.takedown_note,
        "updated": pub.updated_at.isoformat() + "Z",
    }


@bp.get("/api/projects/<slug>/publish")
def publish_settings(slug):
    db = _db()
    try:
        user = _need_user(db)
        p = _own(db, user, slug)
        pub = db.query(Published).filter_by(project_id=p.id).first()
        return jsonify(
            published=_settings(pub) if pub else None,
            classes=[{"id": c.id, "name": c.name} for c in classes_of(db, user)],
            author=_first_name(user),
            tags=gamestore.TAGS,
            teacher=is_teacher(user) or is_admin(user),
        )
    finally:
        db.close()


def _own(db, user, slug):
    p = db.query(GameProject).filter_by(slug=slug).first()
    if p is None or p.deleted_at is not None:
        fail("There is no project here.", 404)
    if p.owner_id != user.id:
        fail("That project belongs to someone else.", 403)
    return p


def _thumbnail(data_url):
    if not data_url:
        return None
    m = re.match(r"^data:image/png;base64,([A-Za-z0-9+/=]+)$", str(data_url))
    if not m:
        fail("The game's picture must be a PNG.", 400)
    raw = base64.b64decode(m.group(1))
    if len(raw) > gamestore.MAX_THUMBNAIL_BYTES or gamestore.sniff_image(raw) != "image/png":
        fail("The game's picture is too big, or not a PNG.", 400)
    return raw


@bp.post("/api/projects/<slug>/publish")
def publish(slug):
    """Publish (or publish again) the project as saved on the server: the
    editor saves first, so what is published is what the student sees."""
    db = _db()
    try:
        user = _need_user(db)
        p = _own(db, user, slug)
        body = request.get_json(silent=True) or {}
        title = re.sub(r"\s+", " ", str(body.get("title") or "")).strip()[:80]
        if not title:
            return err("Give your game a title.", 400)
        visibility = body.get("visibility")
        if visibility not in ("unlisted", "class", "public"):
            return err("Choose who can play it.", 400)
        class_id = body.get("classId") if visibility == "class" else None
        if visibility == "class" and not (isinstance(class_id, int) and _member(db, user, class_id)):
            return err("Choose one of your classes.", 400)
        tags = [t for t in body.get("tags") or [] if t in gamestore.TAGS][:3]
        # The approval queue. A student's public game waits for a teacher —
        # again after every publish, so an approved game can't be swapped for
        # something else — unless one of their classes approves by itself.
        status = ""
        if visibility == "public":
            classes = classes_of(db, user)
            auto = db.query(ClassSettings).filter(ClassSettings.class_id.in_([c.id for c in classes] or [-1]),
                                                  ClassSettings.auto_approve == 1).first()
            status = "approved" if (is_teacher(user) or is_admin(user) or auto) else "pending"

        pub = db.query(Published).filter_by(project_id=p.id).first()
        if pub is None:
            count = db.query(func.count(Published.id)).filter_by(owner_id=user.id).scalar()
            if count >= gamestore.MAX_PUBLISHED_PER_USER:
                return err(f"You have {count} published games, the most one account can have. Unpublish one first.", 413)
            pub = Published(slug=secrets.token_urlsafe(8).replace("-", "a").replace("_", "b")[:10],
                            project_id=p.id, owner_id=user.id, data="")
            db.add(pub)

        data = json.loads(p.data)
        pub.title = title
        pub.description = str(body.get("description") or "")[:2000]
        pub.author = _clean_author(body.get("author"), user)
        pub.tags = ",".join(tags)
        pub.allow_remix = 1 if body.get("allowRemix", True) else 0
        pub.visibility = visibility
        pub.class_id = class_id
        pub.status = status
        pub.data = p.data
        thumb = _thumbnail(body.get("thumbnail"))
        if thumb is not None:
            pub.thumbnail = thumb
        if isinstance(data.get("remixOf"), dict):
            pub.remix_of = json.dumps(data["remixOf"])[:500]
        pub.updated_at = now()
        db.flush()

        # Copies of the files, as they are now.
        db.query(PublishedAsset).filter_by(published_id=pub.id).delete()
        wanted = gamestore.project_asset_ids(data)
        for a in db.query(GameAsset).filter(GameAsset.project_id == p.id, GameAsset.asset_id.in_(wanted or [""])).all():
            db.add(PublishedAsset(published_id=pub.id, asset_id=a.asset_id, content_type=a.content_type, data=a.data, size=a.size))
        db.commit()
        return jsonify(published=_settings(pub))
    finally:
        db.close()


@bp.delete("/api/projects/<slug>/publish")
def unpublish(slug):
    db = _db()
    try:
        user = _need_user(db)
        p = _own(db, user, slug)
        pub = db.query(Published).filter_by(project_id=p.id).first()
        if pub:
            _delete(db, pub)
            db.commit()
        return jsonify(ok=True)
    finally:
        db.close()


def _delete(db, pub):
    for table in (PublishedAsset, Like, Report):
        db.query(table).filter_by(published_id=pub.id).delete()
    db.delete(pub)


# ---------------------------------------------------------------- playing

def _info(db, pub, user):
    liked = user is not None and db.query(Like).filter_by(published_id=pub.id, user_id=user.id).first() is not None
    return {
        "id": pub.slug,
        "title": pub.title,
        "description": pub.description,
        "author": pub.author,
        "plays": pub.plays,
        "likes": pub.likes,
        "liked": liked,
        "allowRemix": bool(pub.allow_remix),
        "tags": [t for t in pub.tags.split(",") if t],
        "visibility": pub.visibility,
        "status": pub.status,
        "signedIn": user is not None,
        "canModerate": moderates(db, user, pub),
        "remixOf": json.loads(pub.remix_of) if pub.remix_of else None,
    }


@bp.get("/api/play/<slug>")
def play_info(slug):
    db = _db()
    try:
        user = _current_user(db)
        pub = _pub_or_404(db, slug)
        why = _viewable(db, pub, user)
        if why:
            return err(*why)
        return jsonify(info=_info(db, pub, user), project=json.loads(pub.data))
    finally:
        db.close()


@bp.get("/api/play/<slug>/assets/<asset_id>")
def play_asset(slug, asset_id):
    db = _db()
    try:
        user = _current_user(db)
        pub = _pub_or_404(db, slug)
        why = _viewable(db, pub, user)
        if why:
            return err(*why)
        a = db.query(PublishedAsset).filter_by(published_id=pub.id, asset_id=asset_id).first()
        if a is None:
            return err("That file isn't part of this game.", 404)
        r = Response(a.data, mimetype=a.content_type)
        # Publishing again replaces the copies, but never under an id with
        # different bytes (asset ids never change meaning), so a long cache
        # is safe; private, since a class game is not for everyone.
        r.headers["Cache-Control"] = "private, max-age=31536000, immutable"
        return r
    finally:
        db.close()


@bp.get("/api/play/<slug>/thumbnail")
def play_thumbnail(slug):
    db = _db()
    try:
        pub = _pub_or_404(db, slug)
        if _viewable(db, pub, _current_user(db)) or not pub.thumbnail:
            return err("No picture.", 404)
        r = Response(pub.thumbnail, mimetype="image/png")
        r.headers["Cache-Control"] = "private, max-age=300"
        return r
    finally:
        db.close()


@bp.post("/api/play/<slug>/played")
def played(slug):
    """Counts a play: once per browser session per game, so reloading doesn't count."""
    db = _db()
    try:
        pub = _pub_or_404(db, slug)
        if _viewable(db, pub, _current_user(db)):
            return err("Not yours to play.", 403)
        seen = session.get("played", [])
        if pub.slug not in seen:
            pub.plays += 1
            session["played"] = (seen + [pub.slug])[-200:]
            db.commit()
        return jsonify(plays=pub.plays)
    finally:
        db.close()


@bp.post("/api/play/<slug>/like")
def like(slug):
    db = _db()
    try:
        user = _need_user(db)
        pub = _pub_or_404(db, slug)
        if _viewable(db, pub, user):
            return err("Not yours to play.", 403)
        row = db.query(Like).filter_by(published_id=pub.id, user_id=user.id).first()
        if row:
            db.delete(row)
        else:
            db.add(Like(published_id=pub.id, user_id=user.id))
        db.flush()
        pub.likes = db.query(func.count(Like.id)).filter_by(published_id=pub.id).scalar()
        db.commit()
        return jsonify(liked=row is None, likes=pub.likes)
    finally:
        db.close()


@bp.post("/api/play/<slug>/remix")
def remix(slug):
    """Copies a published game into the viewer's own games, crediting where it came from."""
    db = _db()
    try:
        user = _need_user(db)
        pub = _pub_or_404(db, slug)
        why = _viewable(db, pub, user)
        if why:
            return err(*why)
        if not pub.allow_remix and pub.owner_id != user.id:
            return err("Its author didn't allow remixing this game.", 403)
        count = db.query(func.count(GameProject.id)).filter_by(owner_id=user.id).filter(GameProject.deleted_at.is_(None)).scalar()
        if count >= gamestore.MAX_PROJECTS_PER_USER:
            return err("You have as many games as one account can keep. Delete some first.", 413)
        data = json.loads(pub.data)
        new_slug = secrets.token_hex(10)
        data["id"] = new_slug
        data["name"] = f"{pub.title} (remix)"[:200]
        data["remixOf"] = {"id": pub.slug, "title": pub.title, "author": pub.author}
        text = json.dumps(data, separators=(",", ":"))
        p = GameProject(slug=new_slug, owner_id=user.id, name=data["name"], data=text, size=len(text.encode()),
                        version=1, schema_version=int(data.get("schemaVersion") or 1))
        db.add(p)
        db.flush()
        for a in db.query(PublishedAsset).filter_by(published_id=pub.id).all():
            db.add(GameAsset(project_id=p.id, asset_id=a.asset_id, content_type=a.content_type, data=a.data, size=a.size))
        db.commit()
        return jsonify(slug=new_slug)
    finally:
        db.close()


@bp.post("/api/play/<slug>/report")
def report(slug):
    db = _db()
    try:
        user = _need_user(db)
        pub = _pub_or_404(db, slug)
        if _viewable(db, pub, user):
            return err("Not yours to play.", 403)
        reason = str((request.get_json(silent=True) or {}).get("reason") or "").strip()[:500]
        if not reason:
            return err("Say what's wrong with it.", 400)
        recent = db.query(func.count(Report.id)).filter_by(user_id=user.id).filter(
            Report.created_at > now() - timedelta(hours=1)).scalar()
        if recent >= 10:
            return err("That's a lot of reports in an hour. Try again later, or tell your teacher.", 429)
        db.add(Report(published_id=pub.id, user_id=user.id, reason=reason))
        db.commit()
        return jsonify(ok=True)
    finally:
        db.close()


# ---------------------------------------------------------------- Explore and class galleries

def _card(pub):
    return {"id": pub.slug, "title": pub.title, "author": pub.author, "plays": pub.plays, "likes": pub.likes,
            "tags": [t for t in pub.tags.split(",") if t], "thumbnail": bool(pub.thumbnail), "featured": bool(pub.featured)}


PAGE = 24


@bp.get("/api/explore")
def explore():
    """Approved public games: featured, newest or most played; search and a tag."""
    db = _db()
    try:
        q = db.query(Published).filter(Published.visibility == "public", Published.status == "approved", Published.taken_down == 0)
        text = str(request.args.get("q") or "").strip()[:80]
        if text:
            like_text = f"%{text.lower()}%"
            q = q.filter(or_(func.lower(Published.title).like(like_text), func.lower(Published.description).like(like_text)))
        tag = request.args.get("tag")
        if tag in gamestore.TAGS:
            q = q.filter(Published.tags.like(f"%{tag}%"))
        sort = request.args.get("sort", "new")
        if sort == "featured":
            q = q.filter(Published.featured == 1).order_by(Published.updated_at.desc())
        elif sort == "popular":
            q = q.order_by(Published.plays.desc(), Published.likes.desc())
        else:
            q = q.order_by(Published.created_at.desc(), Published.id.desc())
        page = max(0, int(request.args.get("page", 0) or 0))
        rows = q.offset(page * PAGE).limit(PAGE + 1).all()
        return jsonify(games=[_card(p) for p in rows[:PAGE]], more=len(rows) > PAGE, tags=gamestore.TAGS)
    finally:
        db.close()


@bp.get("/api/my-classes")
def my_classes():
    db = _db()
    try:
        user = _current_user(db)
        return jsonify(classes=[{"id": c.id, "name": c.name, "teaching": c.teacher_id == (user.id if user else None)}
                                for c in classes_of(db, user)])
    finally:
        db.close()


@bp.get("/api/gallery/<int:class_id>")
def gallery(class_id):
    """A class's gallery: games published to it, and its members' approved public games."""
    db = _db()
    try:
        user = _need_user(db)
        course = _courses(db).filter(accounts.Course.id == class_id).first()
        if course is None or not (_member(db, user, class_id) or is_admin(user)):
            return err("That isn't one of your classes.", 403)
        emails = [e.email.lower() for e in db.query(accounts.Enrollment).filter_by(class_id=class_id).all()]
        members = [u.id for u in db.query(accounts.User).filter(func.lower(accounts.User.email).in_(emails or [""])).all()]
        rows = (db.query(Published).filter(Published.taken_down == 0).filter(or_(
            Published.class_id == class_id,
            (Published.visibility == "public") & (Published.status == "approved") & Published.owner_id.in_(members or [-1]),
        )).order_by(Published.updated_at.desc()).limit(200).all())
        return jsonify(name=course.name, games=[_card(p) for p in rows])
    finally:
        db.close()


# ---------------------------------------------------------------- moderation

def _scope(db, user):
    """The published games this person moderates: their students' (admins: every one)."""
    q = db.query(Published)
    if is_admin(user):
        return q
    taught = [c.id for c in _courses(db).filter_by(teacher_id=user.id).all()]
    emails = [e.email.lower() for e in db.query(accounts.Enrollment).filter(accounts.Enrollment.class_id.in_(taught or [-1])).all()]
    ids = [u.id for u in db.query(accounts.User).filter(func.lower(accounts.User.email).in_(emails or [""])).all()]
    return q.filter(Published.owner_id.in_(ids or [-1]))


def _need_moderator(db):
    user = _need_user(db)
    if not (is_teacher(user) or is_admin(user)):
        fail("Only teachers can see this.", 403)
    return user


@bp.get("/api/moderation")
def moderation():
    db = _db()
    try:
        user = _need_moderator(db)
        games = _scope(db, user).order_by(Published.updated_at.desc()).limit(500).all()
        ids = [g.id for g in games]
        reports = (db.query(Report).filter(Report.published_id.in_(ids or [-1]), Report.handled == 0)
                   .order_by(Report.created_at.desc()).all())
        by_game = {}
        for r in reports:
            by_game.setdefault(r.published_id, []).append(r.reason)
        owners = {u.id: u for u in db.query(accounts.User).filter(accounts.User.id.in_([g.owner_id for g in games] or [-1])).all()}

        def row(g):
            o = owners.get(g.owner_id)
            return {**_card(g), "visibility": g.visibility, "status": g.status, "takenDown": bool(g.taken_down),
                    "owner": o.display_name() if o else "", "reports": by_game.get(g.id, []), "updated": g.updated_at.isoformat() + "Z"}

        taught = _courses(db).filter_by(teacher_id=user.id).all()
        auto = {s.class_id for s in db.query(ClassSettings).filter(ClassSettings.class_id.in_([c.id for c in taught] or [-1]),
                                                                    ClassSettings.auto_approve == 1).all()}
        return jsonify(
            pending=[row(g) for g in games if g.visibility == "public" and g.status == "pending" and not g.taken_down],
            reported=[row(g) for g in games if g.id in by_game],
            games=[row(g) for g in games],
            classes=[{"id": c.id, "name": c.name, "autoApprove": c.id in auto} for c in taught],
            admin=is_admin(user),
        )
    finally:
        db.close()


@bp.post("/api/moderation/<slug>")
def moderate(slug):
    """approve, reject, takedown, restore, dismiss (the reports), feature, unfeature (admins)."""
    db = _db()
    try:
        user = _need_moderator(db)
        pub = _pub_or_404(db, slug)
        if not moderates(db, user, pub):
            return err("That game isn't one of your students'.", 403)
        body = request.get_json(silent=True) or {}
        action = body.get("action")
        if action == "approve":
            pub.status = "approved"
        elif action == "reject":
            pub.status = "rejected"
        elif action == "takedown":
            pub.taken_down = 1
            pub.takedown_note = str(body.get("note") or "")[:300]
            db.query(Report).filter_by(published_id=pub.id).update({"handled": 1})
        elif action == "restore":
            pub.taken_down = 0
            pub.takedown_note = ""
        elif action == "dismiss":
            db.query(Report).filter_by(published_id=pub.id).update({"handled": 1})
        elif action in ("feature", "unfeature") and is_admin(user):
            pub.featured = 1 if action == "feature" else 0
        else:
            return err("That isn't something a game can be.", 400)
        db.commit()
        return jsonify(ok=True)
    finally:
        db.close()


@bp.post("/api/moderation/classes/<int:class_id>")
def class_setting(class_id):
    db = _db()
    try:
        user = _need_moderator(db)
        course = _courses(db).filter(accounts.Course.id == class_id).first()
        if course is None or course.teacher_id != user.id:
            return err("That isn't one of your classes.", 403)
        s = db.query(ClassSettings).filter_by(class_id=class_id).first()
        if s is None:
            s = ClassSettings(class_id=class_id)
            db.add(s)
        s.auto_approve = 1 if (request.get_json(silent=True) or {}).get("autoApprove") else 0
        db.commit()
        return jsonify(autoApprove=bool(s.auto_approve))
    finally:
        db.close()
