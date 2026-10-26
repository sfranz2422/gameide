/**
 * Pages chosen by the URL's hash: #/ is the front door (HomePage), #/games
 * lists your games, #/p/<id> edits one, #/explore, #/gallery/<class id> and
 * #/moderation are about published games (whose own pages, /play/<id>, are
 * the player's — play.html). A hash rather than a path so the static build works from any server
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
import { HomePage } from "./HomePage";
import { ExplorePage, GalleryPage, ModerationPage } from "./ExplorePages";
import { AssignmentPage, ClassesPage, ClassPage, StartAssignment } from "./ClassPages";
import { ViewStore } from "../store/viewStore";
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
  // A student's game, read only, for their teacher: as it is, or a version of it (#/view/<id>/<version>).
  const view = hash.match(/^#\/view\/([\w-]+)(?:\/(\d+))?/);
  // One store per page shown: a new one each render would reopen the game every time.
  const viewStore = useMemo(() => (view ? new ViewStore(view[1]!, view[2] ? Number(view[2]) : null) : null), [view?.[0]]);
  if (!session) return <div className="center-message">Opening…</div>;
  const m = hash.match(/^#\/p\/([\w-]+)/);
  const gallery = hash.match(/^#\/gallery\/(\d+)/);
  const klass = hash.match(/^#\/class\/(\d+)/);
  const results = hash.match(/^#\/assignment\/([\w-]+)/);
  const start = hash.match(/^#\/a\/([\w-]+)/);
  return (
    <SessionContext.Provider value={session}>
      {m ? (
        <EditorPage key={`${m[1]}:${session.store.kind}`} store={session.store} id={m[1]!} />
      ) : view && viewStore ? (
        <EditorPage key={hash} store={viewStore} id={view[1]!} />
      ) : start ? (
        <StartAssignment key={start[1]} slug={start[1]!} />
      ) : klass ? (
        <ClassPage key={klass[1]} classId={Number(klass[1])} />
      ) : results ? (
        <AssignmentPage key={results[1]} slug={results[1]!} />
      ) : hash.startsWith("#/classes") ? (
        <ClassesPage />
      ) : hash.startsWith("#/explore") ? (
        <ExplorePage />
      ) : gallery ? (
        <GalleryPage classId={Number(gallery[1])} />
      ) : hash.startsWith("#/moderation") ? (
        <ModerationPage />
      ) : hash.startsWith("#/games") ? (
        <ProjectsPage />
      ) : (
        <HomePage />
      )}
    </SessionContext.Provider>
  );
}
