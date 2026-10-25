/**
 * Who is signed in, and so where projects are kept: on the server (through
 * CloudStore and its cache) when signed in, in this browser (LocalStore)
 * when not. `browser` is the signed-out store either way, so a signed-in
 * student can still see — and move into their account — games they made
 * before signing in.
 */
import { createContext, useContext } from "react";
import type { Me } from "../store/api";
import type { CloudStore } from "../store/cloudStore";
import type { LocalStore, ProjectStore } from "../store/store";

export interface SessionInfo {
  me: Me;
  store: ProjectStore;
  cloud: CloudStore | null;
  browser: LocalStore;
}

export const SessionContext = createContext<SessionInfo | null>(null);

export function useSession(): SessionInfo {
  const s = useContext(SessionContext);
  if (!s) throw new Error("useSession outside the app");
  return s;
}
