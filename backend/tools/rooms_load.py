#!/usr/bin/env python3
"""
A class's worth of players in one room, against a local server, to see how the
rooms hold up: each player a WebSocket sending its climber's state 20 times a
second, with a snowball now and then; it reports the round trip (a ping) and how
long a state takes to reach the others. Local only: it signs in with the dev
login, which Render doesn't have.

    cd backend
    GAMEIDE_DEV_LOGIN=1 GAMEIDE_ONE_PROCESS=1 GAMEIDE_TEST_DATABASE_URL=sqlite:////tmp/load.db \\
        .venv/bin/gunicorn app:app --workers 1 --threads 64 --bind 127.0.0.1:5077 &
    .venv/bin/python tools/rooms_load.py http://127.0.0.1:5077 20 20 [tag]
"""
import json
import statistics
import sys
import threading
import time

import requests
import simple_websocket

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5077"
PLAYERS = int(sys.argv[2]) if len(sys.argv) > 2 else 20
SECONDS = int(sys.argv[3]) if len(sys.argv) > 3 else 20
#: Run several at once with different tags: each needs its own pretend students.
TAG = sys.argv[4] if len(sys.argv) > 4 else ""


def signed_in(email):
    s = requests.Session()
    s.get(f"{BASE}/dev/login", params={"email": email}, allow_redirects=False)
    return s


owner = signed_in(f"load{TAG}.owner@example.com")
project = {"format": "gameide-project", "schemaVersion": 8, "id": "loadgame", "name": "Load", "objects": [], "sprites": [],
           "rooms": [], "scripts": [], "settings": {"stepsPerSecond": 60}}
project["id"] = f"loadgame{TAG}"
owner.put(f"{BASE}/api/projects/loadgame{TAG}", json={"data": project, "base": 0})
slug = owner.post(f"{BASE}/api/projects/loadgame{TAG}/publish", json={"title": "Load", "visibility": "unlisted"}).json()["published"]["id"]
room = owner.post(f"{BASE}/api/play/{slug}/net/create", json={}).json()
code = room["code"]

pings, delays, frames, errors = [], [], [0], []
stop = threading.Event()
lock = threading.Lock()


def player(i, joined, session):
    url = BASE.replace("http", "ws") + "/api/net/ws"
    cookie = "; ".join(f"{k}={v}" for k, v in session.cookies.items())
    ws = simple_websocket.Client.connect(url, headers={"Cookie": cookie})
    ws.send(json.dumps({"token": joined["token"], "after": joined["after"]}))
    last_ping = 0
    while not stop.is_set():
        t = time.time()
        body = {"state": {"x": i, "y": 0, "t": t}, "away": False}
        if i == 0 and int(t * 2) % 4 == 0:
            body["msgs"] = [{"ball": [0, 0, 7, -1]}]
        if t - last_ping > 1:
            body["ping"] = t
            last_ping = t
        ws.send(json.dumps(body))
        end = t + 0.05
        while time.time() < end:
            try:
                data = ws.receive(timeout=max(0.001, end - time.time()))
            except Exception as e:   # noqa: BLE001
                with lock:
                    errors.append(repr(e))
                return
            if not data:
                continue
            m = json.loads(data)
            now = time.time()
            with lock:
                if "pong" in m:
                    pings.append((now - m["pong"]) * 1000)
                elif "players" in m:
                    frames[0] += 1
                    for p in m["players"]:
                        sent = p["state"].get("t")
                        if sent:
                            delays.append((now - sent) * 1000)
    ws.close()


threads = []
for i in range(PLAYERS):
    s = owner if i == 0 else signed_in(f"load{TAG}{i}@example.com")
    joined = room if i == 0 else s.post(f"{BASE}/api/play/{slug}/net/join", json={"code": code}).json()
    if "token" not in joined:
        print("couldn't join:", joined)
        continue
    th = threading.Thread(target=player, args=(i, joined, s), daemon=True)
    th.start()
    threads.append(th)
time.sleep(SECONDS)
stop.set()
for th in threads:
    th.join(timeout=3)
q = lambda xs, k: statistics.quantiles(xs, n=20)[k] if len(xs) > 20 else (max(xs) if xs else 0)
print(f"{len(threads)} players, {SECONDS} s: {frames[0]} frames received ({frames[0] / SECONDS / max(1, len(threads)):.1f}/s each)")
print(f"ping ms: median {statistics.median(pings):.0f}, 95% {q(pings, 18):.0f}" if pings else "no pings")
print(f"another's state reached them, ms: median {statistics.median(delays):.0f}, 95% {q(delays, 18):.0f}" if delays else "no states")
print("errors:", errors[:3])
