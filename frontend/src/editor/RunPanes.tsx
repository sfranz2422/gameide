/**
 * The right-hand column: the game, then Console and Docs as tabs under it.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { API, CATEGORIES, PROPERTIES } from "../catalog/api";
import type { MappedError } from "../python/codegen";
import type { GameState, WorkerStats } from "../python/protocol";
import { activeEditor } from "./code/CodeEditor";
import { signature } from "./code/pythonHelp";
import type { GameHost, Inspected } from "./gameHost";
import { Icon } from "./ui/icons";

export type ConsoleLine = { kind: "out" | "err" | "warn" | "info"; text: string } | { kind: "error"; error: MappedError };

export function GamePane({
  host,
  state,
  stats,
  ready,
  onPlay,
  onStop,
}: {
  host: GameHost | null;
  state: GameState;
  stats: WorkerStats | null;
  ready: boolean;
  onPlay: () => void;
  onStop: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [debug, setDebug] = useState(false);
  const [frozen, setFrozen] = useState(false);
  /** The instance the inspector is watching (by its slot), and what it last saw. */
  const [watching, setWatching] = useState<number | null>(null);
  const [seen, setSeen] = useState<Inspected | null>(null);
  // While watching, look again a few times a second: it is a running game.
  useEffect(() => {
    if (!debug || watching === null || !host) return;
    const t = setInterval(() => void host.inspect({ slot: watching }).then((v) => v && setSeen(v)), 300);
    return () => clearInterval(t);
  }, [debug, watching, host]);
  const running0 = state === "running" || state === "loading";
  useEffect(() => {
    // A new run, or the end of one: nothing frozen, nothing watched.
    setFrozen(false);
    setWatching(null);
    setSeen(null);
  }, [running0]);
  useEffect(() => {
    if (host) host.container = box.current;
  }, [host]);
  const running = state === "running" || state === "loading";
  return (
    <section className="game-pane" data-tutorial="game-pane">
      <header className="pane-head">
        <button className="btn play" onClick={onPlay} data-tutorial="play" data-testid="play" title="Play (Ctrl+Enter)">
          {running ? Icon.restart() : Icon.play()} {running ? "Restart" : "Play"}
        </button>
        <button className="btn" onClick={onStop} disabled={!running} data-tutorial="stop" data-testid="stop">
          {Icon.stop()} Stop
        </button>
        <button className="icon-btn" onClick={() => host?.fullscreen()} disabled={!running} title="Full screen (Esc to leave)" aria-label="Full screen" data-testid="fullscreen" data-tutorial="fullscreen">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
          </svg>
        </button>
        <label className="check" title="Show FPS and collision boxes" data-tutorial="debug-toggle">
          <input
            type="checkbox"
            checked={debug}
            onChange={(e) => {
              setDebug(e.target.checked);
              host?.setDebug(e.target.checked);
            }}
          />
          {Icon.bug()} Debug
        </label>
        {debug && running && (
          <>
            <button
              className={`btn small${frozen ? " on" : ""}`}
              onClick={() => {
                host?.freeze(!frozen);
                setFrozen(!frozen);
              }}
              title="Stop the game where it is (it's still drawn); press again to go on"
              data-testid="debug-freeze"
            >
              {frozen ? "▶ Go on" : "❚❚ Freeze"}
            </button>
            <button className="btn small" disabled={!frozen} onClick={() => host?.stepOnce()} title="One step of the frozen game" data-testid="debug-step">
              Step
            </button>
          </>
        )}
        <span className="stats" data-testid="stats">
          {state === "loading" && (ready ? "Starting…" : "Loading Python…")}
          {state === "running" && stats && (
            <>
              <b data-testid="fps">{stats.fps}</b> fps · {stats.instances} inst · {stats.pythonMs.toFixed(1)} ms
              <span hidden data-testid="tiles-drawn">{stats.tiles}</span>
            </>
          )}
          {state === "stopped" && !ready && "Loading Python…"}
        </span>
      </header>
      <div
        className="game-box"
        ref={box}
        onPointerDown={(e) => {
          if (!debug || !host || (e.target as HTMLElement).tagName !== "CANVAS") return;
          void host.inspect({ clientX: e.clientX, clientY: e.clientY }).then((v) => {
            setSeen(v);
            setWatching(v?.slot ?? null);
          });
        }}
      >
        {state === "stopped" && <p className="hint">Press Play. Click the game to give it the keyboard.</p>}
        {debug && running && <Inspector seen={seen} close={() => (setWatching(null), setSeen(null))} />}
      </div>
    </section>
  );
}

export function ConsolePane({ lines, clear, jump }: { lines: ConsoleLine[]; clear: () => void; jump: (e: MappedError) => void }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Braces matter: newer Chrome returns a Promise from scrollIntoView, and
    // an effect that returns anything but a function crashes React's commit.
    void end.current?.scrollIntoView({ block: "end" });
  }, [lines]);
  return (
    <div className="console" data-tutorial="console" data-testid="console">
      <button className="icon-btn console-clear" onClick={clear} title="Clear" aria-label="Clear console">
        {Icon.clear()}
      </button>
      {lines.map((l, i) =>
        l.kind === "error" ? (
          <div key={i} className="line error-block">
            {l.error.where && (
              <button className="error-where" onClick={() => jump(l.error)} disabled={!l.error.target} data-testid="error-where">
                {l.error.where}
              </button>
            )}
            <pre className="error-msg">{l.error.message}</pre>
            {l.error.traceback && !l.error.hang && (
              <details>
                <summary>How it got there</summary>
                <pre>{l.error.traceback}</pre>
              </details>
            )}
          </div>
        ) : (
          <pre key={i} className={`line ${l.kind}`}>
            {l.text}
          </pre>
        ),
      )}
      <div ref={end} />
    </div>
  );
}

// (The catalog's own list: catalog.test.ts holds the palettes to it too.)

/** The API catalog as a searchable list. Clicking an entry types it at the cursor. */
export function DocsPane() {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return API.filter((e) => !s || e.name.includes(s) || e.description.toLowerCase().includes(s));
  }, [q]);
  const insert = (text: string) => {
    const v = activeEditor.view;
    if (!v || v.state.readOnly) return;
    const { from, to } = v.state.selection.main;
    v.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } });
    v.focus();
  };
  return (
    <div className="docs" data-tutorial="docs">
      <input className="docs-search" placeholder="Search functions…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search docs" />
      {CATEGORIES.map((c) => {
        const items = shown.filter((e) => e.category === c);
        if (!items.length) return null;
        return (
          <section key={c}>
            <h4>{c}</h4>
            {items.map((e) => (
              <button
                key={e.name}
                className="doc-entry"
                title="Click to put it in your code"
                onClick={() => insert(e.kind === "function" ? `${e.name}(${e.params.filter((p) => p.default === undefined).map((p) => p.name).join(", ")})` : e.name)}
              >
                <code>{e.kind === "function" ? signature(e) : e.name}</code>
                <span>{e.description}</span>
              </button>
            ))}
          </section>
        );
      })}
      {!q && (
        <section>
          <h4>Instance properties (self.…)</h4>
          {PROPERTIES.map((p) => (
            <button key={p.name} className="doc-entry" onClick={() => insert(`self.${p.name}`)}>
              <code>self.{p.name}</code>
              <span>{p.description}</span>
            </button>
          ))}
        </section>
      )}
    </div>
  );
}

/**
 * The debugger's inspector: click an instance in the game (with Debug on)
 * to see its built-in properties and its own variables, kept up to date,
 * and global_vars — the "print everything" a student would otherwise add.
 */
function Inspector({ seen, close }: { seen: Inspected | null; close: () => void }) {
  const rows = (o: Record<string, string> | undefined) =>
    Object.entries(o ?? {}).map(([k, v]) => (
      <tr key={k}>
        <th>{k}</th>
        <td>{v}</td>
      </tr>
    ));
  return (
    <aside className="inspector" data-testid="inspector" onPointerDown={(e) => e.stopPropagation()}>
      {seen?.object ? (
        <>
          <header>
            <b data-testid="inspector-object">{seen.object}</b>
            <button className="icon-btn" onClick={close} aria-label="Stop watching" title="Stop watching">
              ×
            </button>
          </header>
          <h4>Its variables</h4>
          <table data-testid="inspector-vars">
            <tbody>{Object.keys(seen.vars ?? {}).length ? rows(seen.vars) : <tr><td className="muted">none of its own</td></tr>}</tbody>
          </table>
          <h4>Built in</h4>
          <table>
            <tbody>{rows(seen.props)}</tbody>
          </table>
        </>
      ) : (
        <p className="muted small">Click an instance in the game to look inside it.</p>
      )}
      {seen && Object.keys(seen.globals).length > 0 && (
        <>
          <h4>global_vars</h4>
          <table data-testid="inspector-globals">
            <tbody>{rows(seen.globals)}</tbody>
          </table>
        </>
      )}
    </aside>
  );
}
