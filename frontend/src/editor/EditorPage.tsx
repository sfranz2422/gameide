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
import { RoomEditor, ScriptEditor, SettingsEditor, SpriteEditor, SpritePicker } from "./OtherEditors";
import { ResourceTree, type TabRef } from "./ResourceTree";
import { ConsolePane, DocsPane, GamePane, type ConsoleLine } from "./RunPanes";
import { Icon } from "./ui/icons";
import { ThemeToggle } from "./ui/ThemeToggle";
import { Splitter, usePaneSize } from "./ui/Splitter";
import { ProjectContext, useProjectState, type ProjectApi } from "./useProject";

const MAX_CONSOLE = 1000;

function tabLabel(p: Project, t: TabRef): string | null {
  if (t.kind === "settings") return "Game settings";
  return find(p, t.kind, t.id)?.name ?? null;
}

const TAB_ICON = { sprites: Icon.sprite, objects: Icon.object, rooms: Icon.room, scripts: Icon.script, settings: Icon.settings };

export function EditorPage({ store, id }: { store: ProjectStore; id: string }) {
  const state = useProjectState(store, id);
  const { project, assets, mutate, addAssets, status, saveError, loadError } = state;

  const [tabs, setTabs] = useState<TabRef[]>([]);
  const [active, setActive] = useState<TabRef | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Record<string, string | null>>({});
  const [focus, setFocus] = useState<EventFocus | null>(null);
  const [scriptFocus, setScriptFocus] = useState<{ id: string; line: number; nonce: number } | null>(null);
  const [picking, setPicking] = useState(false);

  const [lines, setLines] = useState<ConsoleLine[]>([]);
  const [bottom, setBottom] = useState<"console" | "docs">("console");
  const [gameState, setGameState] = useState<GameState>("stopped");
  const [stats, setStats] = useState<WorkerStats | null>(null);
  const [ready, setReady] = useState(false);
  const [host, setHost] = useState<GameHost | null>(null);
  const sources = useRef<Record<string, ObjectSource>>({});
  const projectRef = useRef(project);
  projectRef.current = project;

  const [treeW, setTreeW] = usePaneSize("tree", 220, 160, 420);
  const [rightW, setRightW] = usePaneSize("right", 520, 300, 1100);
  const [gameH, setGameH] = usePaneSize("game", 380, 160, 900);

  const addLines = useCallback((more: ConsoleLine[]) => setLines((ls) => [...ls, ...more].slice(-MAX_CONSOLE)), []);

  useEffect(() => {
    const h = new GameHost({
      state: setGameState,
      output: (ls) => addLines(ls),
      error: (e) => {
        const p = projectRef.current;
        const mapped = p ? mapError(p, sources.current, e) : { where: null, message: e.message, traceback: e.traceback, target: null, hang: !!e.hang };
        addLines([{ kind: "error", error: mapped }]);
        setBottom("console");
      },
      stats: setStats,
      ready: setReady,
    });
    setHost(h);
    (window as unknown as Record<string, unknown>).__gameide = { host: h };
    return () => h.dispose();
  }, [addLines]);

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
    setBottom("console");
    void host.play(built.def);
  }, [host, assets, addLines]);

  const stop = useCallback(() => host?.stop(), [host]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        play();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [play]);

  const jump = useCallback(
    (e: MappedError) => {
      const t = e.target;
      if (!t) return;
      if (t.kind === "event") {
        open({ kind: "objects", id: t.objectId });
        setSelectedEvent((s) => ({ ...s, [t.objectId]: t.eventId }));
        setFocus({ eventId: t.eventId, line: t.line, nonce: Date.now() });
      } else {
        open({ kind: "scripts", id: t.scriptId });
        setScriptFocus({ id: t.scriptId, line: t.line, nonce: Date.now() });
      }
    },
    [open],
  );

  const api: ProjectApi | null = useMemo(
    () => (project ? { project, assets, mutate, addAssets, status, saveError } : null),
    [project, assets, mutate, addAssets, status, saveError],
  );

  if (loadError)
    return (
      <div className="center-message">
        <p>{loadError}</p>
        <a href="#/">Back to your games</a>
      </div>
    );
  if (!api || !project) return <div className="center-message">Opening…</div>;

  const visibleTabs = tabs.filter((t) => tabLabel(project, t) !== null);
  const current = active && tabLabel(project, active) !== null ? active : null;

  return (
    <ProjectContext.Provider value={api}>
      <div className="ide">
        <header className="topbar">
          <a className="brand" href="#/" title="Your games">
            {Icon.home()} GameIDE
          </a>
          <input
            className="project-name"
            value={project.name}
            onChange={(e) => mutate((p) => void (p.name = e.target.value))}
            aria-label="Game name"
            data-tutorial="project-name"
          />
          <span className={`save-status ${status}`} data-testid="save-status" title={saveError ?? ""}>
            {status === "saved" ? "Saved" : status === "saving" ? "Saving…" : "Not saved!"}
          </span>
          <span className="spacer" />
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
              {current?.kind === "sprites" && <SpriteEditor key={current.id} spriteId={current.id} />}
              {current?.kind === "rooms" && <RoomEditor key={current.id} roomId={current.id} />}
              {current?.kind === "scripts" && (
                <ScriptEditor key={current.id} scriptId={current.id} focus={scriptFocus?.id === current.id ? scriptFocus : null} />
              )}
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
                <button role="tab" aria-selected={bottom === "docs"} className={bottom === "docs" ? "on" : ""} onClick={() => setBottom("docs")} data-tutorial="docs-tab">
                  {Icon.docs()} Docs
                </button>
              </div>
              {bottom === "console" ? <ConsolePane lines={lines} clear={() => setLines([])} jump={jump} /> : <DocsPane />}
            </section>
          </aside>
        </div>

        {picking && (
          <SpritePicker
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
