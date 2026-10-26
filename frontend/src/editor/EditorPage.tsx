/**
 * The editor: resource tree | open resources in tabs | game over console/docs.
 * Every boundary is draggable, and the sizes are remembered.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildGame, mapError, type MappedError, type ObjectSource } from "../python/codegen";
import type { GameState, WorkerStats } from "../python/protocol";
import { find, type Project } from "../store/project";
import type { ProjectStore } from "../store/store";
import { addStarterSprite } from "../store/templates";
import { GameHost } from "./gameHost";
import { ObjectEditor, type EventFocus } from "./ObjectEditor";
import { FontEditor, SoundEditor } from "./MediaEditors";
import { PublishButton } from "./PublishDialog";
import { ScriptEditor, SettingsEditor, SpritePicker } from "./OtherEditors";
import { RoomEditor } from "./rooms/RoomEditor";
import { TilesetEditor } from "./tiles/TilesetEditor";
import { SpriteEditor } from "./sprites/SpriteEditor";
import { SpriteImport, type ImportResult } from "./sprites/SpriteImport";
import { decodeImage, type Decoded } from "../store/imageTools";
import { refitMask, spriteFromFrames } from "../store/spriteOps";
import { newId, newTileset } from "../store/project";
import { LibraryBrowser } from "../library/LibraryBrowser";
import { ResourceTree, type TabRef } from "./ResourceTree";
import { ConsolePane, DocsPane, GamePane, type ConsoleLine } from "./RunPanes";
import { Icon } from "./ui/icons";
import { ThemeToggle } from "./ui/ThemeToggle";
import { AccountMenu, ExportButton, HistoryButton, SaveStatusView } from "./AccountBits";
import { AssignmentButtons, useAssignment, ViewBar } from "./AssignmentBits";
import { NotesPane } from "../notes/NotesPane";
import { hostRunner } from "../checks/hostRunner";
import { TutorialPane } from "../tutorials/TutorialPane";
import { isTutorial } from "../tutorials/tutorial";
import { api as request } from "../store/api";
import type { ViewStore } from "../store/viewStore";
import { claimRun } from "../xp/runXp";
import { useSession } from "./session";

/**
 * How long a game must run without an error to count as a game that ran,
 * for XP (xp/runXp.ts): long enough that one crashing in its first frames
 * doesn't, short enough that a student testing a jump does.
 */
const RUN_COUNTS_MS = 5000;
import { Splitter, usePaneSize } from "./ui/Splitter";
import { ProjectContext, useProjectState, type ProjectApi } from "./useProject";

const MAX_CONSOLE = 1000;

function tabLabel(p: Project, t: TabRef): string | null {
  if (t.kind === "settings") return "Game settings";
  return find(p, t.kind, t.id)?.name ?? null;
}

const TAB_ICON = {
  sprites: Icon.sprite,
  tilesets: Icon.tileset,
  objects: Icon.object,
  rooms: Icon.room,
  scripts: Icon.script,
  sounds: Icon.sound,
  fonts: Icon.font,
  settings: Icon.settings,
};

export function EditorPage({ store, id }: { store: ProjectStore; id: string }) {
  const state = useProjectState(store, id);
  const { project, assets, mutate, addAssets, status, saveError, saveNote, setSaveNote, loadError, replace, undo, redo, undoLabel, redoLabel, endUndoGroup } = state;

  const [tabs, setTabs] = useState<TabRef[]>([]);
  const [active, setActive] = useState<TabRef | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Record<string, string | null>>({});
  const [focus, setFocus] = useState<EventFocus | null>(null);
  const [scriptFocus, setScriptFocus] = useState<{ id: string; line: number; nonce: number } | null>(null);
  const [roomFocus, setRoomFocus] = useState<{ roomId: string; instanceId: string; line: number; nonce: number } | null>(null);
  const [picking, setPicking] = useState(false);
  const [library, setLibrary] = useState(false);
  const [importing, setImporting] = useState<{ source: Decoded; fileName: string; appendTo?: string } | null>(null);
  const [dropping, setDropping] = useState(false);

  const [lines, setLines] = useState<ConsoleLine[]>([]);
  const [bottom, setBottom] = useState<"console" | "docs" | "notes">("console");
  const [gameState, setGameState] = useState<GameState>("stopped");
  // For checks (notes' Check my work): the game's state and errors as they
  // happen, which the runner reads while it waits. And while checks run, an
  // error stays out of the way on the Console instead of hiding the results.
  const gameStateRef = useRef<GameState>("stopped");
  const checkErrors = useRef<string[]>([]);
  const [stats, setStats] = useState<WorkerStats | null>(null);
  const [ready, setReady] = useState(false);
  const [host, setHost] = useState<GameHost | null>(null);
  const sources = useRef<Record<string, ObjectSource>>({});
  const { me } = useSession();
  // A game that has run RUN_COUNTS_MS without an error is claimed for XP.
  // An error, a stop or another Play before then cancels it.
  const runClaim = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelClaim = useCallback(() => {
    if (runClaim.current) clearTimeout(runClaim.current);
    runClaim.current = null;
  }, []);
  const projectRef = useRef(project);
  projectRef.current = project;

  const [treeW, setTreeW] = usePaneSize("tree", 220, 160, 420);
  const [rightW, setRightW] = usePaneSize("right", 520, 300, 1100);
  const [gameH, setGameH] = usePaneSize("game", 380, 160, 900);

  const addLines = useCallback((more: ConsoleLine[]) => setLines((ls) => [...ls, ...more].slice(-MAX_CONSOLE)), []);

  useEffect(() => {
    const h = new GameHost({
      state: (s) => {
        gameStateRef.current = s;
        setGameState(s);
      },
      output: (ls) => addLines(ls),
      error: (e) => {
        cancelClaim();
        const p = projectRef.current;
        const mapped = p ? mapError(p, sources.current, e) : { where: null, message: e.message, traceback: e.traceback, target: null, hang: !!e.hang };
        addLines([{ kind: "error", error: mapped }]);
        checkErrors.current.push(`${mapped.where ? `${mapped.where}: ` : ""}${mapped.message}`);
        setBottom((b) => (b === "notes" ? b : "console"));
      },
      stats: setStats,
      ready: setReady,
    });
    setHost(h);
    (window as unknown as Record<string, unknown>).__gameide = { host: h };
    return () => h.dispose();
  }, [addLines, cancelClaim]);

  const open = useCallback((t: TabRef) => {
    setTabs((ts) => (ts.some((x) => x.id === t.id) ? ts : [...ts, t]));
    setActive(t);
  }, []);

  const closeTabs = useCallback((ids: string[]) => {
    setTabs((ts) => {
      const next = ts.filter((t) => !ids.includes(t.id));
      setActive((a) => (a && ids.includes(a.id) ? next[next.length - 1] ?? null : a));
      return next;
    });
  }, []);

  // Open the first object (or room) when a project loads, so the page isn't empty.
  const opened = useRef(false);
  useEffect(() => {
    if (!project || opened.current) return;
    opened.current = true;
    const first = project.objects[0] ? { kind: "objects" as const, id: project.objects[0].id } : { kind: "rooms" as const, id: project.rooms[0]!.id };
    open(first);
  }, [project, open]);

  const play = useCallback(() => {
    const p = projectRef.current;
    if (!p || !host) return;
    const built = buildGame(p, assets);
    sources.current = built.sources;
    addLines([{ kind: "info", text: `▶ ${p.name}` }]);
    // The notes stay open while their reader plays: a tutorial step and the
    // game are meant to be looked at together.
    setBottom((b) => (b === "notes" ? b : "console"));
    // The project's id names where its save data (save_set) lives in this browser.
    void host.play(built.def, p.id);
    cancelClaim();
    // Only a student's own game earns: not a teacher's, not one open read only.
    if (store.kind === "cloud" && me.user && !me.user.teacher)
      runClaim.current = setTimeout(() => {
        runClaim.current = null;
        void claimRun(p);
      }, RUN_COUNTS_MS);
  }, [host, assets, addLines, store, me, cancelClaim]);

  const stop = useCallback(() => {
    cancelClaim();
    host?.stop();
  }, [host, cancelClaim]);
  useEffect(() => cancelClaim, [cancelClaim]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        play();
      }
      // Ctrl+Z everywhere but where text is being typed: a code editor or a
      // box has its own undo, and taking the key there would undo the
      // project instead of the typing. Blocks and sheets have their own too.
      const t = e.target as HTMLElement | null;
      const typing = !!t && (!!t.closest(".cm-editor, .blocks-editor, .blocklyWidgetDiv, .blocklyDropDownDiv, .sheet-editor") || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (!typing && (e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "z" || e.key.toLowerCase() === "y")) {
        e.preventDefault();
        if (e.key.toLowerCase() === "y" || e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [play, undo, redo]);

  const jump = useCallback(
    (e: MappedError) => {
      const t = e.target;
      if (!t) return;
      if (t.kind === "event") {
        open({ kind: "objects", id: t.objectId });
        setSelectedEvent((s) => ({ ...s, [t.objectId]: t.eventId }));
        setFocus({ eventId: t.eventId, line: t.line, nonce: Date.now() });
      } else if (t.kind === "script") {
        open({ kind: "scripts", id: t.scriptId });
        setScriptFocus({ id: t.scriptId, line: t.line, nonce: Date.now() });
      } else {
        open({ kind: "rooms", id: t.roomId });
        setRoomFocus({ roomId: t.roomId, instanceId: t.instanceId, line: t.line, nonce: Date.now() });
      }
    },
    [open],
  );

  /** Opens a picture in the importer (as a new sprite, or more frames for `appendTo`). */
  const startImport = useCallback(
    async (file: File, appendTo?: string) => {
      setPicking(false);
      try {
        setImporting({ source: await decodeImage(file), fileName: file.name || "pasted picture", ...(appendTo ? { appendTo } : {}) });
      } catch (e) {
        addLines([{ kind: "err", text: e instanceof Error ? e.message : String(e) }]);
        setBottom("console");
      }
    },
    [addLines],
  );

  const chooseFile = useCallback(
    (appendTo?: string) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/png,image/jpeg,image/gif,image/webp";
      input.onchange = () => input.files?.[0] && void startImport(input.files[0], appendTo);
      input.click();
    },
    [startImport],
  );

  const finishImport = useCallback(
    async (r: ImportResult) => {
      const job = importing;
      setImporting(null);
      const p = projectRef.current;
      if (!job || !p) return;
      if (job.appendTo) {
        const target = p.sprites.find((s) => s.id === job.appendTo);
        if (!target) return;
        const added = new Map(r.frames.map((b) => [newId(), b] as const));
        await addAssets(added);
        const frames = [...target.frames, ...added.keys()];
        const all = frames.map((id) => assets.get(id) ?? added.get(id)).filter((b): b is Blob => !!b);
        const mask = await refitMask(target.mask, all, target.width, target.height);
        mutate((d) => {
          const s = d.sprites.find((x) => x.id === target.id)!;
          s.frames = frames;
          if (mask) s.mask = mask;
        });
        return;
      }
      const { sprite, assets: made } = await spriteFromFrames(r, p.sprites.map((s) => s.name));
      await addAssets(made);
      mutate((d) => void d.sprites.push(sprite));
      open({ kind: "sprites", id: sprite.id });
    },
    [importing, addAssets, assets, mutate, open],
  );

  // A picture dropped anywhere on the editor, or pasted while not typing in
  // a box, becomes a sprite — the quickest way from a drawing to a game.
  useEffect(() => {
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes("Files");
    const over = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setDropping(true);
    };
    const leave = (e: DragEvent) => {
      if (!e.relatedTarget) setDropping(false);
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setDropping(false);
      const f = [...(e.dataTransfer?.files ?? [])].find((x) => x.type.startsWith("image/"));
      if (f) void startImport(f);
      else addLines([{ kind: "err", text: "Only pictures (PNG, JPG, GIF) can be dropped here." }]);
    };
    const paste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.closest(".cm-editor") || t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith("image/"));
      if (f) {
        e.preventDefault();
        void startImport(f);
      }
    };
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    window.addEventListener("paste", paste);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
      window.removeEventListener("paste", paste);
    };
  }, [startImport, addLines]);

  const api: ProjectApi | null = useMemo(
    () =>
      project
        ? { project, assets, mutate, addAssets, status, saveError, saveNote, replace, store, undo, redo, undoLabel, redoLabel, endUndoGroup }
        : null,
    [project, assets, mutate, addAssets, status, saveError, saveNote, replace, store, undo, redo, undoLabel, redoLabel, endUndoGroup],
  );

  // "Another tab saved too" and the like: worth a line in the console.
  useEffect(() => {
    if (!saveNote) return;
    addLines([{ kind: "warn", text: saveNote }]);
    setSaveNote(null);
  }, [saveNote, setSaveNote, addLines]);

  // An assignment's game: its notes (a Notes tab, open first) and, for the
  // student, Turn in. The checks in the notes play this editor's own game.
  const { a: assignment, reload: reloadAssignment } = useAssignment(store, id);
  const notes = assignment?.notes?.trim() ? assignment.notes : "";
  // A tutorial: the one this game follows (its own record of it), or the
  // assignment's notes when they are one (a tutorial assigned to a class).
  const tutorialKey = project?.tutorial?.key ?? (assignment && isTutorial(assignment.notes) ? `a:${assignment.slug}` : null);
  const [tutorialMd, setTutorialMd] = useState<string | null>(null);
  useEffect(() => {
    if (!tutorialKey) return setTutorialMd(null);
    const [kind, name] = [tutorialKey.slice(0, tutorialKey.indexOf(":")), tutorialKey.slice(tutorialKey.indexOf(":") + 1)];
    let alive = true;
    const got = (md: string | null) => alive && setTutorialMd(md);
    if (kind === "a") got(assignment?.slug === name ? assignment.notes : null);
    else if (kind === "builtin")
      // From the editor's own files, so it works signed out and offline once loaded.
      void fetch(new URL(`tutorials/${name}.md`, document.baseURI)).then((r) => (r.ok ? r.text() : null)).then(got, () => got(null));
    else if (kind === "t") void request<{ markdown: string }>(`/api/tutorials/${encodeURIComponent(name)}`).then((r) => got(r.markdown), () => got(null));
    return () => {
      alive = false;
    };
  }, [tutorialKey, assignment]);
  const openedNotes = useRef(false);
  useEffect(() => {
    if ((notes || tutorialMd) && !openedNotes.current) {
      openedNotes.current = true;
      setBottom("notes");
    }
  }, [notes, tutorialMd]);
  const runner = useMemo(
    () => (host ? hostRunner(host, () => buildGame(projectRef.current!, assets).def, { state: () => gameStateRef.current, errors: checkErrors.current }, play) : null),
    [host, assets, play],
  );

  if (loadError)
    return (
      <div className="center-message">
        <p>{loadError}</p>
        <a href="#/games">Back to your games</a>
      </div>
    );
  if (!api || !project) return <div className="center-message">Opening…</div>;

  const visibleTabs = tabs.filter((t) => tabLabel(project, t) !== null);
  const current = active && tabLabel(project, active) !== null ? active : null;

  return (
    <ProjectContext.Provider value={api}>
      <div className="ide">
        <header className="topbar">
          <a className="brand" href="#/games" title="Your games">
            {Icon.home()} GameIDE
          </a>
          <input
            className="project-name"
            value={project.name}
            onChange={(e) => mutate((p) => void (p.name = e.target.value), { label: "rename the game" })}
            aria-label="Game name"
            data-tutorial="project-name"
          />
          {store.kind !== "view" && <SaveStatusView status={status} error={saveError} />}
          <button className="icon-btn" onClick={undo} disabled={!undoLabel} title={undoLabel ? `Undo ${undoLabel} (Ctrl+Z)` : "Nothing to undo"} aria-label="Undo" data-testid="undo">
            ↶
          </button>
          <button className="icon-btn" onClick={redo} disabled={!redoLabel} title={redoLabel ? `Redo ${redoLabel} (Ctrl+Shift+Z)` : "Nothing to redo"} aria-label="Redo" data-testid="redo">
            ↷
          </button>
          <span className="spacer" />
          {store.kind === "view" ? (
            <ViewBar projectId={id} versionId={(store as ViewStore).versionId} name={project.name} />
          ) : (
            <>
              <AssignmentButtons store={store} projectId={id} modified={project.modified} a={assignment} reload={reloadAssignment} />
              <HistoryButton />
              <PublishButton host={host} />
            </>
          )}
          <ExportButton />
          <AccountMenu />
          <ThemeToggle />
        </header>

        <div className="workspace" style={{ gridTemplateColumns: `${treeW}px 5px minmax(0, 1fr) 5px ${rightW}px` }}>
          <ResourceTree active={current} open={open} closeTabs={closeTabs} addSprite={() => setPicking(true)} />
          <Splitter axis="x" size={treeW} onResize={setTreeW} label="Resize resources" />

          <main className="center">
            <div className="tabs" role="tablist" data-tutorial="editor-tabs">
              {visibleTabs.map((t) => (
                <div key={t.id} className={`tab ${current?.id === t.id ? "on" : ""}`} role="tab" aria-selected={current?.id === t.id}>
                  <button className="tab-btn" onClick={() => setActive(t)}>
                    {TAB_ICON[t.kind]()} {tabLabel(project, t)}
                  </button>
                  <button className="icon-btn tab-close" aria-label={`Close ${tabLabel(project, t)}`} onClick={() => closeTabs([t.id])}>
                    {Icon.close()}
                  </button>
                </div>
              ))}
            </div>
            <div className="tab-body">
              {!current && <div className="empty-pane">Open something from the list on the left.</div>}
              {current?.kind === "objects" && (
                <ObjectEditor
                  key={current.id}
                  objectId={current.id}
                  selected={selectedEvent[current.id] ?? null}
                  select={(ev) => setSelectedEvent((s) => ({ ...s, [current.id]: ev }))}
                  focus={focus}
                />
              )}
              {current?.kind === "sprites" && <SpriteEditor key={current.id} spriteId={current.id} addFrames={() => chooseFile(current.id)} />}
              {current?.kind === "rooms" && (
                <RoomEditor key={current.id} roomId={current.id} focus={roomFocus?.roomId === current.id ? roomFocus : null} />
              )}
              {current?.kind === "scripts" && (
                <ScriptEditor key={current.id} scriptId={current.id} focus={scriptFocus?.id === current.id ? scriptFocus : null} />
              )}
              {current?.kind === "tilesets" && <TilesetEditor key={current.id} tilesetId={current.id} />}
              {current?.kind === "sounds" && <SoundEditor key={current.id} soundId={current.id} />}
              {current?.kind === "fonts" && <FontEditor key={current.id} fontId={current.id} />}
              {current?.kind === "settings" && <SettingsEditor />}
            </div>
          </main>

          <Splitter axis="x" size={rightW} onResize={setRightW} invert label="Resize game" />
          <aside className="right" style={{ gridTemplateRows: `${gameH}px 5px minmax(0, 1fr)` }}>
            <GamePane host={host} state={gameState} stats={stats} ready={ready} onPlay={play} onStop={stop} />
            <Splitter axis="y" size={gameH} onResize={setGameH} label="Resize console" />
            <section className="bottom">
              <div className="bottom-tabs" role="tablist">
                <button role="tab" aria-selected={bottom === "console"} className={bottom === "console" ? "on" : ""} onClick={() => setBottom("console")}>
                  {Icon.console()} Console
                </button>
                {(notes || tutorialMd) && (
                  <button role="tab" aria-selected={bottom === "notes"} className={bottom === "notes" ? "on" : ""} onClick={() => setBottom("notes")} data-tutorial="notes-tab" data-testid="notes-tab">
                    {Icon.notes()} Notes
                  </button>
                )}
                <button role="tab" aria-selected={bottom === "docs"} className={bottom === "docs" ? "on" : ""} onClick={() => setBottom("docs")} data-tutorial="docs-tab">
                  {Icon.docs()} Docs
                </button>
              </div>
              {bottom === "console" ? <ConsolePane lines={lines} clear={() => setLines([])} jump={jump} /> : bottom === "docs" ? <DocsPane /> : null}
              {/* Kept mounted while hidden: answers being typed and check results stay. */}
              {tutorialMd && tutorialKey ? (
                <div className="notes-holder" hidden={bottom !== "notes"}>
                  <TutorialPane
                    md={tutorialMd}
                    progress={project.tutorial ?? { key: tutorialKey, title: "", step: 0, steps: 0 }}
                    // Their own game only: a game open read only shows how far its owner got.
                    onProgress={store.kind === "view" || assignment?.teacher ? null : (t) => mutate((d) => void (d.tutorial = t), { history: "skip" })}
                    project={project}
                    runner={runner}
                    earns={store.kind === "cloud" && !!me.user && !me.user.teacher}
                  />
                </div>
              ) : notes && assignment ? (
                <div className="notes-holder" hidden={bottom !== "notes"}>
                  <NotesPane notes={notes} assignment={assignment.slug} project={project} runner={runner} practice={!!assignment.teacher || store.kind !== "cloud"} />
                </div>
              ) : null}
            </section>
          </aside>
        </div>

        {dropping && <div className="drop-overlay">Drop a picture to make a sprite</div>}
        {importing && (
          <SpriteImport
            source={importing.source}
            fileName={importing.fileName}
            {...(importing.appendTo && project.sprites.some((s) => s.id === importing.appendTo)
              ? { appendTo: project.sprites.find((s) => s.id === importing.appendTo)! }
              : {})}
            onDone={(r) => void finishImport(r)}
            onClose={() => setImporting(null)}
          />
        )}
        {library && (
          <LibraryBrowser
            onClose={() => setLibrary(false)}
            onSprite={async (lib) => {
              // As an imported strip would be: spriteFromFrames gives it a free name, its box and its speed.
              const { sprite, assets: made } = await spriteFromFrames(
                { name: lib.name, width: lib.width, height: lib.height, frames: lib.frames, fps: 8, origin: "center" },
                (projectRef.current?.sprites ?? []).map((s) => s.name),
              );
              await addAssets(made);
              mutate((d) => void d.sprites.push(sprite));
              setLibrary(false);
              open({ kind: "sprites", id: sprite.id });
            }}
            onTileset={async (lib) => {
              const bmp = await createImageBitmap(lib.image);
              const id = newId();
              await addAssets(new Map([[id, lib.image]]));
              let name = lib.name;
              for (let i = 2; (projectRef.current?.tilesets ?? []).some((t) => t.name.toLowerCase() === name.toLowerCase()); i++) name = `${lib.name}${i}`;
              const ts = { ...newTileset(name), image: id, imageWidth: bmp.width, imageHeight: bmp.height, tileWidth: lib.tileWidth, tileHeight: lib.tileHeight };
              mutate((d) => void d.tilesets.push(ts));
              setLibrary(false);
              open({ kind: "tilesets", id: ts.id });
            }}
          />
        )}
        {picking && (
          <SpritePicker
            onLibrary={() => {
              setPicking(false);
              setLibrary(true);
            }}
            onImport={() => chooseFile()}
            onClose={() => setPicking(false)}
            onPick={async (key) => {
              setPicking(false);
              // Paint first, outside the recipe (see useProject.ts), then add.
              const scratch = structuredClone(project);
              const made = new Map<string, Blob>();
              const sprite = await addStarterSprite(scratch, made, key);
              let name = sprite.name;
              for (let i = 2; project.sprites.some((s) => s.name.toLowerCase() === name.toLowerCase()); i++) name = `${sprite.name}${i}`;
              sprite.name = name;
              await addAssets(made);
              mutate((p) => void p.sprites.push(sprite));
              open({ kind: "sprites", id: sprite.id });
            }}
          />
        )}
      </div>
    </ProjectContext.Provider>
  );
}
