#!/bin/sh
# PresMaker (~/presMaker/web) into GameIDE, as its tutorial library's editor:
# tools/sync_presmaker.py is the same file as PyIDE's, told where GameIDE keeps
# things (the build's static files, the backend's templates) and to bring
# PyIDE's notes.js and friends, which GameIDE (React) hasn't got of its own.
cd "$(dirname "$0")/.." && \
PRESMAKER_STATIC=frontend/public/static PRESMAKER_TEMPLATES=backend/templates PRESMAKER_OWN_FROM="$HOME/pyide/static" \
  python3 tools/sync_presmaker.py
