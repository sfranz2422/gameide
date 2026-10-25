# Backend

Flask + SQLAlchemy + Authlib, sharing PyIDE's `accounts.py`, database and
Google sign-in (see ../CLAUDE.md for why not Django). It signs people in,
keeps projects, pictures and history, and serves the built editor. It never
runs game code.

```
python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt
GAMEIDE_DEV_LOGIN=1 .venv/bin/python app.py      # http://localhost:5001
.venv/bin/python tests/test_server.py            # the server's checks
```
