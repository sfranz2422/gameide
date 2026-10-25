/**
 * Two pages, chosen by the URL's hash: #/ lists your games, #/p/<id> edits
 * one. A hash rather than a path so the static build works from any server
 * without rewrite rules.
 *
 * Who is signed in is asked once, as the page opens, and decides where
 * projects are kept (session.tsx).
 */
import { useEffect, useMemo, useState } from "react";
import { fetchMe, type Me } from "../store/api";
import { CloudStore } from "../store/cloudStore";
import { LocalStore } from "../store/store";
import { EditorPage } from "./EditorPage";
import { useIdleSignOut } from "./idle";
import { ProjectsPage } from "./ProjectsPage";
import { SessionContext, type SessionInfo } from "./session";

function useHash() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return hash;
}

export function App() {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    void fetchMe().then(setMe);
  }, []);
  const browser = useMemo(() => new LocalStore(), []);
  const cloud = useMemo(() => (me?.user ? new CloudStore(me.user.id) : null), [me]);
  useEffect(() => () => cloud?.dispose(), [cloud]);
  const session: SessionInfo | null = useMemo(
    () => (me ? { me, cloud, browser, store: cloud ?? browser } : null),
    [me, cloud, browser],
  );
  useIdleSignOut(me);
  const hash = useHash();
  if (!session) return <div className="center-message">Opening…</div>;
  const m = hash.match(/^#\/p\/([\w-]+)/);
  return (
    <SessionContext.Provider value={session}>
      {m ? <EditorPage key={`${m[1]}:${session.store.kind}`} store={session.store} id={m[1]!} /> : <ProjectsPage />}
    </SessionContext.Provider>
  );
}
