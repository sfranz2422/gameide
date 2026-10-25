/**
 * The account side of the editor: the save status, who is signed in,
 * History, and Export.
 */
import { useEffect, useState } from "react";
import { signInUrl } from "../store/api";
import type { VersionInfo } from "../store/store";
import { download, exportZip, safeFileName } from "../store/zip";
import { useSession } from "./session";
import { Icon } from "./ui/icons";
import { useProjectApi, type SaveStatus } from "./useProject";

const STATUS_TEXT: Record<SaveStatus, string> = {
  saved: "Saved",
  saving: "Saving…",
  offline: "Offline — saved in this browser",
  "signed-out": "Signed out — saved in this browser",
  error: "Not saved!",
};

export function SaveStatusView({ status, error }: { status: SaveStatus; error: string | null }) {
  const { me, cloud } = useSession();
  const where = cloud ? "Saved to your account" : "Saved in this browser";
  return (
    <span className={`save-status ${status}`} data-testid="save-status" title={error ?? (status === "saved" ? where : "")}>
      {STATUS_TEXT[status]}
      {status === "signed-out" && (
        <>
          {" · "}
          <a href={signInUrl(me)}>Sign in</a>
        </>
      )}
      {status === "error" && error && <span className="save-error"> {error}</span>}
    </span>
  );
}

/** Sign in, or the name with a Sign out; on both pages. */
export function AccountMenu() {
  const { me, cloud } = useSession();
  if (!me.loginEnabled) return null;
  if (!me.user)
    return (
      <a className="btn small" href={signInUrl(me)} data-testid="sign-in">
        Sign in
      </a>
    );
  const signOut = async () => {
    // The cache holds this student's games. Gone when they sign out — the
    // next person on this Chromebook shouldn't find them — unless some work
    // in it hasn't reached the server yet.
    const waiting = cloud ? await cloud.unsavedCount() : 0;
    if (waiting && !confirm(`${waiting} game${waiting === 1 ? " has" : "s have"} changes that haven't reached your account yet (you may be offline). They stay in this browser and are sent when you sign in again here. Sign out anyway?`))
      return;
    if (cloud && !waiting) await cloud.cache.destroy();
    location.href = "/logout";
  };
  return (
    <span className="account" data-testid="account">
      <span className="account-name" title={me.user.email}>
        {me.user.name}
        {me.user.teacher && <span className="tree-badge">teacher</span>}
      </span>
      <button className="btn small" onClick={signOut}>
        Sign out
      </button>
    </span>
  );
}

export function ExportButton() {
  const { project, store } = useProjectApi();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn small"
      disabled={busy}
      title="Download this game as a .zip you can import again"
      data-testid="export-zip"
      onClick={async () => {
        setBusy(true);
        try {
          const blob = await exportZip(project, (id) => store.getAsset(project.id, id));
          download(blob, `${safeFileName(project.name)}.zip`);
        } finally {
          setBusy(false);
        }
      }}
    >
      {Icon.docs()} Export
    </button>
  );
}

const KIND_TEXT: Record<VersionInfo["kind"], string> = {
  auto: "Saved automatically",
  manual: "Saved by you",
  replaced: "From another tab or computer",
  restore: "Before going back",
};

function when(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function HistoryButton() {
  const { store } = useProjectApi();
  const { me } = useSession();
  const [open, setOpen] = useState(false);
  if (!store.versions)
    return me.loginEnabled ? (
      <a className="btn small" href={signInUrl(me)} title="Sign in to keep a history of your game">
        History
      </a>
    ) : null;
  return (
    <>
      <button className="btn small" onClick={() => setOpen(true)} data-testid="history">
        History
      </button>
      {open && <HistoryDialog close={() => setOpen(false)} />}
    </>
  );
}

function HistoryDialog({ close }: { close: () => void }) {
  const { project, store, replace } = useProjectApi();
  const [versions, setVersions] = useState<VersionInfo[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = () =>
    store.versions!(project.id)
      .then(setVersions)
      .catch((e: Error) => setProblem(e.message));
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    setProblem(null);
    try {
      await f();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal-back" onPointerDown={close}>
      <div className="modal" role="dialog" aria-label="History" onPointerDown={(e) => e.stopPropagation()}>
        <h3>History</h3>
        <p className="muted small">
          Versions are kept automatically every ten minutes or so while you work, and whenever you save one here. Going back
          keeps what you have now as a version too, so it can always be undone.
        </p>
        <div className="history-save">
          <input placeholder="Name this version (optional)" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Version name" />
          <button
            className="btn"
            disabled={busy}
            data-testid="save-version"
            onClick={() =>
              run(async () => {
                await store.saveVersion!(project.id, label.trim());
                setLabel("");
                await refresh();
              })
            }
          >
            Save a version
          </button>
        </div>
        {problem && <p className="banner error">{problem}</p>}
        {versions === null ? (
          <p className="muted">Loading…</p>
        ) : versions.length === 0 ? (
          <p className="muted">No versions yet.</p>
        ) : (
          <ul className="history-list" data-testid="history-list">
            {versions.map((v) => (
              <li key={v.id}>
                <span>
                  <b>{when(v.created)}</b> <span className="muted small">{v.label || KIND_TEXT[v.kind]}</span>
                </span>
                <button
                  className="btn small"
                  disabled={busy}
                  onClick={() =>
                    confirm(`Go back to the version from ${when(v.created)}? What you have now is kept in History.`) &&
                    run(async () => {
                      replace(await store.restoreVersion!(project.id, v.id));
                      close();
                    })
                  }
                >
                  Go back to this
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="modal-foot">
          <button className="btn" onClick={close}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
