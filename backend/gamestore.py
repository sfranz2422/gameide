"""
GameIDE's own tables, in the database it shares with PyIDE, WebIDE and
FlaskIDE.

They are declared on `accounts.Base`, so `accounts.create_all()` makes them
along with the shared tables — but only in this app, because only this app
imports this module. That is the point: accounts.py, which must stay
byte-identical in all four repos, needed no change for GameIDE's projects,
and the other three apps never see these tables. Every name starts with
`gameide_` so nothing can collide with theirs.

    gameide_projects   one row per project: the JSON, and who owns it
    gameide_assets     its pictures (and, later, sounds), as bytes
    gameide_versions   snapshots of the JSON, for version history

Pictures live in Postgres rather than on a disk for the reason PyIDE's
`images` table does: Render's disk is wiped on every deploy, and a database
row is backed up with everything else.
"""
from sqlalchemy import Column, DateTime, ForeignKey, Integer, LargeBinary, String, Text, UniqueConstraint

import accounts
from accounts import Base, now

# ---------------------------------------------------------------- limits
# Generous for a class game, small enough that one student can't fill the
# shared database. The error each produces names the limit in words.

MAX_PROJECT_BYTES = 2_000_000          # the JSON: objects, events, rooms
MAX_ASSET_BYTES = 2_000_000            # one picture
MAX_PROJECT_ASSET_BYTES = 40_000_000   # all of one project's pictures
MAX_USER_BYTES = 200_000_000           # everything one person stores
MAX_PROJECTS_PER_USER = 300
AUTO_SNAPSHOT_SECONDS = 10 * 60        # an automatic version at most this often
KEEP_AUTO_SNAPSHOTS = 40               # per project; ones made by hand are kept
KEEP_MANUAL_SNAPSHOTS = 100

# Real image files only, judged by their first bytes — never by the name or
# the type the browser claimed, either of which a student can make up.
IMAGE_MAGIC = [
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"GIF87a", "image/gif"),
    (b"GIF89a", "image/gif"),
]


def sniff_image(data: bytes):
    """The image type these bytes really are, or None."""
    for magic, kind in IMAGE_MAGIC:
        if data.startswith(magic):
            return kind
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


class GameProject(Base):
    """A student's (or teacher's) game.

    `slug` is the project's own id — the one inside its JSON, made by the
    browser — so a project made while offline, or signed out, keeps its id
    when it reaches the server. Ids are random and long, but a slug already
    owned by someone else is refused (the browser then picks a new one):
    knowing a project's id must never be a way to write to it.

    `version` goes up by one on every save. A save says which version it
    started from; if that is not the current one, another tab or computer
    saved in between, and the row being replaced is kept as a snapshot
    before it is overwritten — so two tabs can never quietly destroy each
    other's work, only make history longer.
    """
    __tablename__ = "gameide_projects"

    id = Column(Integer, primary_key=True)
    slug = Column(String(32), unique=True, index=True, nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    name = Column(String(200), nullable=False, default="")
    data = Column(Text, nullable=False)
    schema_version = Column(Integer, nullable=False, default=1)
    version = Column(Integer, nullable=False, default=1)
    size = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=now)
    updated_at = Column(DateTime, nullable=False, default=now)
    #: Set instead of deleting: a student who deletes the wrong game can be
    #: helped. Every query for "their projects" leaves these out.
    deleted_at = Column(DateTime, nullable=True)


class GameAsset(Base):
    """One picture belonging to a project. Assets never change once
    uploaded (a new picture gets a new id), so they are served with a
    year's cache and an asset id can't be overwritten."""
    __tablename__ = "gameide_assets"
    __table_args__ = (UniqueConstraint("project_id", "asset_id", name="uq_gameide_asset"),)

    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("gameide_projects.id"), index=True, nullable=False)
    asset_id = Column(String(32), nullable=False)
    content_type = Column(String(40), nullable=False)
    data = Column(LargeBinary, nullable=False)
    size = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=now)


class GameVersion(Base):
    """A snapshot of a project's JSON.

    kind: "manual" (Save a version), "auto" (every AUTO_SNAPSHOT_SECONDS of
    saving), "replaced" (another tab's save overwrote it), "restore" (made
    just before going back to an older version). Only "auto" ones are pruned.
    """
    __tablename__ = "gameide_versions"

    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("gameide_projects.id"), index=True, nullable=False)
    version = Column(Integer, nullable=False)
    kind = Column(String(16), nullable=False, default="auto")
    label = Column(String(200), nullable=False, default="")
    data = Column(Text, nullable=False)
    size = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=now)


def create_all(engine):
    """accounts.create_all, which now also makes the tables above."""
    accounts.create_all(engine)
