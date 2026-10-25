/**
 * Two pages, chosen by the URL's hash: #/ lists your games, #/p/<id> edits
 * one. A hash rather than a path so the static build works from any server
 * without rewrite rules.
 */
import { useEffect, useMemo, useState } from "react";
import { LocalStore } from "../store/store";
import { EditorPage } from "./EditorPage";
import { ProjectsPage } from "./ProjectsPage";

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
  const store = useMemo(() => new LocalStore(), []);
  const hash = useHash();
  const m = hash.match(/^#\/p\/([\w-]+)/);
  if (m) return <EditorPage key={m[1]} store={store} id={m[1]!} />;
  return <ProjectsPage store={store} />;
}
