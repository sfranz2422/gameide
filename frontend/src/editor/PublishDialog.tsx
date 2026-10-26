/**
 * Publish: a playable link for the game (/play/<id>), for anyone with the
 * link, the student's class, or everyone on Explore (after a teacher
 * approves). It publishes the game as saved to the account — the dialog
 * saves first — and later changes reach players only when it is published
 * again (backend/publishing.py).
 */
import { useEffect, useState } from "react";
import { api, signInUrl } from "../store/api";
import type { GameHost } from "./gameHost";
import { useSession } from "./session";
import { Icon } from "./ui/icons";
import { useProjectApi } from "./useProject";

interface Published {
  id: string;
  url: string;
  title: string;
  description: string;
  author: string;
  tags: string[];
  allowRemix: boolean;
  visibility: "unlisted" | "class" | "public";
  classId: number | null;
  status: string;
  takenDown: boolean;
  takedownNote: string;
}

interface Settings {
  published: Published | null;
  classes: { id: number; name: string }[];
  author: string;
  tags: string[];
  teacher: boolean;
}

/** The running game's frame, shrunk to the size Explore shows, as a PNG data URL. */
async function picture(host: GameHost | null): Promise<string | null> {
  const png = await host?.snapshot();
  if (!png) return null;
  const img = await createImageBitmap(png);
  const c = new OffscreenCanvas(320, 180);
  const g = c.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, 320, 180);
  const k = Math.min(320 / img.width, 180 / img.height);
  g.imageSmoothingEnabled = false; // pixel art stays crisp
  g.drawImage(img, (320 - img.width * k) / 2, (180 - img.height * k) / 2, img.width * k, img.height * k);
  const blob = await c.convertToBlob({ type: "image/png" });
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.readAsDataURL(blob);
  });
}

export function PublishButton({ host }: { host: GameHost | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn small" onClick={() => setOpen(true)} data-testid="publish" data-tutorial="publish">
        {Icon.play()} Publish
      </button>
      {open && <PublishDialog host={host} close={() => setOpen(false)} />}
    </>
  );
}

function PublishDialog({ host, close }: { host: GameHost | null; close: () => void }) {
  const { project, store } = useProjectApi();
  const { me } = useSession();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [form, setForm] = useState({ title: project.name, description: "", author: "", tags: [] as string[], allowRemix: true, visibility: "unlisted" as Published["visibility"], classId: 0 });
  const [usePicture, setUsePicture] = useState(true);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const signedIn = store.kind === "cloud";

  useEffect(() => {
    if (!signedIn) return;
    void api<Settings>(`/api/projects/${project.id}/publish`)
      .then((s) => {
        setSettings(s);
        const p = s.published;
        setForm({
          title: p?.title ?? project.name,
          description: p?.description ?? "",
          author: p?.author ?? s.author,
          tags: p?.tags ?? [],
          allowRemix: p?.allowRemix ?? true,
          visibility: p?.visibility ?? "unlisted",
          classId: p?.classId ?? s.classes[0]?.id ?? 0,
        });
      })
      // Not on the server yet (a brand new game): saving below puts it there.
      .catch(() => setSettings({ published: null, classes: [], author: me.user?.name.split(" ")[0] ?? "", tags: [], teacher: !!me.user?.teacher }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const publish = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const saved = await store.save(project);
      if (saved.state !== "saved") throw new Error(saved.message ?? "The game couldn't be saved to your account first, so it can't be published yet.");
      const thumbnail = usePicture ? await picture(host) : null;
      const r = await api<{ published: Published }>(`/api/projects/${project.id}/publish`, {
        json: { ...form, classId: form.visibility === "class" ? form.classId : null, ...(thumbnail ? { thumbnail } : {}) },
      });
      setSettings((s) => (s ? { ...s, published: r.published } : s));
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const unpublish = async () => {
    if (!confirm("Unpublish? The link stops working for everyone.")) return;
    await api(`/api/projects/${project.id}/publish`, { method: "DELETE" });
    setSettings((s) => (s ? { ...s, published: null } : s));
  };

  const pub = settings?.published;
  const link = pub ? new URL(pub.url, location.origin).href : "";
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="modal-back" onPointerDown={close}>
      <div className="modal publish-dialog" role="dialog" aria-label="Publish" onPointerDown={(e) => e.stopPropagation()}>
        <h2>Publish {project.name}</h2>
        {!signedIn ? (
          <p>
            Publishing puts your game on the web with a link to share. <a href={signInUrl(me)}>Sign in</a> first, so it's saved to your account.
          </p>
        ) : !settings ? (
          <p className="muted">Loading…</p>
        ) : (
          <>
            {pub && (
              <div className={`publish-status${pub.takenDown ? " down" : ""}`} data-testid="publish-status">
                {pub.takenDown ? (
                  <p>
                    A teacher took this game down{pub.takedownNote ? `: ${pub.takedownNote}` : "."} Only you can still open its link.
                  </p>
                ) : (
                  <p>
                    {pub.visibility === "public" && pub.status === "pending"
                      ? "Published — waiting for a teacher to approve it for Explore. The link already works."
                      : pub.visibility === "public" && pub.status === "rejected"
                        ? "Published, but a teacher didn't approve it for Explore. The link still works."
                        : pub.visibility === "public"
                          ? "Published, and on Explore."
                          : pub.visibility === "class"
                            ? "Published for your class: it's in the class's gallery."
                            : "Published: anyone with the link can play."}
                  </p>
                )}
                <div className="row">
                  <input readOnly value={link} aria-label="Link" data-testid="publish-link" onFocus={(e) => e.target.select()} />
                  <button className="btn small" onClick={() => void navigator.clipboard?.writeText(link)}>
                    Copy
                  </button>
                  <a className="btn small" href={pub.url} target="_blank" rel="noreferrer">
                    Open
                  </a>
                </div>
              </div>
            )}
            <label className="field">
              Title
              <input value={form.title} maxLength={80} onChange={(e) => set("title", e.target.value)} data-testid="publish-title" />
            </label>
            <label className="field">
              What it is, and how to play
              <textarea rows={3} maxLength={2000} value={form.description} onChange={(e) => set("description", e.target.value)} />
            </label>
            <label className="field">
              Your name on it
              <input value={form.author} maxLength={30} onChange={(e) => set("author", e.target.value)} />
              <span className="muted small">Your first name, or a name you choose. Never your email.</span>
            </label>
            <fieldset className="field">
              <legend>Who can play it</legend>
              <label className="check">
                <input type="radio" checked={form.visibility === "unlisted"} onChange={() => set("visibility", "unlisted")} data-testid="publish-unlisted" />
                Anyone with the link
              </label>
              <label className="check">
                <input
                  type="radio"
                  checked={form.visibility === "class"}
                  disabled={!settings.classes.length}
                  onChange={() => set("visibility", "class")}
                  data-testid="publish-class"
                />
                My class
                {settings.classes.length > 1 && (
                  <select value={form.classId} onChange={(e) => set("classId", Number(e.target.value))} aria-label="Class">
                    {settings.classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
                {!settings.classes.length && <span className="muted small"> (you're not in a class here yet)</span>}
              </label>
              <label className="check">
                <input type="radio" checked={form.visibility === "public"} onChange={() => set("visibility", "public")} data-testid="publish-public" />
                Everyone, on Explore
                {!settings.teacher && <span className="muted small"> — a teacher approves it first</span>}
              </label>
            </fieldset>
            <fieldset className="field">
              <legend>Kind of game (up to 3)</legend>
              <div className="tag-picks">
                {(settings.tags.length ? settings.tags : []).map((t) => (
                  <label key={t} className="check">
                    <input
                      type="checkbox"
                      checked={form.tags.includes(t)}
                      disabled={!form.tags.includes(t) && form.tags.length >= 3}
                      onChange={(e) => set("tags", e.target.checked ? [...form.tags, t] : form.tags.filter((x) => x !== t))}
                    />
                    {t}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="check field">
              <input type="checkbox" checked={form.allowRemix} onChange={(e) => set("allowRemix", e.target.checked)} />
              Let others remix it (copy it to change, with credit to you)
            </label>
            <label className="check field">
              <input type="checkbox" checked={usePicture} onChange={(e) => setUsePicture(e.target.checked)} />
              Use what the game shows now as its picture
              <span className="muted small"> (press Play first, and get to a good moment)</span>
            </label>
            {problem && (
              <p className="error-text" role="alert">
                {problem}
              </p>
            )}
          </>
        )}
        <div className="modal-foot">
          {pub && (
            <button className="btn" onClick={() => void unpublish()} data-testid="unpublish">
              Unpublish
            </button>
          )}
          <span className="spacer" />
          <button className="btn" onClick={close}>
            Close
          </button>
          {signedIn && settings && (
            <button className="btn primary" disabled={busy || !form.title.trim()} onClick={() => void publish()} data-testid="publish-go">
              {busy ? "Publishing…" : pub ? "Publish again" : "Publish"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
