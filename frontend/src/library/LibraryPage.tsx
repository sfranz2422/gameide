/**
 * The tutorial library (#/library): every tutorial a teacher has, the
 * built-in ones included, where each is used, and what to do with it. The
 * server half is library.py — the same file as PyIDE's, WebIDE's and
 * FlaskIDE's — and a tutorial is edited in PresMaker, the library's editor
 * (/teacher/tutorials/<slug>/edit, a page of its own). It is the only place
 * a tutorial's text changes: the assignment page and the old tutorial
 * editor no longer write notes.
 *
 * A built-in tutorial becomes a row of the teacher's own the first time it's
 * linked or edited (origin "builtin:<name>"), and every assignment made from
 * it links to that row — so changing it changes theirs, never the built-in.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../store/api";
import { useSession } from "../editor/session";
import { SiteNav } from "../editor/SiteNav";
import { libraryEditUrl, libraryRowFor, startTutorial, tutorialMarkdown } from "../tutorials/TutorialPages";

interface Use {
  slug: string;
  title: string;
  kind: string;
  class: string;
  archived: boolean;
  url: string;
}
interface Item {
  id: number;
  slug: string;
  kind: "tutorial" | "deck";
  title: string;
  updated: string;
  visibility: string;
  origin: string;
  uses: Use[];
}
interface Assignment extends Use {
  tutorial: number | null;
}
interface Builtin {
  key: string;
  title: string;
  level: string;
}
/** A row of the page: a library item, or a built-in not yet in it. */
type Row = { item: Item; builtin?: undefined } | { item?: undefined; builtin: Builtin };

const editUrl = libraryEditUrl;
const when = (iso: string) => {
  const d = new Date(iso);
  return isNaN(+d) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

/** A built-in, made the teacher's own row (or theirs found): its slug. */
const ownBuiltin = (b: Builtin) => libraryRowFor(`builtin:${b.key}`, b.title, false);

function asBase64(file: File): Promise<string> {
  return file.arrayBuffer().then((buf) => {
    const bytes = new Uint8Array(buf);
    let out = "";
    for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(out);
  });
}

export function LibraryPage() {
  const { me, store } = useSession();
  /** Built-ins an admin took off the Learn page (tutorials.py, HiddenBuiltin). */
  const [hidden, setHidden] = useState<string[]>([]);
  const loadHidden = () => api<{ hidden?: string[] }>("/api/tutorials").then((d) => setHidden(d.hidden ?? []), () => undefined);
  const [items, setItems] = useState<Item[] | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [builtins, setBuiltins] = useState<Builtin[]>([]);
  const [query, setQuery] = useState("");
  const [show, setShow] = useState<"" | "mine" | "builtin">("");
  const [say, setSay] = useState<{ text: string; bad?: boolean; list?: string[] } | null>(null);
  const [linking, setLinking] = useState<Row | null>(null);
  const files = useRef<HTMLInputElement>(null);

  const load = () =>
    api<{ items: Item[]; assignments: Assignment[] }>("/api/library").then(
      (d) => {
        setItems(d.items.filter((i) => i.kind === "tutorial"));
        setAssignments(d.assignments);
      },
      (e: Error) => setSay({ text: e.message, bad: true }),
    );
  useEffect(() => {
    void load();
    void fetch(new URL("tutorials/index.json", document.baseURI))
      .then((r) => r.json())
      .then((list: Builtin[]) => setBuiltins(list), () => undefined);
    void loadHidden();
  }, []);

  const act = (f: () => Promise<unknown>) => f().catch((e: Error) => setSay({ text: e.message, bad: true }));

  const rows = useMemo<Row[]>(() => {
    if (!items) return [];
    const taken = new Set(items.map((i) => i.origin));
    const all: Row[] = [
      ...items.map((item) => ({ item })),
      ...builtins.filter((b) => !taken.has(`builtin:${b.key}`)).map((builtin) => ({ builtin })),
    ];
    const q = query.trim().toLowerCase();
    return all
      .filter((r) => {
        const title = r.item ? r.item.title : r.builtin.title;
        const isBuiltin = r.builtin || r.item.origin.startsWith("builtin:");
        return (!q || title.toLowerCase().includes(q)) && (!show || (show === "builtin") === !!isBuiltin);
      })
      .sort((a, b) => {
        // Theirs first, most recently changed; then the built-ins not yet theirs, by title.
        if (a.item && b.item) return a.item.updated < b.item.updated ? 1 : -1;
        if (a.item) return -1;
        if (b.item) return 1;
        return a.builtin.title.localeCompare(b.builtin.title);
      });
  }, [items, builtins, query, show]);

  if (!me.user?.teacher)
    return (
      <div className="site-page">
        <SiteNav at="learn" />
        <main className="explore-page class-page">
          <p className="banner">The tutorial library is for teachers.</p>
        </main>
      </div>
    );

  const newOne = () => {
    const title = prompt("What's it called?")?.trim();
    if (!title) return;
    const body = `---\ntitle: ${title}\nlevel: Getting Started\ntime: 10 min\nstarter: empty\ndescription: What students will make.\n---\n# ${title}\n\nSay what to do.\n`;
    void act(async () => {
      const r = await api<{ slug: string }>("/api/library", { json: { title, body } });
      location.href = editUrl(r.slug);
    });
  };
  const edit = (r: Row) =>
    act(async () => {
      location.href = editUrl(r.item ? r.item.slug : await ownBuiltin(r.builtin));
    });
  /**
   * A built-in, duplicated: a new tutorial of the teacher's own, "(my copy)"
   * in its title and its header both (the Learn page and the library read the
   * header's), unlinked from the built-in — unlike Edit, which makes the row
   * the built-in's own assignments link to.
   */
  const duplicateBuiltin = (b: Builtin) =>
    act(async () => {
      const title = `${b.title} (my copy)`;
      const body = (await tutorialMarkdown(`builtin:${b.key}`)).replace(/^(\s*---[ \t]*\n[\s\S]*?^title\s*:\s*)(.+)$/m, (_, head: string) => `${head}${title}`);
      await api("/api/library", { json: { title, body } });
      setSay({ text: `“${title}” is in your library, yours to change.` });
      await load();
    });
  const upload = (list: FileList | null) => {
    const picked = Array.from(list ?? []).filter((f) => /\.(md|markdown|txt)$/i.test(f.name));
    if (!picked.length) return setSay({ text: "Choose .md tutorials.", bad: true });
    setSay({ text: `Uploading ${picked.length}…` });
    void act(async () => {
      const sent = await Promise.all(picked.map(async (f) => ({ name: f.name, data: await asBase64(f) })));
      const d = await api<{ report: { name: string; result: string; why?: string; updated?: number }[] }>("/api/library/upload", { json: { files: sent } });
      const counts: Record<string, number> = {};
      d.report.forEach((x) => (counts[x.result] = (counts[x.result] ?? 0) + 1));
      setSay({
        text: Object.entries(counts).map(([k, n]) => `${n} ${k}`).join(", ") + ".",
        list: d.report.map((x) => `${x.name}: ${x.result}${x.why ? ` (${x.why})` : ""}${x.result === "replaced" && x.updated ? `, ${x.updated} assignment${x.updated === 1 ? "" : "s"} updated` : ""}`),
      });
      await load();
    });
  };

  return (
    <div className="site-page">
      <SiteNav at="learn" />
      <main className="explore-page class-page library-page">
        <header className="page-head">
          <h1>Tutorial library</h1>
          <span className="spacer" />
          <button className="btn go" onClick={newOne} data-testid="library-new">
            New tutorial
          </button>
          <button className="btn" onClick={() => files.current?.click()} data-testid="library-upload"
            title="Markdown tutorials (.md) from your computer. One with the same title as one here replaces it, and every assignment using it gets the new version.">
            Upload…
          </button>
          <input ref={files} type="file" multiple accept=".md,.markdown,.txt" hidden data-testid="library-files"
            onChange={(e) => (upload(e.target.files), (e.target.value = ""))} />
          <a className="btn" href="#/tutorials">All tutorials</a>
        </header>
        <p className="muted">
          Every tutorial you use, the built-in ones too. Link one to as many assignments as you like: edit it here, and every one of them
          changes. This is the only place tutorials are edited. A built-in one becomes yours to change the first time you edit or link it.
        </p>
        {say && (
          <div className={`banner${say.bad ? " error" : ""}`} role="status" data-testid="library-report">
            {say.text}
            {say.list && (
              <ul className="small">
                {say.list.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="library-tools">
          <input type="search" placeholder="Search titles" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search titles" />
          <select value={show} onChange={(e) => setShow(e.target.value as typeof show)} aria-label="Show">
            <option value="">All</option>
            <option value="mine">Mine</option>
            <option value="builtin">Built-in</option>
          </select>
        </div>
        {!items ? (
          <p className="muted">Loading…</p>
        ) : (
          <table className="library-table" data-testid="library-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Used in</th>
                <th>Changed</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const title = r.item ? r.item.title : r.builtin.title;
                const builtin = !!r.builtin || r.item!.origin.startsWith("builtin:");
                const builtinName = r.builtin ? r.builtin.key : r.item!.origin.startsWith("builtin:") ? r.item!.origin.slice("builtin:".length) : null;
                // How Try it follows it: as it ships (a built-in not yet theirs), or their row.
                const key = r.item ? `t:${r.item.slug}` : `builtin:${r.builtin.key}`;
                return (
                  <tr key={r.item ? r.item.slug : `b:${r.builtin.key}`} data-testid="library-row">
                    <td>
                      {builtin && <span className="library-kind">Built-in</span>} <b>{title}</b>
                    </td>
                    <td>
                      {r.item && r.item.uses.length ? (
                        <details>
                          <summary>
                            {r.item.uses.length} assignment{r.item.uses.length === 1 ? "" : "s"}
                          </summary>
                          <ul className="small">
                            {r.item.uses.map((u) => (
                              <li key={u.slug}>
                                <a href={u.url}>{(u.class ? `${u.class}: ` : "") + u.title}</a>
                              </li>
                            ))}
                          </ul>
                        </details>
                      ) : (
                        <span className="muted">Not used yet</span>
                      )}
                    </td>
                    <td className="muted small">{r.item ? when(r.item.updated) : ""}</td>
                    <td className="library-actions">
                      <button className="btn small" onClick={() => void edit(r)} data-testid="library-edit">
                        Edit
                      </button>
                      <button className="btn small" onClick={() => setLinking(r)} data-testid="library-link">
                        Link to…
                      </button>
                      {/* Try it, for every row: a teacher's own tutorials aren't on the Learn
                          page (only "Everyone" ones are), and a built-in here is followed as it
                          ships, or — once theirs — as they've changed it. It makes the
                          tutorial's starting game in their games, which is also how a class
                          gets one: New assignment from that game, then Link to… here. Notes
                          without a tutorial's header can't be followed: the server says so. */}
                      <button className="btn small" onClick={() => void act(() => startTutorial(store, key))} data-testid="library-try"
                        title="Follow it yourself, in a game of your own, as a student would">
                        Try it
                      </button>
                      {/* Who sees it on the Learn page. A built-in's is the site's (an
                          admin's call, for everyone); a teacher's own, theirs to publish. A
                          built-in made theirs gets no choice of its own: "Everyone" would put
                          it on the Learn page beside the built-in it came from. */}
                      {builtinName ? (
                        me.user?.admin && (
                          <select
                            className="small-select"
                            value={hidden.includes(builtinName) ? "hidden" : "site"}
                            aria-label="Whether this built-in is on the public Learn page"
                            title="For the whole site: a hidden built-in still opens for anyone who started it, and in assignments made from it"
                            data-testid="library-audience"
                            onChange={(e) =>
                              void act(() => api(`/api/tutorials/builtin/${builtinName}/audience`, { json: { audience: e.target.value } }).then(loadHidden))
                            }
                          >
                            <option value="site">Everyone (Learn page)</option>
                            <option value="hidden">Hidden from the Learn page</option>
                          </select>
                        )
                      ) : (
                        r.item && (
                          <select
                            className="small-select"
                            value={r.item.visibility}
                            aria-label="Whether it is on the public Learn page"
                            title="Everyone: on the public Learn page. Only me: in your library, for your assignments (a class gets it by having it linked)"
                            data-testid="library-audience"
                            onChange={(e) => void act(() => api(`/api/library/${r.item!.slug}`, { json: { visibility: e.target.value } }).then(load))}
                          >
                            <option value="private">Only me</option>
                            {(me.user?.admin || r.item.visibility === "site") && <option value="site">Everyone (Learn page)</option>}
                          </select>
                        )
                      )}
                      {r.builtin && (
                        <>
                          <button className="btn small" onClick={() => void duplicateBuiltin(r.builtin!)} data-testid="library-duplicate"
                            title="A tutorial of your own made from this one, to change as you like">
                            Duplicate
                          </button>
                          <a className="btn small" href={`tutorials/${r.builtin.key}.md`} download={`${r.builtin.key}.md`} data-testid="library-download"
                            title="Its markdown, as a file">
                            ⤓
                          </a>
                        </>
                      )}
                      {r.item && (
                        <>
                          <button className="btn small" onClick={() => void act(() => api(`/api/library/${r.item!.slug}/duplicate`, { json: {} }).then(load))} data-testid="library-duplicate">
                            Duplicate
                          </button>
                          <a className="btn small" href={`/api/library/${r.item.slug}/download`} data-testid="library-download" title="Its markdown, as a file">
                            ⤓
                          </a>
                          <button
                            className="btn small red"
                            onClick={() => {
                              const n = r.item!.uses.length;
                              if (!confirm(`Delete “${title}” from the library?${n ? ` The ${n} assignment${n === 1 ? "" : "s"} using it keep the notes as they are now, as their own.` : ""}`)) return;
                              void act(() => api(`/api/library/${r.item!.slug}`, { method: "DELETE" }).then(load));
                            }}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {linking && (
          <LinkDialog
            row={linking}
            assignments={assignments}
            onClose={() => setLinking(null)}
            onSaved={() => {
              setLinking(null);
              setSay({ text: "Linked. Students see it from now on." });
              void load();
            }}
            onError={(m) => setSay({ text: m, bad: true })}
          />
        )}
      </main>
    </div>
  );
}

/** Which assignments use it: ticked ones are linked (their notes are it, and stay in step). */
function LinkDialog({ row, assignments, onClose, onSaved, onError }: { row: Row; assignments: Assignment[]; onClose: () => void; onSaved: () => void; onError: (m: string) => void }) {
  const id = row.item?.id ?? -1;
  const [ticked, setTicked] = useState(() => new Set(assignments.filter((a) => a.tutorial === id).map((a) => a.slug)));
  const [busy, setBusy] = useState(false);
  const byClass = new Map<string, Assignment[]>();
  for (const a of assignments.filter((x) => !x.archived)) byClass.set(a.class, [...(byClass.get(a.class) ?? []), a]);
  const names = [...byClass.keys()].sort((a, b) => (!a ? 1 : !b ? -1 : a.localeCompare(b)));
  const save = async () => {
    setBusy(true);
    try {
      const slug = row.item ? row.item.slug : await ownBuiltin(row.builtin);
      const was = new Set(assignments.filter((a) => a.tutorial === id).map((a) => a.slug));
      await api(`/api/library/${slug}/link`, {
        json: { link: [...ticked].filter((s) => !was.has(s)), unlink: [...was].filter((s) => !ticked.has(s)) },
      });
      onSaved();
    } catch (e) {
      onError((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal library-dialog" role="dialog" aria-label="Link to assignments" onClick={(e) => e.stopPropagation()} data-testid="library-dialog">
        <h2>Link “{row.item ? row.item.title : row.builtin.title}” to…</h2>
        <p className="muted small">Ticked ones use this tutorial: its text is their notes, and stays in step with it. Unticking one keeps its notes as they are now, as its own.</p>
        <div className="library-link-list">
          {!names.length && <p className="muted">You have no assignments yet.</p>}
          {names.map((name) => (
            <fieldset key={name}>
              <legend>{name || "Not in a class"}</legend>
              {byClass.get(name)!.map((a) => (
                <label key={a.slug} className="check">
                  <input
                    type="checkbox"
                    checked={ticked.has(a.slug)}
                    onChange={(e) =>
                      setTicked((t) => {
                        const n = new Set(t);
                        if (e.target.checked) n.add(a.slug);
                        else n.delete(a.slug);
                        return n;
                      })
                    }
                  />{" "}
                  {a.title}
                  {a.tutorial && a.tutorial !== id && <span className="muted small"> — uses another tutorial now</span>}
                </label>
              ))}
            </fieldset>
          ))}
        </div>
        <div className="row">
          <span className="spacer" />
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn go" disabled={busy} onClick={() => void save()} data-testid="library-link-save">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
