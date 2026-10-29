"""
The server's checks: signing in, projects, pictures, history, the idle
sign-out and the headers. A plain script, as in PyIDE — prints ok/FAIL per
check and exits non-zero on any failure:

    backend/.venv/bin/python backend/tests/test_server.py

Runs against a throwaway SQLite database and Flask's test client; nothing
here touches the real one.
"""
import base64
import json
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
BACKEND = HERE.parent
DB = Path(tempfile.mkdtemp()) / "test.db"
os.environ["GAMEIDE_TEST_DATABASE_URL"] = f"sqlite:///{DB}"
os.environ["GAMEIDE_DEV_LOGIN"] = "1"
os.environ["TEACHER_EMAILS"] = "teacher@example.com"
os.environ.pop("DATABASE_URL", None)
os.environ.pop("GOOGLE_CLIENT_ID", None)
sys.path.insert(0, str(BACKEND))

import app as server  # noqa: E402
import gamestore  # noqa: E402
import accounts  # noqa: E402

failures = []


def check(name, cond, detail=""):
    print(("ok   " if cond else "FAIL ") + name + ("" if cond else f"  — {detail}"))
    if not cond:
        failures.append(name)


PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")


def project(slug, name="Game", **extra):
    d = {"format": "gameide-project", "schemaVersion": 1, "id": slug, "name": name, "objects": [], "sprites": [],
         "rooms": [], "scripts": [], "settings": {"stepsPerSecond": 60}}
    d.update(extra)
    return d


def client(email=None):
    c = server.app.test_client()
    if email:
        c.get("/dev/login?email=" + email)
    return c


def put(c, slug, data, base, packed=False):
    body = {"data": data, "base": base}
    if packed:
        body = {"_packed": base64.b64encode(json.dumps(body).encode()).decode()}
    return c.put(f"/api/projects/{slug}", json=body)


# ---------------------------------------------------------------- signing in
anon = client()
me = anon.get("/api/me").get_json()
check("signed out: /api/me says so", me["user"] is None and me["login_enabled"] is True)
r = anon.get("/api/projects")
check("signed out: projects need signing in, in words", r.status_code == 401 and "Sign in" in r.get_json()["error"])

alice = client("alice@example.com")
me = alice.get("/api/me").get_json()
check("dev sign-in makes a users row and a session", me["user"] and me["user"]["email"] == "alice@example.com")
check("a student is not a teacher, and is signed out when idle", me["user"]["teacher"] is False and me["idle_seconds"] > 0)
teacher = client("teacher@example.com")
tme = teacher.get("/api/me").get_json()
check("TEACHER_EMAILS makes a teacher, never idle-signed-out", tme["user"]["teacher"] is True and tme["idle_seconds"] == 0)

r = client().get("/dev/login?email=x@example.com&next=//evil.example/")
check("sign-in never redirects off the site", r.status_code == 302 and r.headers["Location"] == "/", r.headers.get("Location"))

# The dev sign-in must not exist on the real server, even if the flag leaks there.
out = subprocess.run([sys.executable, "-c", "import app; print(app.DEV_LOGIN)"], cwd=BACKEND, capture_output=True,
                     text=True, env={**os.environ, "DATABASE_URL": f"sqlite:///{DB}", "GAMEIDE_DEV_LOGIN": "1"})
check("dev sign-in is off whenever DATABASE_URL is set", out.stdout.strip().endswith("False"), out.stdout + out.stderr)

# ---------------------------------------------------------------- saving
r = put(alice, "aaa1", project("aaa1", "First"), 0)
check("a new project is saved at version 1", r.status_code == 200 and r.get_json() == {"version": 1, "replaced": False}, r.data)
r = alice.get("/api/projects/aaa1")
check("and comes back as it was sent", r.get_json()["data"]["name"] == "First" and r.get_json()["version"] == 1)
lst = alice.get("/api/projects").get_json()
check("it is in the list, with its name", [p["name"] for p in lst["projects"]] == ["First"] and lst["used"] > 0)

r = put(alice, "aaa1", project("aaa1", "First", objects=[{"id": "o"}]), 1)
check("saving from the current version moves it on", r.get_json() == {"version": 2, "replaced": False}, r.data)
r = put(alice, "aaa1", project("aaa1", "First", objects=[{"id": "o"}]), 2)
check("saving the same thing again changes nothing", r.get_json()["version"] == 2)

r = put(alice, "aaa1", project("aaa1", "From the other tab"), 1)
check("a save from an older version is accepted…", r.get_json() == {"version": 3, "replaced": True}, r.data)
versions = alice.get("/api/projects/aaa1/versions").get_json()["versions"]
replaced = [v for v in versions if v["kind"] == "replaced"]
check("…and what it replaced is kept in history", len(replaced) == 1 and replaced[0]["version"] == 2, versions)
old = alice.get(f"/api/projects/aaa1/versions/{replaced[0]['id']}").get_json()
check("…and can be read back", old["data"]["objects"] == [{"id": "o"}])

r = put(alice, "aaa2", project("aaa2", "Packed <script>alert(1)</script> def on_step(self):"), 0, packed=True)
check("a packed body (what the firewall sees) is read", r.status_code == 200 and
      alice.get("/api/projects/aaa2").get_json()["data"]["name"].startswith("Packed"))

r = put(alice, "zzz9", project("other-id"), 0)
check("the id in the URL must be the project's own", r.status_code == 400)
r = put(alice, "aaa3", {"format": "something-else", "id": "aaa3"}, 0)
check("only GameIDE projects are accepted", r.status_code == 400)
big = project("aaa4", rooms=[{"x": "y" * 2_100_000}])
r = put(alice, "aaa4", big, 0)
check("a project over the limit is refused, with the sizes in words",
      r.status_code == 413 and "MB" in r.get_json()["error"], r.data[:200])

# ---------------------------------------------------------------- other people's projects
bob = client("bob@example.com")
check("someone else's project can't be read", bob.get("/api/projects/aaa1").status_code == 403)
r = put(bob, "aaa1", project("aaa1", "Mine now"), 3)
check("…or written: its id is taken", r.status_code == 409)
check("…and it is untouched", alice.get("/api/projects/aaa1").get_json()["data"]["name"] == "From the other tab")
check("…nor its history", bob.get("/api/projects/aaa1/versions").status_code == 403)
check("…nor its pictures", bob.put("/api/projects/aaa1/assets/p1", data=PNG).status_code == 403)
check("bob's list is his own", bob.get("/api/projects").get_json()["projects"] == [])

# ---------------------------------------------------------------- pictures
r = alice.put("/api/projects/aaa1/assets/pic1", data=PNG, content_type="image/png")
check("a PNG uploads", r.status_code == 201, r.data)
r = alice.get("/api/projects/aaa1/assets/pic1")
check("and comes back byte for byte, as a PNG, cached for good",
      r.data == PNG and r.mimetype == "image/png" and "immutable" in r.headers["Cache-Control"])
check("sending it again (a retry) is fine", alice.put("/api/projects/aaa1/assets/pic1", data=PNG).status_code == 200)
check("different bytes can't take an existing id",
      alice.put("/api/projects/aaa1/assets/pic1", data=PNG + b"x").status_code == 409)
r = alice.put("/api/projects/aaa1/assets/pic2", data=b"<?php echo 1; ?>", content_type="image/png")
check("a file that isn't a picture is refused, whatever it claims", r.status_code == 415, r.data)
r = alice.put("/api/projects/aaa1/assets/pic3", data=b"\x89PNG\r\n\x1a\n" + b"0" * (gamestore.MAX_ASSET_BYTES + 1))
check("a picture over the limit is refused", r.status_code == 413)
# Sounds and fonts, judged by their bytes like pictures; sounds may be bigger.
WAV = b"RIFF\x24\x00\x00\x00WAVEfmt " + b"\x00" * 28
check("a WAV sound is accepted", alice.put("/api/projects/aaa1/assets/snd1", data=WAV).status_code == 201)
r = alice.get("/api/projects/aaa1/assets/snd1")
check("…and comes back as audio", r.status_code == 200 and r.mimetype == "audio/wav", r.mimetype)
check("an MP3 (ID3 tag) is accepted", alice.put("/api/projects/aaa1/assets/snd2", data=b"ID3\x04\x00" + b"\x00" * 50).status_code == 201)
check("an OGG is accepted", alice.put("/api/projects/aaa1/assets/snd3", data=b"OggS" + b"\x00" * 50).status_code == 201)
check("a font (OTF) is accepted", alice.put("/api/projects/aaa1/assets/fnt1", data=b"OTTO" + b"\x00" * 50).status_code == 201)
r = alice.put("/api/projects/aaa1/assets/snd4", data=b"ID3" + b"\x00" * 3_000_000)
check("a 3 MB sound is fine (music)", r.status_code == 201, r.status_code)
r = alice.put("/api/projects/aaa1/assets/pic9", data=PNG + b"\x00" * 3_000_000)
check("…but a 3 MB picture is too big", r.status_code == 413 and "picture" in r.get_json()["error"], r.status_code)
r = alice.put("/api/projects/aaa1/assets/snd5", data=b"ID3" + b"\x00" * (gamestore.MAX_SOUND_BYTES + 1))
check("a sound over its limit is refused, by name", r.status_code == 413 and "sound" in r.get_json()["error"], r.status_code)
r = alice.put("/api/projects/aaa1/assets/txt1", data=b"just some text pretending to be a song")
check("anything else is refused, saying what is allowed", r.status_code == 415 and "MP3" in r.get_json()["error"])
check("a bad asset id is refused", alice.put("/api/projects/aaa1/assets/../x", data=PNG).status_code in (400, 404))

# ---------------------------------------------------------------- history
check("Save a version keeps a snapshot", alice.post("/api/projects/aaa1/versions", json={"label": "Before bosses"}).status_code == 201)
manual = [v for v in alice.get("/api/projects/aaa1/versions").get_json()["versions"] if v["kind"] == "manual"]
check("…with its label", manual and manual[0]["label"] == "Before bosses", manual)
put(alice, "aaa1", project("aaa1", "Broken"), 3)
r = alice.post(f"/api/projects/aaa1/versions/{manual[0]['id']}/restore")
check("restoring brings the old version back as the current one",
      r.status_code == 200 and r.get_json()["data"]["name"] == "From the other tab" and
      alice.get("/api/projects/aaa1").get_json()["data"]["name"] == "From the other tab")
kinds = [v["kind"] for v in alice.get("/api/projects/aaa1/versions").get_json()["versions"]]
check("…and keeps what was there before the restore", kinds[0] == "restore", kinds)
got = alice.get("/api/projects/aaa1/versions").get_json()["versions"]
before = alice.get(f"/api/projects/aaa1/versions/{got[0]['id']}").get_json()
check("…which is the version restored over", before["data"]["name"] == "Broken")

# Automatic snapshots: at most one per interval, and only the newest kept.
gamestore.AUTO_SNAPSHOT_SECONDS = -1  # every changed save makes one
gamestore.KEEP_AUTO_SNAPSHOTS = 3
v = alice.get("/api/projects/aaa1").get_json()["version"]
for i in range(6):
    v = put(alice, "aaa1", project("aaa1", f"Edit {i}"), v).get_json()["version"]
autos = [x for x in alice.get("/api/projects/aaa1/versions").get_json()["versions"] if x["kind"] == "auto"]
check("automatic snapshots are made as you save, and pruned to the newest", len(autos) == 3, len(autos))
check("hand-made snapshots are never pruned with them",
      any(x["kind"] == "manual" for x in alice.get("/api/projects/aaa1/versions").get_json()["versions"]))
gamestore.AUTO_SNAPSHOT_SECONDS = 10 * 60
gamestore.KEEP_AUTO_SNAPSHOTS = 40  # or pruning would hide an extra snapshot below
before = len(alice.get("/api/projects/aaa1/versions").get_json()["versions"])
v = put(alice, "aaa1", project("aaa1", "Quick edit"), v).get_json()["version"]
after = len(alice.get("/api/projects/aaa1/versions").get_json()["versions"])
check("within the interval, saving makes no snapshot", before == after, (before, after))

# ---------------------------------------------------------------- deleting
check("deleting works", alice.delete("/api/projects/aaa2").status_code == 200)
check("a deleted project leaves the list", "aaa2" not in [p["id"] for p in alice.get("/api/projects").get_json()["projects"]])
check("…and can't be opened", alice.get("/api/projects/aaa2").status_code == 404)
r = put(alice, "aaa2", project("aaa2", "Saved from an open tab"), 1)
check("…but a tab still open on it saves it back rather than losing the work",
      r.status_code == 200 and "aaa2" in [p["id"] for p in alice.get("/api/projects").get_json()["projects"]])

# ---------------------------------------------------------------- the idle sign-out
s = client("idle@example.com")
with s.session_transaction() as sess:
    sess["act"] = int(time.time()) - server.STUDENT_IDLE_SECONDS - 5
check("a student idle too long is signed out", s.get("/api/me").get_json()["user"] is None)
s = client("busy@example.com")
with s.session_transaction() as sess:
    sess["act"] = int(time.time()) - 600
s.get("/api/projects")
with s.session_transaction() as sess:
    polled = sess["act"]
s.post("/api/alive")
with s.session_transaction() as sess:
    beat = sess["act"]
check("polling (a GET to /api/) is not activity", int(time.time()) - polled >= 599)
check("the page's beat (a POST) is", int(time.time()) - beat < 5)
t = client("teacher@example.com")
with t.session_transaction() as sess:
    sess["act"] = int(time.time()) - server.STUDENT_IDLE_SECONDS - 5
check("a teacher is never signed out for being idle", t.get("/api/me").get_json()["user"] is not None)

# ---------------------------------------------------------------- headers
for path in ("/api/me", "/", "/healthz"):
    r = anon.get(path)
    check(f"{path} is sent cross-origin isolated",
          r.headers.get("Cross-Origin-Opener-Policy") == "same-origin"
          and r.headers.get("Cross-Origin-Embedder-Policy") == "credentialless")

# ---------------------------------------------------------------- publishing
os.environ["ADMIN_EMAILS"] = "admin@example.com"
admin = client("admin@example.com")
carol = client("carol@example.com")
other_teacher = client("teacher2@example.com")
os.environ["TEACHER_EMAILS"] = "teacher@example.com,teacher2@example.com"
db = server.SessionLocal()
tid = tme["user"]["id"]
period4 = accounts.Course(teacher_id=tid, name="Period 4", app="gameide")
db.add(period4)
db.flush()
for email in ("alice@example.com", "carol@example.com"):
    db.add(accounts.Enrollment(class_id=period4.id, email=email, name=email.split("@")[0]))
db.add(accounts.Course(teacher_id=tid, name="Period 7", app="gameide"))  # a class of the teacher's alice isn't in
# Alice's programming class is PyIDE's: it must never show up in GameIDE.
pyclass = accounts.Course(teacher_id=tid, name="Programming 1", app="pyide")
db.add(pyclass)
db.flush()
db.add(accounts.Enrollment(class_id=pyclass.id, email="alice@example.com", name="alice"))
db.commit()
PYCLASS = pyclass.id
P4 = period4.id
db.close()

GAME = project("pub1", "Coin Run", sprites=[{"frames": ["pic1"]}])
check("a game to publish is saved", put(alice, "pub1", GAME, 0).status_code == 200)
listing = {x["id"]: x for x in alice.get("/api/projects").get_json()["projects"]}
check("My games lists a game's size, not yet published", listing["pub1"]["size"] > 0 and listing["pub1"]["published"] is None)
put(alice, "ico1", project("ico1", "With an icon", sprites=[{"name": "hero", "frames": ["h1"]}, {"name": "Icon", "frames": ["i1", "i2"]}]), 0)
check("…and its picture: the first frame of the sprite named icon",
      {x["id"]: x for x in alice.get("/api/projects").get_json()["projects"]}["ico1"]["icon"] == "i1")
alice.put("/api/projects/pub1/assets/pic1", data=PNG)
settings = alice.get("/api/projects/pub1/publish").get_json()
check("publishing offers the student's own classes", [c["name"] for c in settings["classes"]] == ["Period 4"], settings["classes"])
check("…and their first name as the author, never their email", settings["author"] and "@" not in settings["author"])
check("another editor's classes are never offered (PyIDE's Programming 1)", "Programming 1" not in [c["name"] for c in alice.get("/api/my-classes").get_json()["classes"]])
check("…nor can a game be published to one", alice.post("/api/projects/pub1/publish", json={"title": "x", "visibility": "class", "classId": PYCLASS}).status_code == 400)
check("…nor its gallery be opened through GameIDE", alice.get(f"/api/gallery/{PYCLASS}").status_code == 403)

r = alice.post("/api/projects/pub1/publish", json={"title": "Coin Run", "visibility": "unlisted", "author": "alice@example.com"})
pub = r.get_json()["published"]
SLUG = pub["id"]
check("publishing gives a play link", r.status_code == 200 and pub["url"] == f"/play/{SLUG}", r.get_json())
check("an email as the author name is replaced by a first name", "@" not in pub["author"])
r = anon.get(f"/api/play/{SLUG}")
check("an unlisted game plays for anyone with the link, signed out too", r.status_code == 200 and r.get_json()["project"]["name"] == "Coin Run")
check("…and its page holds no email address", "@example.com" not in r.get_data(as_text=True))
check("its files come with it", anon.get(f"/api/play/{SLUG}/assets/pic1").data == PNG)
check("…and only its own", anon.get(f"/api/play/{SLUG}/assets/nope").status_code == 404)
check("someone else can't publish your project", bob.post("/api/projects/pub1/publish", json={"title": "x", "visibility": "unlisted"}).status_code == 403)

# A snapshot: the student keeps working; players see the published version until it's published again.
put(alice, "pub1", project("pub1", "Coin Run 2", sprites=[{"frames": ["pic1"]}]), 1)
check("players see the published version, not the one being edited", anon.get(f"/api/play/{SLUG}").get_json()["project"]["name"] == "Coin Run")
alice.post("/api/projects/pub1/publish", json={"title": "Coin Run", "visibility": "unlisted"})
check("…until it is published again", anon.get(f"/api/play/{SLUG}").get_json()["project"]["name"] == "Coin Run 2")

# Class games: members, its teacher and admins only.
r = alice.post("/api/projects/pub1/publish", json={"title": "Coin Run", "visibility": "class", "classId": P4 + 1})
check("a game can't go to a class its author isn't in", r.status_code == 400)
alice.post("/api/projects/pub1/publish", json={"title": "Coin Run", "visibility": "class", "classId": P4})
check("a class game needs signing in", anon.get(f"/api/play/{SLUG}").status_code == 401)
check("…is closed to someone outside the class", bob.get(f"/api/play/{SLUG}").status_code == 403)
check("…open to a classmate", carol.get(f"/api/play/{SLUG}").status_code == 200)
check("…to its teacher", teacher.get(f"/api/play/{SLUG}").status_code == 200)
check("…and to an admin", admin.get(f"/api/play/{SLUG}").status_code == 200)
check("…and its files are closed the same way", bob.get(f"/api/play/{SLUG}/assets/pic1").status_code == 403)
g = carol.get(f"/api/gallery/{P4}").get_json()
check("it is in the class's gallery", [x["id"] for x in g["games"]] == [SLUG], g)
check("the gallery is only for its class", bob.get(f"/api/gallery/{P4}").status_code == 403)

# Public: waits for a teacher, then is on Explore.
r = alice.post("/api/projects/pub1/publish", json={"title": "Coin Run", "visibility": "public", "tags": ["arcade", "nonsense"]})
check("a student's public game waits for approval", r.get_json()["published"]["status"] == "pending")
check("…with only real tags kept", r.get_json()["published"]["tags"] == ["arcade"])
check("…and isn't on Explore yet", SLUG not in [x["id"] for x in anon.get("/api/explore").get_json()["games"]])
check("…though its link plays", anon.get(f"/api/play/{SLUG}").status_code == 200)
mod = teacher.get("/api/moderation").get_json()
check("its teacher sees it waiting", [x["id"] for x in mod["pending"]] == [SLUG], mod["pending"])
check("students can't open the approval queue", alice.get("/api/moderation").status_code == 403)
check("another class's teacher can't approve it", other_teacher.post(f"/api/moderation/{SLUG}", json={"action": "approve"}).status_code == 403)
check("its teacher approves it", teacher.post(f"/api/moderation/{SLUG}", json={"action": "approve"}).status_code == 200)
listed = anon.get("/api/explore?sort=new").get_json()["games"]
check("…and then it is on Explore, for anyone", [x["id"] for x in listed] == [SLUG] and listed[0]["author"] != "alice@example.com", listed)
check("Explore searches titles", [x["id"] for x in anon.get("/api/explore?q=coin").get_json()["games"]] == [SLUG])
check("…and filters by tag", anon.get("/api/explore?tag=puzzle").get_json()["games"] == [])
r = alice.post("/api/projects/pub1/publish", json={"title": "Coin Run", "visibility": "public"})
check("publishing again puts it back in the queue (an approved game can't be swapped)", r.get_json()["published"]["status"] == "pending")
teacher.post(f"/api/moderation/classes/{P4}", json={"autoApprove": True})
r = alice.post("/api/projects/pub1/publish", json={"title": "Coin Run", "visibility": "public", "allowRemix": True})
check("a class set to approve by itself lets it straight onto Explore", r.get_json()["published"]["status"] == "approved")
check("only a class's own teacher can change that", other_teacher.post(f"/api/moderation/classes/{P4}", json={"autoApprove": False}).status_code == 403)
put(teacher, "tch1", project("tch1", "Demo"), 0)
r = teacher.post("/api/projects/tch1/publish", json={"title": "Demo", "visibility": "public"})
check("a teacher's public game needs no approval", r.get_json()["published"]["status"] == "approved")
check("My games shows that a game is published, and how", {x["id"]: x for x in alice.get("/api/projects").get_json()["projects"]}["pub1"]["published"] == "public")

# Playing: plays, likes, remixes, reports.
p1 = anon.post(f"/api/play/{SLUG}/played").get_json()["plays"]
p2 = anon.post(f"/api/play/{SLUG}/played").get_json()["plays"]
check("a play is counted once per visit", p2 == p1 == 1, (p1, p2))
check("liking needs signing in", anon.post(f"/api/play/{SLUG}/like").status_code == 401)
check("a like counts", bob.post(f"/api/play/{SLUG}/like").get_json() == {"liked": True, "likes": 1})
check("…and a second press takes it back", bob.post(f"/api/play/{SLUG}/like").get_json() == {"liked": False, "likes": 0})
r = bob.post(f"/api/play/{SLUG}/remix")
new = r.get_json().get("slug")
check("a remix copies the game into the remixer's games", r.status_code == 200 and new in [x["id"] for x in bob.get("/api/projects").get_json()["projects"]], r.get_json())
data = bob.get(f"/api/projects/{new}").get_json()["data"]
check("…crediting where it came from", data.get("remixOf") == {"id": SLUG, "title": "Coin Run", "author": pub["author"]} and data["id"] == new)
check("…with its files", bob.get(f"/api/projects/{new}/assets/pic1").data == PNG)
alice.post("/api/projects/pub1/publish", json={"title": "Coin Run", "visibility": "public", "allowRemix": False})
check("a game its author won't let be remixed can't be", bob.post(f"/api/play/{SLUG}/remix").status_code == 403)
check("reporting needs a reason", bob.post(f"/api/play/{SLUG}/report", json={"reason": " "}).status_code == 400)
check("a report is taken", bob.post(f"/api/play/{SLUG}/report", json={"reason": "bad words in it"}).status_code == 200)
mod = teacher.get("/api/moderation").get_json()
check("its teacher sees the report", [x["reports"] for x in mod["reported"]] == [["bad words in it"]], mod["reported"])
check("…and so does an admin", [x["id"] for x in admin.get("/api/moderation").get_json()["reported"]] == [SLUG])
teacher.post(f"/api/moderation/{SLUG}", json={"action": "takedown", "note": "language"})
check("a game taken down is gone for players", anon.get(f"/api/play/{SLUG}").status_code == 404)
check("…and from Explore", SLUG not in [x["id"] for x in anon.get("/api/explore").get_json()["games"]])
check("…but its author can still open it", alice.get(f"/api/play/{SLUG}").status_code == 200)
check("…and its reports are handled", teacher.get("/api/moderation").get_json()["reported"] == [])
teacher.post(f"/api/moderation/{SLUG}", json={"action": "restore"})
check("restoring brings it back", anon.get(f"/api/play/{SLUG}").status_code == 200)
check("only admins feature games", teacher.post(f"/api/moderation/{SLUG}", json={"action": "feature"}).status_code == 400)
admin.post(f"/api/moderation/{SLUG}", json={"action": "feature"})
check("…and featured games are on Explore's Featured", [x["id"] for x in anon.get("/api/explore?sort=featured").get_json()["games"]] == [SLUG])
check("unpublishing takes the link down", alice.delete("/api/projects/pub1/publish").status_code == 200 and anon.get(f"/api/play/{SLUG}").status_code == 404)

# ---------------------------------------------------------------- classes (classes.py)
import classes  # noqa: E402

# A class made on the page, with students added by email (no Classroom).
r = teacher.post("/api/classes", json={"name": "Game Design P2"})
GD = r.get_json()["id"]
check("a teacher makes a class", r.status_code == 201)
check("a student can't make one", alice.post("/api/classes", json={"name": "Mine"}).status_code == 403)
r = teacher.post(f"/api/classes/{GD}/students", json={"emails": "Dana@Example.com, erin@example.com\nnot-an-email"})
check("students are added by email, and a typo is named", r.status_code == 400 and "not-an-email" in r.get_json()["error"])
teacher.post(f"/api/classes/{GD}/students", json={"emails": "Dana@Example.com, erin@example.com dana@example.com"})
dana, erin = client("dana@example.com"), client("erin@example.com")
check("…once each, by lower-case email", sorted(s["email"] for s in teacher.get(f"/api/classes/{GD}").get_json()["students"]) == ["dana@example.com", "erin@example.com"])
check("a student finds the class they're on the roster of", "Game Design P2" in [c["name"] for c in dana.get("/api/classes").get_json()["classes"]])
check("…and not one they aren't", "Game Design P2" not in [c["name"] for c in alice.get("/api/classes").get_json()["classes"]])
check("…nor another editor's classes", "Programming 1" not in [c["name"] for c in teacher.get("/api/classes").get_json()["classes"]]
      and "Programming 1" not in [c["name"] for c in alice.get("/api/classes").get_json()["classes"]])
check("a class's page is closed to students not in it", alice.get(f"/api/classes/{GD}").status_code == 403)
check("…to another teacher", other_teacher.get(f"/api/classes/{GD}").status_code == 403)
check("…and another editor's class isn't here at all", teacher.get(f"/api/classes/{PYCLASS}").status_code == 404)
check("only its teacher changes its roster", dana.post(f"/api/classes/{GD}/students", json={"emails": "x@example.com"}).status_code == 403)

# An assignment from one of the teacher's games.
put(teacher, "lvl1", project("lvl1", "Platformer", sprites=[{"name": "hero", "frames": ["hero1"]}]), 0)
teacher.put("/api/projects/lvl1/assets/hero1", data=PNG)
r = teacher.post(f"/api/classes/{GD}/assignments", json={"title": "Make a level", "project": "lvl1", "outOf": 10, "dueAt": "2030-05-01T03:59"})
A = r.get_json().get("slug")
STARTER = r.get_json().get("starter")
check("a teacher makes an assignment from one of their games", r.status_code == 201 and A and STARTER != "lvl1", r.get_json())
check("…not from someone else's", teacher.post(f"/api/classes/{GD}/assignments", json={"title": "x", "project": "pub1"}).status_code == 400)
check("…and not in another teacher's class", other_teacher.post(f"/api/classes/{GD}/assignments", json={"title": "x", "project": "lvl1"}).status_code == 403)
check("the starter is kept off the teacher's My Games", STARTER not in [x["id"] for x in teacher.get("/api/projects").get_json()["projects"]])
put(teacher, "lvl1", project("lvl1", "Platformer, changed later"), 1)
check("…and is a copy: changing the game afterwards doesn't change it",
      teacher.get(f"/api/projects/{STARTER}").get_json()["data"]["name"] == "Make a level (starter)")
page = dana.get(f"/api/classes/{GD}").get_json()
item = [i for i in page["items"] if i["kind"] == "assignment"][0]
check("the class's page lists it for students, with its due date", item["slug"] == A and item["dueAt"] == "2030-05-01T03:59:00Z" and item["project"] is None, item)
check("a student can't see the class's roster", "students" not in page)

# Starting it: a copy of the starter, the same one every time.
r = dana.post(f"/api/assignments/{A}/start")
DP = r.get_json()["project"]
check("opening it gives a student their own copy", r.status_code == 201 and DP not in (STARTER, "lvl1"))
check("…the same game the second time", (dana.post(f"/api/assignments/{A}/start").get_json() or {}).get("project") == DP)
dgame = dana.get(f"/api/projects/{DP}").get_json()
check("…named for the assignment, with its id its own", dgame["data"]["name"] == "Make a level" and dgame["data"]["id"] == DP and dgame["readOnly"] is False)
check("…and its own copies of the files", dana.get(f"/api/projects/{DP}/assets/hero1").data == PNG)
check("…on their My Games", DP in [x["id"] for x in dana.get("/api/projects").get_json()["projects"]])
check("the teacher opening it gets the starter, to change", teacher.post(f"/api/assignments/{A}/start").get_json() == {"project": STARTER, "starter": True})

# Who can read the student's game.
check("its teacher can open it — read only", teacher.get(f"/api/projects/{DP}").get_json().get("readOnly") is True)
check("…and its files", teacher.get(f"/api/projects/{DP}/assets/hero1").data == PNG)
check("…but never save over it", put(teacher, DP, dict(dgame["data"], name="hacked"), 1).status_code == 409)
check("…nor add files to it", teacher.put(f"/api/projects/{DP}/assets/zz", data=PNG).status_code == 403)
check("another student can't open it", erin.get(f"/api/projects/{DP}").status_code == 403)
check("…nor another teacher", other_teacher.get(f"/api/projects/{DP}").status_code == 403)
check("…nor its files", other_teacher.get(f"/api/projects/{DP}/assets/hero1").status_code == 403)
check("a teacher can't open a student's games that aren't assignment work", teacher.get("/api/projects/ico1").status_code == 403)
check("the editor learns the game is an assignment", dana.get(f"/api/projects/{DP}/assignment").get_json()["assignment"]["slug"] == A)
check("…and an ordinary game isn't", alice.get("/api/projects/ico1/assignment").get_json()["assignment"] is None)

# Turning in.
check("nobody else can turn a student's game in", erin.post(f"/api/projects/{DP}/turn-in").status_code == 404)
check("an ordinary game has nothing to be turned in to", alice.post("/api/projects/ico1/turn-in").status_code == 400)
r = dana.post(f"/api/projects/{DP}/turn-in")
check("a student turns it in", r.status_code == 200 and r.get_json()["times"] == 1, r.get_json())
put(dana, DP, dict(dgame["data"], name="Made a level, more"), dgame["version"])
res = teacher.get(f"/api/assignments/{A}").get_json()
row = {x["email"]: x for x in res["rows"]}
check("the teacher sees every student on the roster", sorted(row) == ["dana@example.com", "erin@example.com"], sorted(row))
check("…the game, when it was last changed, and when it was turned in",
      row["dana@example.com"]["project"] == DP and row["dana@example.com"]["updated"] and row["dana@example.com"]["turnedIn"])
check("…and who hasn't started", row["erin@example.com"]["project"] is None and row["erin@example.com"]["turnedIn"] is None)
VID = row["dana@example.com"]["version"]
frozen = teacher.get(f"/api/projects/{DP}/versions/{VID}").get_json()
check("what was turned in stays as it was, while the student carries on", frozen["data"]["name"] == "Make a level" and frozen["kind"] == "turned-in", frozen.get("kind"))
check("…and in the student's own History, as turned in", any(v["kind"] == "turned-in" for v in dana.get(f"/api/projects/{DP}/versions").get_json()["versions"]))
check("the assignment's results are its teacher's only", other_teacher.get(f"/api/assignments/{A}").status_code == 403
      and dana.get(f"/api/assignments/{A}").status_code == 403)
check("the editor says it changed since it was turned in", dana.get(f"/api/projects/{DP}/assignment").get_json()["assignment"]["changedSince"] is True)

# Comments.
check("a teacher comments on a student's game", teacher.post(f"/api/projects/{DP}/comments", json={"text": "Nice jump!"}).status_code == 201)
check("another student can't", erin.post(f"/api/projects/{DP}/comments", json={"text": "lol"}).status_code == 404)
check("…nor read them", erin.get(f"/api/projects/{DP}/comments").status_code == 404)
item = [i for i in dana.get(f"/api/classes/{GD}").get_json()["items"] if i["kind"] == "assignment"][0]
check("the student's class page says there's a new comment", item["unread"] == 1 and item["project"] == DP and item["turnedIn"], item)
cs = dana.get(f"/api/projects/{DP}/comments").get_json()["comments"]
check("…which they read, marked as their teacher's", [c["text"] for c in cs] == ["Nice jump!"] and cs[0]["teacher"] and not cs[0]["mine"])
check("…and then it isn't new", [i for i in dana.get(f"/api/classes/{GD}").get_json()["items"] if i["kind"] == "assignment"][0]["unread"] == 0)
dana.post(f"/api/projects/{DP}/comments", json={"text": "Thanks!"})
check("a reply shows as new on the teacher's results", {x["email"]: x for x in teacher.get(f"/api/assignments/{A}").get_json()["rows"]}["dana@example.com"]["unread"] == 1)
check("comments are only for assignment work", alice.post("/api/projects/ico1/comments", json={"text": "hi"}).status_code == 400)

# Scores.
check("a score is given", teacher.post(f"/api/assignments/{A}/score", json={"student": dana.get("/api/me").get_json()["user"]["id"], "score": 9}).status_code == 200)
check("…and the student sees it", [i for i in dana.get(f"/api/classes/{GD}").get_json()["items"] if i["kind"] == "assignment"][0]["score"] == 9)
check("only by the assignment's teacher", other_teacher.post(f"/api/assignments/{A}/score", json={"student": 1, "score": 1}).status_code == 403)
erin.post(f"/api/assignments/{A}/start")
EID = erin.get("/api/me").get_json()["user"]["id"]
check("work never turned in can be scored too", teacher.post(f"/api/assignments/{A}/score", json={"student": EID, "score": 4}).status_code == 200)
erow = {x["email"]: x for x in teacher.get(f"/api/assignments/{A}").get_json()["rows"]}["erin@example.com"]
check("…freezing what was scored, without calling it turned in", erow["score"] == 4 and erow["turnedIn"] is None and erow["version"])

# Duplicating to demo.
r = teacher.post(f"/api/projects/{DP}/duplicate")
demo = r.get_json().get("project")
check("a teacher copies a student's game into their own, to show the class", r.status_code == 201
      and teacher.get(f"/api/projects/{demo}").get_json()["readOnly"] is False
      and "dana" in teacher.get(f"/api/projects/{demo}").get_json()["data"]["name"].lower())
check("…with its files", teacher.get(f"/api/projects/{demo}/assets/hero1").data == PNG)
check("…or the version turned in", teacher.get("/api/projects/" + teacher.post(f"/api/projects/{DP}/duplicate", json={"version": VID}).get_json()["project"]).get_json()["data"]["name"] == "Make a level (from Dana)")
check("a student can't copy someone's game that way", erin.post(f"/api/projects/{DP}/duplicate").status_code == 403)

# Hiding, archiving, deleting, copying.
iid = item["id"]
teacher.post(f"/api/classes/{GD}/items/{iid}", json={"hidden": True})
check("a hidden assignment is off the students' page", [i for i in dana.get(f"/api/classes/{GD}").get_json()["items"] if i["kind"] == "assignment"] == [])
check("…but still on the teacher's, marked", [i["hidden"] for i in teacher.get(f"/api/classes/{GD}").get_json()["items"]] == [True])
newbie = client("fay@example.com")
check("…and can't be started", newbie.post(f"/api/assignments/{A}/start").status_code == 403)
check("…though a game already started still opens", dana.post(f"/api/assignments/{A}/start").get_json()["project"] == DP)
teacher.post(f"/api/classes/{GD}/items/{iid}", json={"hidden": False})
check("an assignment students turned in can't be deleted", teacher.delete(f"/api/assignments/{A}").status_code == 409)
r = teacher.post(f"/api/assignments/{A}/copy", json={"class": P4})
B = r.get_json().get("slug")
check("an assignment is copied to another class, with a link of its own", r.status_code == 201 and B != A)
check("…with none of the students' work", teacher.get(f"/api/assignments/{B}").get_json()["rows"][0]["project"] is None)
check("…only to the teacher's own classes", teacher.post(f"/api/assignments/{A}/copy", json={"class": PYCLASS}).status_code == 400)
teacher.post(f"/api/assignments/{B}/notes", json={"notes": "```quiz\nOne?\nanswer: one\n```\n```tests\nuses for\n```"})
check("an assignment nobody turned in is deleted, notes and all", teacher.delete(f"/api/assignments/{B}").status_code == 200
      and teacher.get(f"/api/assignments/{B}").status_code == 404)
teacher.post(f"/api/assignments/{A}", json={"archived": True})
check("an archived assignment is off the students' page", [i for i in dana.get(f"/api/classes/{GD}").get_json()["items"] if i["kind"] == "assignment"] == [])
check("…and their game is still theirs", dana.get(f"/api/projects/{DP}").status_code == 200)
check("…and can't be turned in", dana.post(f"/api/projects/{DP}/turn-in").status_code == 403)
teacher.post(f"/api/assignments/{A}", json={"archived": False})
g = teacher.post(f"/api/classes/{GD}/groups", json={"title": "Week 1"}).get_json()["id"]
ids = [i["id"] for i in teacher.get(f"/api/classes/{GD}").get_json()["items"]]
check("a new group goes on top", ids[0] == g)
teacher.post(f"/api/classes/{GD}/order", json={"items": list(reversed(ids))})
check("the page is put in the teacher's order", [i["id"] for i in teacher.get(f"/api/classes/{GD}").get_json()["items"]] == list(reversed(ids)))
check("…and the students see it the same", [i["id"] for i in dana.get(f"/api/classes/{GD}").get_json()["items"]] == list(reversed(ids)))

# The week's calendar (save_calendar): the shared classes.calendar, as typed.
def calendar_of(cid):
    db = server.SessionLocal()
    try:
        return db.get(accounts.Course, cid).calendar
    finally:
        db.close()


check("a class starts with no calendar", teacher.get(f"/api/classes/{GD}").get_json()["calendar"] == ""
      and dana.get(f"/api/classes/{GD}").get_json()["calendar"] == "")
r = teacher.post(f"/api/classes/{GD}/calendar", json={"calendar": "\nMonday:\nLevel 1\nTuesday: playtest\n\n"})
check("the teacher saves the week, stored as typed with its ends trimmed",
      r.status_code == 200 and calendar_of(GD) == "Monday:\nLevel 1\nTuesday: playtest")
check("…and the class's students are sent it", dana.get(f"/api/classes/{GD}").get_json()["calendar"] == calendar_of(GD))
check("…on that class only", calendar_of(P4) == "")
r = teacher.post(f"/api/classes/{GD}/calendar", json={"calendar": "Monday:\nA", "also": [P4]})
check("Also post to puts the same week on the teacher's other class",
      r.status_code == 200 and calendar_of(GD) == calendar_of(P4) == "Monday:\nA" and r.get_json()["posted"] == 2)
OTHERS = other_teacher.post("/api/classes", json={"name": "Their class"}).get_json()["id"]
r = teacher.post(f"/api/classes/{GD}/calendar", json={"calendar": "Monday:\nB", "also": [P4, OTHERS]})
check("another teacher's class in the list refuses the whole save",
      r.status_code == 404 and calendar_of(GD) == calendar_of(P4) == "Monday:\nA" and calendar_of(OTHERS) == "")
r = teacher.post(f"/api/classes/{GD}/calendar", json={"calendar": "Monday:\nB", "also": [PYCLASS]})
check("…so does the teacher's own class in another editor", r.status_code == 404 and calendar_of(PYCLASS) == "")
check("also that isn't a list of classes is refused",
      teacher.post(f"/api/classes/{GD}/calendar", json={"calendar": "x", "also": str(P4)}).status_code == 400)
check("another teacher can't set it", other_teacher.post(f"/api/classes/{GD}/calendar", json={"calendar": "x"}).status_code == 403
      and calendar_of(GD) == "Monday:\nA")
check("a student can't", dana.post(f"/api/classes/{GD}/calendar", json={"calendar": "x"}).status_code == 403)
check("something that isn't text is refused", teacher.post(f"/api/classes/{GD}/calendar", json={"calendar": 5}).status_code == 400)
check("one too long is refused",
      teacher.post(f"/api/classes/{GD}/calendar", json={"calendar": "x" * (classes.MAX_CALENDAR + 1)}).status_code == 413)
check("Clear takes it off", teacher.post(f"/api/classes/{GD}/calendar", json={"calendar": ""}).status_code == 200
      and dana.get(f"/api/classes/{GD}").get_json()["calendar"] == "")
teacher.post(f"/api/classes/{P4}/calendar", json={"calendar": ""})
other_teacher.delete(f"/api/classes/{OTHERS}")
check("a deleted game of a student's comes back when the assignment is opened",
      dana.delete(f"/api/projects/{DP}").status_code == 200 and dana.post(f"/api/assignments/{A}/start").get_json()["project"] == DP
      and dana.get(f"/api/projects/{DP}").status_code == 200)
r = teacher.get("/a/" + A)
check("the assignment's link goes to the editor's own page", r.status_code == 302 and r.headers["Location"].endswith("/#/a/" + A))

# Google Classroom, with Google replaced: nothing here reaches the network.
os.environ["GOOGLE_CLIENT_ID"], os.environ["GOOGLE_CLIENT_SECRET"] = "cid", "csecret"
calls = []
STUDENTS = {"students": [{"userId": "g1", "profile": {"emailAddress": "Dana@example.com", "name": {"fullName": "Dana D"}}},
                         {"userId": "g2", "profile": {"emailAddress": "gus@example.com", "name": {"fullName": "Gus G"}}}]}


def fake_post(url, data):
    calls.append(("POST", url))
    if data.get("grant_type") == "refresh_token":
        return 200, {"access_token": "tok"}
    if data.get("grant_type") == "authorization_code":
        return 200, {"access_token": "tok", "refresh_token": "refresh", "scope": " ".join(classes.CLASSROOM_SCOPES)}
    return 200, {}


def fake_get(url, token, params=None):
    calls.append(("GET", url))
    if url.endswith("/userinfo"):
        return 200, {"email": "teacher@example.com"}
    if url.endswith("/courses"):
        return 200, {"courses": [{"id": "555", "name": "Game Design", "section": "P3"}]}
    if url.endswith("/courses/555"):
        return 200, {"id": "555", "name": "Game Design", "section": "P3"}
    if url.endswith("/students"):
        return 200, STUDENTS
    if url.endswith("/courseWork/w1"):
        return 200, {"id": "w1", "state": "PUBLISHED"}
    if url.endswith("/studentSubmissions"):
        return 200, {"studentSubmissions": [{"userId": "g1", "id": "s1"}]}
    return 404, {}


def fake_api(method, url, token, body=None, params=None):
    calls.append((method, url, body))
    if method == "POST" and url.endswith("/courseWork"):
        return 200, {"id": "w1", "alternateLink": "https://classroom.example/w1"}
    return 200, {}


classes._google_post, classes._google_get, classes._google_api = fake_post, fake_get, fake_api
check("Classroom isn't connected at first", teacher.get("/api/classes").get_json()["classroom"]["connected"] is False)
r = teacher.get("/classroom/connect")
state = __import__("urllib.parse").parse.parse_qs(__import__("urllib.parse").parse.urlparse(r.headers["Location"]).query)["state"][0]
check("a callback that didn't start here is refused", teacher.get("/classroom/callback?state=forged&code=x").status_code == 400)
teacher.get("/classroom/connect")
with teacher.session_transaction() as sess:
    state = sess["classroom_state"]
r = teacher.get(f"/classroom/callback?state={state}&code=x")
check("connecting Classroom keeps the teacher's token, encrypted", r.status_code == 302 and teacher.get("/api/classes").get_json()["classroom"]["connected"])
db = server.SessionLocal()
check("…never stored as it came", db.query(accounts.ClassroomLink).filter_by(app="gameide").first().refresh_token != "refresh")
db.close()
check("a student can't start a Classroom connection", alice.get("/classroom/connect").status_code == 404)
courses = teacher.get("/api/classroom/courses").get_json()["courses"]
check("the teacher's Classroom classes are listed to bring in", courses[0]["id"] == "555")
r = teacher.post("/api/classes", json={"name": "Game Design P3", "course": "555"})
CR = r.get_json()["id"]
check("a class brought in from Classroom gets its roster at once", r.get_json()["students"] == 2, r.get_json())
cpage = teacher.get(f"/api/classes/{CR}").get_json()
check("…by lower-case email, with names", {s["email"]: s["name"] for s in cpage["students"]} == {"dana@example.com": "Dana D", "gus@example.com": "Gus G"})
check("a Classroom class's roster can't be typed into", teacher.post(f"/api/classes/{CR}/students", json={"emails": "z@example.com"}).status_code == 409)
STUDENTS["students"] = STUDENTS["students"][:1]
teacher.post(f"/api/classes/{CR}/roster")
check("Sync roster drops a student who left", [s["email"] for s in teacher.get(f"/api/classes/{CR}").get_json()["students"]] == ["dana@example.com"])
put(teacher, "lvl2", project("lvl2", "Maze"), 0)
C = teacher.post(f"/api/classes/{CR}/assignments", json={"title": "Maze", "project": "lvl2"}).get_json()["slug"]
check("posting needs points first", teacher.post(f"/api/assignments/{C}/classroom/post").status_code == 400)
teacher.post(f"/api/assignments/{C}", json={"outOf": 20, "dueAt": "2031-01-01T04:59"})
r = teacher.post(f"/api/assignments/{C}/classroom/post", json={"draft": False})
made = [c for c in calls if c[0] == "POST" and c[1].endswith("/courseWork")]
check("posting makes Classroom coursework with the assignment's link, points and due date", r.status_code == 200
      and made[-1][2]["materials"][0]["link"]["url"].endswith("/a/" + C) and made[-1][2]["maxPoints"] == 20
      and made[-1][2].get("dueDate") == {"year": 2031, "month": 1, "day": 1}, r.get_json())
check("…in the class's own course", made[-1][1].endswith("/courses/555/courseWork"))
dana.post(f"/api/assignments/{C}/start")
teacher.post(f"/api/assignments/{C}/score", json={"student": dana.get("/api/me").get_json()["user"]["id"], "score": 18})
r = teacher.post(f"/api/assignments/{C}/classroom/sync").get_json()
patch = [c for c in calls if c[0] == "PATCH"]
check("Sync sends each score as a draft grade to that student's submission", r["sent"] == 1 and patch[-1][1].endswith("/studentSubmissions/s1")
      and patch[-1][2] == {"draftGrade": 18.0}, r)
check("…and the results say it's in Classroom", {x["email"]: x for x in teacher.get(f"/api/assignments/{C}").get_json()["rows"]}["dana@example.com"]["synced"])
check("another teacher can't sync it", other_teacher.post(f"/api/assignments/{C}/classroom/sync").status_code == 403)
teacher.post("/classroom/disconnect")
check("disconnecting forgets the token", teacher.get("/api/classes").get_json()["classroom"]["connected"] is False)
os.environ.pop("GOOGLE_CLIENT_ID")
os.environ.pop("GOOGLE_CLIENT_SECRET")
check("deleting a class archives its assignments and keeps the students' games",
      teacher.delete(f"/api/classes/{CR}").status_code == 200 and teacher.get(f"/api/assignments/{C}").get_json()["archived"]
      and dana.post(f"/api/assignments/{C}/start").status_code == 200)

# ---------------------------------------------------------------- XP (rewards.py)
import xp  # noqa: E402

XC = teacher.post("/api/classes", json={"name": "XP class"}).get_json()["id"]
teacher.post(f"/api/classes/{XC}/students", json={"emails": "xa@example.com xb@example.com xc@example.com"})
xa, xb, xc = client("xa@example.com"), client("xb@example.com"), client("xc@example.com")
ids = {}
for name, c in (("xa", xa), ("xb", xb), ("xc", xc)):
    ids[name] = c.get("/api/me").get_json()["user"]["id"]
card = xa.get("/api/me/xp").get_json()
check("a student's XP card starts at level 1 with nothing", card.get("xp") == 0 and card.get("level") == 1 and card.get("earns") is True, card)
check("…with the avatars to pick from", len(card.get("avatars", [])) == len(xp.AVATARS))
check("a teacher doesn't earn XP", teacher.get("/api/me/xp").get_json().get("earns") is False)

# A game that ran: paid only after working long enough, and only for changed code.
news0 = xa.get("/api/me/xp/news").get_json()
r = xa.post("/api/xp/run", json={"code": "abc123"}).get_json()
check("a run pays nothing before enough working time", r.get("awarded") == 0 and r.get("minutes", 0) > 0, r)
with xa.session_transaction() as sess:
    sess["busy"] = xp.RUN_EVERY_SECONDS
r = xa.post("/api/xp/run", json={"code": "abc123"}).get_json()
check("…and RUN_XP once the student has worked long enough", r.get("awarded") == xp.RUN_XP, r)
# The paid run's source is moved to another minute, so it is the time check
# that refuses the next claim, not the two colliding on the same minute.
db = server.SessionLocal()
db.query(accounts.XpAward).filter(accounts.XpAward.user_id == ids["xa"]).update({"source": "run:1"}, synchronize_session=False)
db.commit()
db.close()
with xa.session_transaction() as sess:
    sess["busy"] = xp.RUN_EVERY_SECONDS
check("…not twice inside the time, however long the session says", xa.post("/api/xp/run", json={"code": "zzz999"}).get_json().get("awarded") == 0)
db = server.SessionLocal()
db.query(accounts.XpAward).filter(accounts.XpAward.user_id == ids["xa"]).update(
    {"created_at": accounts.now() - __import__("datetime").timedelta(hours=1)}, synchronize_session=False)
db.commit()
db.close()
with xa.session_transaction() as sess:
    sess["busy"] = xp.RUN_EVERY_SECONDS
check("…nor for the same code again", xa.post("/api/xp/run", json={"code": "abc123"}).get_json().get("same") is True)
with teacher.session_transaction() as sess:
    sess["busy"] = xp.RUN_EVERY_SECONDS
check("a teacher's run pays nothing", teacher.post("/api/xp/run", json={"code": "t1"}).get_json().get("awarded") == 0)
with xa.session_transaction() as sess:
    sess["busy"] = 0
    sess["act"] = int(time.time()) - 200
xa.post("/api/alive")
with xa.session_transaction() as sess:
    busy = sess.get("busy", 0)
check("working time is counted as the student works", 190 <= busy <= 400, busy)

# The teacher's XP, with a reason.
r = teacher.post(f"/api/classes/{XC}/xp", json={"students": [ids["xa"], ids["xb"]], "xp": 30, "reason": "Helped debug"})
check("a teacher gives XP to students in their class", r.status_code == 200 and xa.get("/api/me/xp").get_json()["xp"] == 30 + xp.RUN_XP)
news = xa.get(f"/api/me/xp/news?after={news0['latest']}").get_json()
check("…which pops up for the student, with the reason (and runs don't)", [a["reason"] for a in news["awards"]] == ["Helped debug"], news)
check("another teacher can't give XP in this class", other_teacher.post(f"/api/classes/{XC}/xp", json={"student": ids["xa"], "xp": 5}).status_code == 403)
check("…nor can it go to someone not in the class", teacher.post(f"/api/classes/{XC}/xp", json={"student": ids["xa"] + 1000, "xp": 5}).status_code == 404)
check("a student can't give XP", xa.post(f"/api/classes/{XC}/xp", json={"student": ids["xa"], "xp": 500}).status_code == 403)
r = teacher.post(f"/api/classes/{XC}/xp", json={"students": [ids["xb"], ids["xc"]], "xp": -50, "reason": "Late"}).get_json()
check("a penalty never takes XP below 0, and names who it skipped", xb.get("/api/me/xp").get_json()["xp"] == 0 and len(r.get("skipped", [])) == 1, r)

# XP from another editor counts: one total per person.
db = server.SessionLocal()
db.add(accounts.XpAward(user_id=ids["xc"], app="pyide", source="quiz:1:x", xp=70, reason="Question in PyIDE"))
db.commit()
db.close()
b = xa.get(f"/api/classes/{XC}/board").get_json()
check("the class's board ranks everyone by their whole XP, PyIDE's included",
      [(r["name"], r["xp"]) for r in b["board"]] == [("Xc", 70), ("Xa", 30 + xp.RUN_XP), ("Xb", 0)], b.get("board"))
check("…by first name and initial, never an email", "@" not in json.dumps(b))
check("…closed to anyone outside the class", alice.get(f"/api/classes/{XC}/board").status_code == 403)
xc.post("/api/me/board", json={"hidden": True})
check("a student who hides is off the board", "Xc" not in [r["name"] for r in xa.get(f"/api/classes/{XC}/board").get_json()["board"]])
check("…and still earns", xc.get("/api/me/xp").get_json()["xp"] == 70)
check("a teacher with several classes has an all-classes board", isinstance(xa.get(f"/api/classes/{XC}/board").get_json()["all"], list))

# Quests: full marks on an assignment with a reward.
put(teacher, "q1", project("q1", "Quest game"), 0)
Q = teacher.post(f"/api/classes/{XC}/assignments", json={"title": "Boss level", "project": "q1", "outOf": 10}).get_json()["slug"]
check("only its teacher sets a quest reward", other_teacher.post(f"/api/assignments/{Q}/xp-bonus", json={"xp": 50}).status_code == 403)
teacher.post(f"/api/assignments/{Q}/xp-bonus", json={"xp": 50})
xa.post(f"/api/assignments/{Q}/start")
before = xa.get("/api/me/xp").get_json()["xp"]
teacher.post(f"/api/assignments/{Q}/score", json={"student": ids["xa"], "score": 9})
check("a score short of full marks pays no quest", xa.get("/api/me/xp").get_json()["xp"] == before)
teacher.post(f"/api/assignments/{Q}/score", json={"student": ids["xa"], "score": 10})
check("full marks pays the quest reward", xa.get("/api/me/xp").get_json()["xp"] == before + 50)
teacher.post(f"/api/assignments/{Q}/score", json={"student": ids["xa"], "score": 10})
check("…once", xa.get("/api/me/xp").get_json()["xp"] == before + 50)
qi = [i for i in xa.get(f"/api/classes/{XC}").get_json()["items"] if i.get("slug") == Q][0]
check("the class page marks the quest done", qi.get("xpBonus") == 50 and qi.get("questDone") is True, qi)
xb.post(f"/api/assignments/{Q}/start")
teacher.post(f"/api/assignments/{Q}/xp-bonus", json={"xp": 0})
teacher.post(f"/api/assignments/{Q}/score", json={"student": ids["xb"], "score": 10})
r = teacher.post(f"/api/assignments/{Q}/xp-bonus", json={"xp": 40}).get_json()
check("setting a reward pays those who already have full marks", r.get("paid") == 1 and xb.get("/api/me/xp").get_json()["xp"] == 40, r)
check("an open quest is listed for a student who hasn't done it", [q["title"] for q in xc.get("/api/me/xp").get_json()["quests"]] == ["Boss level"])

# Avatars.
check("an avatar above the student's level is refused", xb.post("/api/me/avatar", json={"avatar": "wizard"}).status_code == 400)
check("…and one that doesn't exist", xb.post("/api/me/avatar", json={"avatar": "nope"}).status_code == 400)
check("one unlocked is saved", xb.post("/api/me/avatar", json={"avatar": "robot"}).get_json().get("avatar") == "robot"
      and [r["avatar"] for r in xa.get(f"/api/classes/{XC}/board").get_json()["board"] if r["name"] == "Xb"] == ["robot"])
pending = xb.post("/api/me/photo", data=PNG, content_type="image/png").get_json().get("pending", "")
check("a student's photo waits for approval", pending.startswith("photo:"))
pslug = pending.split(":", 1)[-1]
check("…seen by nobody else", xa.get(f"/photo/{pslug}").status_code == 404 and anon.get(f"/photo/{pslug}").status_code == 404)
check("…but their teacher", teacher.get(f"/photo/{pslug}").status_code == 200)
check("…and isn't their avatar yet", xb.post("/api/me/avatar", json={"avatar": "photo"}).status_code == 400)
check("a picture that isn't one is refused", xb.post("/api/me/photo", data=b"<svg/>", content_type="image/svg+xml").status_code == 400)
photos = teacher.get(f"/api/classes/{XC}/xp").get_json()["photos"]
check("another teacher can't approve it", other_teacher.post(f"/api/classes/{XC}/photo/{photos[0]['id']}/approve").status_code == 403)
teacher.post(f"/api/classes/{XC}/photo/{photos[0]['id']}/approve")
check("approved, it's their avatar, and anyone can see it", xb.get("/api/me/xp").get_json()["avatar"] == pending
      and anon.get(f"/photo/{pslug}").status_code == 200)

# The token shop.
shopc = xa.get("/api/me/xp").get_json()["shops"]
check("a student sees their teacher's shop, stocked from the starter list", shopc and len(shopc[0]["items"]) == len(xp.SHOP_STARTER), shopc)
cheap = [i for i in shopc[0]["items"] if i["cost"] == 1][0]
check("asking without a token is refused", xa.post("/api/shop/request", json={"item": cheap["id"]}).status_code == 409)
teacher.post(f"/api/classes/{XC}/xp", json={"student": ids["xa"], "xp": 1000, "reason": "Token time"})
r = xa.post("/api/shop/request", json={"item": cheap["id"]})
RQ = (r.get_json() or {}).get("request", {}).get("id")
check("with one, the request is taken and its token held", r.status_code == 200 and r.get_json()["free"] == 0)
check("…so a second can't be asked for", xa.post("/api/shop/request", json={"item": cheap["id"]}).status_code == 409)
check("another teacher can't approve it", other_teacher.post(f"/api/shop/request/{RQ}/approve").status_code == 404)
check("…nor can the student", xa.post(f"/api/shop/request/{RQ}/approve").status_code == 403)
check("its teacher sees it on the class's XP page", [q["id"] for q in teacher.get(f"/api/classes/{XC}/xp").get_json()["requests"]] == [RQ])
teacher.post(f"/api/shop/request/{RQ}/approve")
card = xa.get("/api/me/xp").get_json()
check("approving spends the token", card["tokens"] == 0 and card["free"] == 0, card.get("tokens"))
check("using a token needs one", teacher.post(f"/api/classes/{XC}/tokens", json={"student": ids["xa"]}).status_code == 409)
item = teacher.post("/api/shop/item", json={"name": "Choose the music", "cost": 2})
check("a teacher stocks their shop", item.status_code == 201 and "Choose the music" in [i["name"] for i in teacher.get("/api/shop").get_json()["items"]])
check("…a student can't", xa.post("/api/shop/item", json={"name": "Free A", "cost": 1}).status_code == 403)
teacher.post(f"/api/shop/item/{item.get_json()['id']}", json={"active": False})
check("an item taken off the shelf isn't offered", "Choose the music" not in [i["name"] for i in xa.get("/api/me/xp").get_json()["shops"][0]["items"]])

# Random events.
marks = {c: c.get("/api/me/xp/news").get_json() for c in (xa, xb, xc)}
r = teacher.post(f"/api/classes/{XC}/event").get_json()
ev = r.get("event", {})
check("a random event is drawn and applied", ev.get("title") in [e["title"] for e in xp.EVENTS] and isinstance(ev.get("hits"), list), r)
db = server.SessionLocal()
moved = db.query(accounts.XpAward).filter(accounts.XpAward.source.like("event:%d:%%" % ev.get("id", -1))).count()
db.close()
check("…its XP is rows the event names", moved == len(ev.get("hits", [])))
check("the class's page shows it", (xa.get(f"/api/classes/{XC}/board").get_json().get("event") or {}).get("id") == ev.get("id"))
banner = xa.get(f"/api/classes/{XC}/board").get_json().get("event") or {}
check("…naming who it hit by first name only",
      all(h["name"] == "A classmate" or (" " not in h["name"] and "." not in h["name"]) for h in banner.get("hits", [])),
      banner.get("hits"))
# Every student in the class gets the event's popup, hit or not — only the
# ones it gave XP to used to see anything.
seen = {c: c.get(f"/api/me/xp/news?after={m['latest']}&events_after={m['events_latest']}").get_json() for c, m in marks.items()}
check("every student in the class gets the event in their news",
      all([e["id"] for e in n["events"]] == [ev.get("id")] for n in seen.values()), seen)
check("…with first names, and their own share as `mine`",
      all(h["name"] == "A classmate" or " " not in h["name"] for n in seen.values() for h in n["events"][0]["hits"])
      and sum(1 for n in seen.values() if n["events"][0]["mine"] is not None) == len(ev.get("hits", [])), seen)
check("…and its award isn't said twice", not any(a["kind"] == "event" for n in seen.values() for a in n["awards"]))
# Named by first name only — users with a real surname, and an everyone event.
db = server.SessionLocal()
for who, first in (("xa", "Xena"), ("xb", "Xavi"), ("xc", "Xiu")):
    u = db.get(accounts.User, ids[who])
    u.first_name, u.last_name = first, "Quill"
db.commit()
db.close()
real_pick = xp.pick_event
xp.pick_event = lambda rng: next(e for e in xp.EVENTS if e["who"] == "all" and e["xp"] > 0)
try:
    ev2 = teacher.post(f"/api/classes/{XC}/event").get_json()["event"]
finally:
    xp.pick_event = real_pick
names = [h["name"] for h in xb.get(f"/api/me/xp/news?after=0&events_after={ev.get('id')}").get_json()["events"][0]["hits"]]
check("…by first name only — Xena, never Xena Q.", "Xena" in names and not any("Q." in n for n in names), names)
board_names = [h["name"] for h in (xb.get(f"/api/classes/{XC}/board").get_json().get("event") or {}).get("hits", [])]
check("…on the class page too", "Xena" in board_names and not any("Q." in n for n in board_names), board_names)
teacher.post(f"/api/classes/{XC}/event/{ev2['id']}/undo")
check("a page not asking for events gets none, as before",
      xa.get(f"/api/me/xp/news?after={marks[xa]['latest']}").get_json()["events"] == [])
check("only the class's teacher draws one", other_teacher.post(f"/api/classes/{XC}/event").status_code == 403)
teacher.post(f"/api/classes/{XC}/event/{ev.get('id')}/undo")
db = server.SessionLocal()
moved = db.query(accounts.XpAward).filter(accounts.XpAward.source.like("event:%d:%%" % ev.get("id", -1))).count()
db.close()
check("Undo takes its XP back, and it leaves the class's page", moved == 0 and xa.get(f"/api/classes/{XC}/board").get_json().get("event") is None)
pics = {f.stem for f in (BACKEND.parent / "frontend" / "public" / "avatars").glob("*.webp")}
check("every avatar has its picture, and every picture is an avatar", pics == set(xp.AVATAR_IDS), pics ^ set(xp.AVATAR_IDS))
log = xa.get("/api/me/xp/all").get_json()["awards"]
check("a student's every award is listed, with why and where", {"Helped debug", "Ran a game", "Token time"} <= {a["reason"] for a in log}
      and {a["app"] for a in log} == {"gameide"})

# ---------------------------------------------------------------- notes, questions, tests (notes.py)
import quiz as quizmod  # noqa: E402
import checks as checksmod  # noqa: E402

cases = json.loads((BACKEND.parent / "frontend" / "src" / "notes" / "parse-cases.json").read_text())
check("questions are read here as the editor reads them (the shared cases)", all(
    {k: quizmod.parse(c["body"])[k2] for k, k2 in (("id", "given_id"), ("kind", "kind"), ("prompt", "prompt"), ("choices", "choices"),
     ("correct", "correct"), ("answers", "answers"), ("options", "options"), ("points", "points"))} == c["expect"] for c in cases["quiz"]))
check("…and tests too", all(checksmod.parse(c["body"]) == c["expect"] for c in cases["tests"]))

NOTES = """# Coins

---

```quiz
Which says a key is held?
- [ ] keyboard_check_pressed
- [x] keyboard_check
points: 2
```

```quiz
What is a picture with frames called?
answer: SECRETSPRITE
```

```quiz
type: blank
Move right with [[xblankkey]] and down with [[yblankkey]].
```

```quiz
type: long
Describe your game.
points: 4
```

```tests
object Player exists
Player has event step (2 points)
uses keyboard_check
```
"""
put(teacher, "nq1", project("nq1", "Notes game"), 0)
N = teacher.post(f"/api/classes/{XC}/assignments", json={"title": "Coins with notes", "project": "nq1"}).get_json()["slug"]
check("only the assignment's teacher writes its notes", other_teacher.post(f"/api/assignments/{N}/notes", json={"notes": NOTES}).status_code == 403
      and xa.post(f"/api/assignments/{N}/notes", json={"notes": NOTES}).status_code == 403)
r = teacher.post(f"/api/assignments/{N}/notes", json={"notes": NOTES}).get_json()
check("notes are saved, and say what they're worth", r.get("possible") == 2 + 1 + 1 + 4 + 1 + 2 + 1, r)
check("the teacher's page has them whole", "SECRETSPRITE" in teacher.get(f"/api/assignments/{N}").get_json()["notes"])

# The leak checks: every way a student reaches an assignment's notes.
NP = xa.post(f"/api/assignments/{N}/start").get_json()["project"]
seen = xa.get(f"/api/projects/{NP}/assignment").get_json()["assignment"]["notes"]
check("a student's editor gets the notes", "Which says a key is held?" in seen and "object Player exists" in seen)
check("…without the right choice marked", "[x]" not in seen and "- [ ] keyboard_check\n" in seen)
check("…without the short answer", "SECRETSPRITE" not in seen and "answer:" not in seen)
check("…without the blanks' answers", "xblankkey" not in seen and "yblankkey" not in seen and "[[]]" in seen)
check("…with an id on each question, to answer it by", seen.count("id: ") == 4)
for path in (f"/api/classes/{XC}", f"/api/projects/{NP}", f"/api/assignments/{N}/tests/work", f"/api/quiz/{N}/mine", "/api/me/xp"):
    body = xa.get(path).get_data(as_text=True)
    check(f"no answers reach a student through {path.split('/')[2]}…{path.split('/')[-1]}", "SECRETSPRITE" not in body and "xblankkey" not in body)
qs = {q["prompt"].split("\n")[0][:20]: q for q in quizmod.keys(NOTES)}
choice_q = [q for q in quizmod.keys(NOTES) if q["kind"] == "choice"][0]
text_q = [q for q in quizmod.keys(NOTES) if q["kind"] == "text"][0]
blank_q = [q for q in quizmod.keys(NOTES) if q["kind"] == "blank"][0]
long_q = [q for q in quizmod.keys(NOTES) if q["kind"] == "long"][0]

# Answering: one try, marked at once.
before = xa.get("/api/me/xp").get_json()["xp"]
r = xa.post("/api/quiz/answer", json={"assignment": N, "question": choice_q["qid"], "response": "keyboard_check_pressed"}).get_json()
check("a wrong choice is marked wrong, without saying the right one", r.get("correct") is False and r.get("earned") == 0 and "keyboard_check\"" not in json.dumps(r), r)
r = xa.post("/api/quiz/answer", json={"assignment": N, "question": choice_q["qid"], "response": "keyboard_check"}).get_json()
check("…and there's no second try", r.get("correct") is False and r.get("already") is True, r)
r = xa.post("/api/quiz/answer", json={"assignment": N, "question": text_q["qid"], "response": "  secretsprite. "}).get_json()
check("a short answer forgives case, spacing and a full stop", r.get("correct") is True and r.get("earned") == 1, r)
check("…and pays XP for its points", xa.get("/api/me/xp").get_json()["xp"] == before + xp.XP_PER_POINT, xa.get("/api/me/xp").get_json()["xp"] - before)
r = xa.post("/api/quiz/answer", json={"assignment": N, "question": blank_q["qid"], "response": json.dumps(["xblankkey", "nope"])}).get_json()
check("blanks give part marks", r.get("earned") == 0.5 and r.get("correct") is False, r)
r = xa.post("/api/quiz/answer", json={"assignment": N, "question": long_q["qid"], "response": "<p>My game <script>alert(1)</script><b onclick='x'>rocks</b></p>"}).get_json()
check("a long response is kept, its markup cleaned", r.get("kind") == "long" and "<script" not in r.get("response", "") and "onclick" not in r.get("response", "")
      and "<b>rocks</b>" in r.get("response", ""), r)
db = server.SessionLocal()
stored = db.query(accounts.QuizAnswer).filter_by(student_id=ids["xa"], qid=long_q["qid"]).first()
db.close()
check("…cleaned as it's stored, not only as it's shown", stored is not None and "<script" not in stored.response and "onclick" not in stored.response)
xp_now = xa.get("/api/me/xp").get_json()["xp"]
check("answering every question pays its bonus", xp_now >= before + xp.XP_PER_POINT + xp.ALL_ANSWERED_XP, xp_now - before)
mine = xa.get(f"/api/quiz/{N}/mine").get_json()["answers"]
check("a student's answers come back, locked", set(mine) == {choice_q["qid"], text_q["qid"], blank_q["qid"], long_q["qid"]})
r = teacher.post("/api/quiz/answer", json={"assignment": N, "question": choice_q["qid"], "response": "keyboard_check"}).get_json()
check("the teacher trying a question is practice, kept nowhere", r.get("practice") is True and r.get("correct") is True)
res = {x["email"]: x for x in teacher.get(f"/api/assignments/{N}").get_json()["rows"]}["xa@example.com"]
check("the results show the questions' points and the total", res["quiz"] == 1.5 and res["total"] == 1.5, (res["quiz"], res["total"]))
check("…and the long response, cleaned, to mark", res["longs"] and "<script" not in res["longs"][0]["response"])
check("another teacher can't mark it", other_teacher.post("/api/quiz/grade", json={"assignment": N, "student": ids["xa"], "question": long_q["qid"], "score": 4}).status_code == 403)

# A question in a tutorial played on its own: marked from its block, kept nowhere, no sign-in needed.
BLOCK = "Which says a key is held?\n- [ ] keyboard_check_pressed\n- [x] keyboard_check"
db = server.SessionLocal()
answers_before = db.query(accounts.QuizAnswer).count()
db.close()
stranger = server.app.test_client()
r = stranger.post("/api/quiz/practice", json={"block": BLOCK, "response": "keyboard_check"}).get_json()
check("a tutorial's question is marked in practice, signed out too", r.get("correct") is True and r.get("practice") is True and r.get("earned") == 1, r)
r = stranger.post("/api/quiz/practice", json={"block": BLOCK, "response": "keyboard_check_pressed"}).get_json()
check("…wrong is wrong", r.get("correct") is False and r.get("earned") == 0, r)
r = stranger.post("/api/quiz/practice", json={"block": "Fill it in: [[answer|reply]] and [[two]]\ntype: blank", "response": json.dumps(["Reply", "nope"])}).get_json()
check("…blanks give part marks there too", r.get("earned") == 0.5, r)
db = server.SessionLocal()
check("…and nothing is kept", db.query(accounts.QuizAnswer).count() == answers_before)
db.close()
check("a block that isn't a question is refused", stranger.post("/api/quiz/practice", json={"block": "", "response": "x"}).status_code == 400
      and stranger.post("/api/quiz/practice", json={"block": "just words", "response": "x"}).status_code == 400)

# Put in order, find the bug, sort into groups (quiz.py): the keys stay home, the answers are marked.
PUZZLES = """```quiz
type: order
Put the lines in order.
- def on_step(self):
-     if keyboard_check("right"):
-         self.x += ORDERKEY
points: 3
```

```quiz
type: bug
Which line is wrong?
~~~python
x = 1
print(x
y = 2
~~~
bug: 2
```

```quiz
type: sort
Sort them.
group: GRPEVENT
- Create
- Step
group: GRPFUNC
- instance_create
- keyboard_check
points: 4
```
"""
put(teacher, "nq3", project("nq3", "Puzzles game"), 0)
N3 = teacher.post(f"/api/classes/{XC}/assignments", json={"title": "Puzzles", "project": "nq3"}).get_json()["slug"]
teacher.post(f"/api/assignments/{N3}/notes", json={"notes": PUZZLES})
xa.post(f"/api/assignments/{N3}/start")
order_q, bug_q, sort_q = quizmod.keys(PUZZLES)
seen3 = xa.get(f"/api/assignments/{N3}").get_data(as_text=True) + json.dumps(xa.get(f"/api/projects/{xa.post(f'/api/assignments/{N3}/start').get_json()['project']}/assignment").get_json())
check("a student's copy of order, bug and sort questions has no key", "bug: 2" not in seen3 and "GRPEVENT\\n- Create" not in seen3
      and "item: " in seen3 and "line: " in seen3, seen3[:300])
r = xa.post("/api/quiz/answer", json={"assignment": N3, "question": order_q["qid"], "response": json.dumps(order_q["choices"])}).get_json()
check("lines left as shuffled get the part of them in order", r.get("correct") is False and r.get("earned", 0) < 3, r)
r = xa.post("/api/quiz/answer", json={"assignment": N3, "question": bug_q["qid"], "response": "2"}).get_json()
check("the bug's line is right", r.get("correct") is True, r)
st = xa.post("/api/quiz/answer", json={"assignment": N3, "question": sort_q["qid"], "response": json.dumps(["GRPEVENT"] * 3 + [""])}).status_code
check("a sort with an item left out is refused, not marked", st == 400, st)
r = xa.post("/api/quiz/answer", json={"assignment": N3, "question": sort_q["qid"], "response": json.dumps(sort_q["correct"])}).get_json()
check("…and every item in its group is all of it", r.get("correct") is True and r.get("earned") == 4, r)

# Predict the output: marked like a short answer; the real output comes back only with an answer.
PREDICT = "```quiz\ntype: predict\nWhat prints?\n~~~python\nprint(1)\nprint(2)\n~~~\nanswer: 1 PREDICTKEY\npoints: 2\n```\n"
put(teacher, "nq4", project("nq4", "Predict game"), 0)
N4 = teacher.post(f"/api/classes/{XC}/assignments", json={"title": "Predict", "project": "nq4"}).get_json()["slug"]
teacher.post(f"/api/assignments/{N4}/notes", json={"notes": PREDICT})
P4 = xa.post(f"/api/assignments/{N4}/start").get_json()["project"]
seen4 = json.dumps(xa.get(f"/api/projects/{P4}/assignment").get_json()) + json.dumps(xa.get(f"/api/quiz/{N4}/mine").get_json())
check("a predict question's output doesn't reach a student before they answer", "PREDICTKEY" not in seen4 and "print(2)" in seen4)
pq4 = quizmod.keys(PREDICT)[0]
r = xa.post("/api/quiz/answer", json={"assignment": N4, "question": pq4["qid"], "response": "1\npredictkey\n"}).get_json()
check("a prediction over several lines is marked kindly, and the real output comes back with it",
      r.get("correct") is True and r.get("earned") == 2 and r.get("output") == "1 PREDICTKEY", r)
check("…and with the answer when the page asks again", xa.get(f"/api/quiz/{N4}/mine").get_json()["answers"][pq4["qid"]].get("output") == "1 PREDICTKEY")
r = teacher.post("/api/quiz/grade", json={"assignment": N, "student": ids["xa"], "question": long_q["qid"], "score": 3}).get_json()
check("its teacher marks it, and it counts", r.get("total") == 4.5, r)

# Tests: the student's own check is feedback; the teacher's counts.
fake = [{"label": "object Player exists", "ok": True, "points": 99}, {"label": "Player has event step", "ok": False, "points": 2},
        {"label": "uses keyboard_check", "ok": True}, {"label": "made up (50 points)", "ok": True, "points": 50}]
before = xa.get("/api/me/xp").get_json()["xp"]
r = xa.post("/api/tests/self", json={"assignment": N, "results": fake}).get_json()
check("a student's check keeps only the notes' tests, at the notes' points", r.get("earned") == 2 and r.get("possible") == 4, r)
check("…pays a little XP for each real one passing", r.get("xp") == 2 * xp.SELF_TEST_XP, r)
check("…once each", xa.post("/api/tests/self", json={"assignment": N, "results": fake}).get_json().get("xp") == 0)
check("…and counts toward no grade", {x["email"]: x for x in teacher.get(f"/api/assignments/{N}").get_json()["rows"]}["xa@example.com"]["total"] == 4.5)
check("a student can't send the teacher's check", xa.post(f"/api/assignments/{N}/tests/verify", json={"student": ids["xa"], "results": fake}).status_code == 403)
check("Check all has nothing to check before anything is frozen", teacher.get(f"/api/assignments/{N}/tests/work").get_json()["work"] == [])
xa.post(f"/api/projects/{NP}/turn-in")
work = teacher.get(f"/api/assignments/{N}/tests/work").get_json()
check("Check all gets each turned-in version, and the tests", [w["project"] for w in work["work"]] == [NP] and len(work["tests"]) == 3, work)
r = teacher.post(f"/api/assignments/{N}/tests/verify", json={"student": ids["xa"], "results": fake}).get_json()
check("the teacher's check counts toward the grade", r.get("earned") == 2 and r.get("total") == 6.5, r)
check("…and pays XP for each test's points, once", r.get("xp") == 2 * xp.XP_PER_POINT
      and teacher.post(f"/api/assignments/{N}/tests/verify", json={"student": ids["xa"], "results": fake}).get_json().get("xp") == 0)
check("only for someone who turned something in", teacher.post(f"/api/assignments/{N}/tests/verify", json={"student": ids["xc"], "results": fake}).status_code == 404)
db = server.SessionLocal()
db.query(accounts.TestResult).filter_by(student_id=ids["xa"], kind="verified").update(
    {"checked_at": accounts.now() - __import__("datetime").timedelta(hours=1)}, synchronize_session=False)
db.commit()
db.close()
xa.post(f"/api/projects/{NP}/turn-in")
res = {x["email"]: x for x in teacher.get(f"/api/assignments/{N}").get_json()["rows"]}["xa@example.com"]
check("a check older than the last turn-in is marked stale", res["testsVerified"]["stale"] is True and res["testsSelf"]["earned"] == 2)
check("the student's class page shows the total", [i for i in xa.get(f"/api/classes/{XC}").get_json()["items"] if i.get("slug") == N][0]["score"] == 6.5)

# Full marks from the notes alone (no points set): the quest pays when everything is earned.
put(teacher, "nq2", project("nq2", "Quiz only"), 0)
N2 = teacher.post(f"/api/classes/{XC}/assignments", json={"title": "Just a question", "project": "nq2"}).get_json()["slug"]
teacher.post(f"/api/assignments/{N2}/notes", json={"notes": "```quiz\nOne?\nanswer: one\n```"})
teacher.post(f"/api/assignments/{N2}/xp-bonus", json={"xp": 25})
qid2 = quizmod.keys("```quiz\nOne?\nanswer: one\n```")[0]["qid"]
before = xb.get("/api/me/xp").get_json()["xp"]
xb.post(f"/api/assignments/{N2}/start")
r = xb.post("/api/quiz/answer", json={"assignment": N2, "question": qid2, "response": "one"}).get_json()
check("with no points set, earning everything in the notes is full marks, and pays the quest", r.get("xp", 0) >= 25 + xp.XP_PER_POINT, r)

# ---------------------------------------------------------------- tutorials (tutorials.py)
import tutorials as tutmod  # noqa: E402

TUT = "---\ntitle: Bounce\nlevel: Top-Down\nstarter: empty\n---\n# Start\nHello\n---\n## Make a ball\n```check\nobject Ball exists\n```\n---\n## Done\nYay"
r = xa.post("/api/tutorials", json={"markdown": TUT})
check("only a teacher writes a tutorial", r.status_code == 403)
check("a tutorial needs its header", teacher.post("/api/tutorials", json={"markdown": "# no header"}).status_code == 400)
check("only an admin publishes one for everyone", teacher.post("/api/tutorials", json={"markdown": TUT, "visibility": "site"}).status_code == 400)
TS = teacher.post("/api/tutorials", json={"markdown": TUT}).get_json()["slug"]
listed = {t["slug"]: t for t in teacher.get("/api/tutorials").get_json()["tutorials"]}
check("a teacher's tutorial is listed for them, with its steps", listed.get(TS, {}).get("steps") == 3 and listed[TS]["level"] == "Top-Down", listed.get(TS))
check("…private at first: not for their students", TS not in [t["slug"] for t in xa.get("/api/tutorials").get_json()["tutorials"]]
      and xa.get(f"/api/tutorials/{TS}").status_code == 404)
check("only its author changes it", other_teacher.post(f"/api/tutorials/{TS}", json={"markdown": TUT, "visibility": "classes"}).status_code == 403)
teacher.post(f"/api/tutorials/{TS}", json={"markdown": TUT, "visibility": "classes"})
check("shared with classes, the author's students see it", TS in [t["slug"] for t in xa.get("/api/tutorials").get_json()["tutorials"]]
      and "Make a ball" in xa.get(f"/api/tutorials/{TS}").get_json().get("markdown", ""))
check("…and nobody else", TS not in [t["slug"] for t in bob.get("/api/tutorials").get_json()["tutorials"]] and bob.get(f"/api/tutorials/{TS}").status_code == 404)
check("an admin can publish it for everyone", admin.post(f"/api/tutorials/{TS}", json={"markdown": TUT, "visibility": "site"}).status_code == 200
      and TS in [t["slug"] for t in anon.get("/api/tutorials").get_json()["tutorials"]])

# XP for steps: once each, only steps with checks, and a bonus at the end.
before = xa.get("/api/me/xp").get_json()["xp"]
check("a step with no check pays nothing", xa.post("/api/tutorials/step", json={"key": "builtin:first-game", "step": 0}).get_json().get("xp") == 0)
check("a step with a check pays a little", xa.post("/api/tutorials/step", json={"key": "builtin:first-game", "step": 1}).get_json().get("xp") == xp.SELF_TEST_XP)
check("…once", xa.post("/api/tutorials/step", json={"key": "builtin:first-game", "step": 1}).get_json().get("xp") == 0)
last = len(tutmod.steps_of(tutmod.builtin("first-game"))) - 1
check("finishing pays its bonus", xa.post("/api/tutorials/step", json={"key": "builtin:first-game", "step": last}).get_json().get("xp") == xp.ALL_ANSWERED_XP)
check("a step that isn't there is refused", xa.post("/api/tutorials/step", json={"key": "builtin:first-game", "step": last + 1}).status_code == 400)
check("…and a tutorial that isn't, however its name is spelled", xa.post("/api/tutorials/step", json={"key": "builtin:../tutorials/first-game", "step": 1}).status_code == 404)
teacher.post(f"/api/tutorials/{TS}", json={"markdown": TUT, "visibility": "private"})
check("a private tutorial pays no one else", bob.post("/api/tutorials/step", json={"key": "t:" + TS, "step": 1}).status_code == 404)
check("teachers earn nothing from tutorials", teacher.post("/api/tutorials/step", json={"key": "builtin:first-game", "step": 2}).get_json().get("xp") == 0)

# A tutorial assigned to a class: an assignment whose notes are the tutorial.
put(teacher, "tg1", project("tg1", "Tutorial start"), 0)
r = teacher.post(f"/api/classes/{XC}/assignments", json={"title": "Bounce", "project": "tg1", "notes": TUT})
TA = r.get_json().get("slug")
check("assigning a tutorial makes an assignment whose notes are the tutorial", r.status_code == 201 and teacher.get(f"/api/assignments/{TA}").get_json()["notes"] == TUT)
check("…its checks are what Check all checks", [t["label"] for t in teacher.get(f"/api/assignments/{TA}").get_json()["tests"]] == ["object Ball exists"])
check("…the assignment's tutorial pays only those who have it", xc.post("/api/tutorials/step", json={"key": "a:" + TA, "step": 1}).status_code == 404)
TP = xc.post(f"/api/assignments/{TA}/start").get_json()["project"]
check("…and them", xc.post("/api/tutorials/step", json={"key": "a:" + TA, "step": 1}).get_json().get("xp") == xp.SELF_TEST_XP)
game = xc.get(f"/api/projects/{TP}").get_json()
game["data"]["tutorial"] = {"key": "a:" + TA, "step": 2, "steps": 3, "title": "Bounce"}
put(xc, TP, game["data"], game["version"])
check("My Games knows a game's tutorial and how far it's got", ({g["id"]: g for g in xc.get("/api/projects").get_json()["projects"]}[TP].get("tutorial") or {}).get("step") == 2)
check("…and so do the teacher's results", {x["email"]: x for x in teacher.get(f"/api/assignments/{TA}").get_json()["rows"]}["xc@example.com"]["tutorial"] == {"step": 2, "steps": 3})

# The tests' database refuses what Postgres would: a row pointing at nothing.
db = server.SessionLocal()
try:
    db.add(accounts.ClassItem(class_id=987654, title="orphan"))
    db.commit()
    refused = False
except Exception:
    db.rollback()
    refused = True
db.close()
check("the tests' database enforces foreign keys, as Render's Postgres does", refused)

# Deleting a class that has had a random event (rows that point at it).
DC = teacher.post("/api/classes", json={"name": "Short-lived"}).get_json()["id"]
teacher.post(f"/api/classes/{DC}/students", json={"emails": "xa@example.com"})
teacher.post(f"/api/classes/{DC}/event")
xp_before_delete = xa.get("/api/me/xp").get_json()["xp"]
check("a class that has had a random event can be deleted", teacher.delete(f"/api/classes/{DC}").status_code == 200)
check("…and the XP its event gave stays with the students", xa.get("/api/me/xp").get_json()["xp"] == xp_before_delete)

# ---------------------------------------------------------------- the built editor's files
# The blocks editor's media come from our own origin (vite.config.ts copies
# them into dist/blockly-media); without this route the trash can and drag
# cursors 404 in production only, where the dev server isn't there to serve them.
fake_dist = Path(tempfile.mkdtemp())
(fake_dist / "blockly-media").mkdir()
(fake_dist / "blockly-media" / "sprites.svg").write_text("<svg/>")
real_dist, server.DIST = server.DIST, fake_dist
r = anon.get("/blockly-media/sprites.svg")
check("Blockly's media are served from our origin", r.status_code == 200 and r.data == b"<svg/>", r.status_code)
check("…and nothing outside that folder", anon.get("/blockly-media/../index.html").status_code == 404)
(fake_dist / "favicon.svg").write_text("<svg>mark</svg>")
(fake_dist / "tutorials").mkdir()
(fake_dist / "tutorials" / "index.json").write_text('[{"key": "first-game"}]')
real_dist, server.DIST = server.DIST, fake_dist
r = anon.get("/favicon.svg")
check("the favicon is served", r.status_code == 200 and b"mark" in r.data)
r = anon.get("/tutorials/index.json")
check("the built-in tutorials are served", r.status_code == 200 and b"first-game" in r.data)
check("…and nothing beside them", anon.get("/tutorials/../favicon.svg").status_code == 404)
(fake_dist / "library" / "kenney" / "tiny-town").mkdir(parents=True)
(fake_dist / "library" / "kenney" / "tiny-town" / "tiles.png").write_bytes(b"PNGTILES")
r = anon.get("/library/kenney/tiny-town/tiles.png")
check("the free art library's pictures are served", r.status_code == 200 and r.data == b"PNGTILES", r.status_code)
(fake_dist / "starters" / "novel").mkdir(parents=True)
(fake_dist / "starters" / "novel" / "dawn.webp").write_bytes(b"WEBPDAWN")
r = anon.get("/starters/novel/dawn.webp")
check("the Starter Projects' pictures are served", r.status_code == 200 and r.data == b"WEBPDAWN", r.status_code)
server.DIST = real_dist

print()
if failures:
    print(f"FAILED: {len(failures)} — " + "; ".join(failures))
    sys.exit(1)
print("all server checks ok")
