/**
 * Signing a student out after two idle hours — the page's half, as PyIDE's
 * _idle.html does it. The server's half (backend/app.py,
 * _sign_out_idle_student) is the one that decides; this one notices first,
 * so the page never sits there looking signed in when it isn't.
 *
 * While the page is used, a beat goes to the server at most every 5 minutes
 * (a POST, which counts as activity). With no use for the idle time less 2
 * minutes, the next touch goes straight to Google's sign-in and back to this
 * same page. Unsaved work is safe meanwhile: CloudStore keeps it in this
 * browser and sends it once signed in again.
 *
 * Opening the page, or coming back to the tab, asks the server (a GET, not
 * activity) — Chrome reopens yesterday's tabs from its cache and runs this
 * as if the page were new, so only the server knows.
 */
import { useEffect } from "react";
import { api, signInUrl, type Me } from "../store/api";

const BEAT_MS = 5 * 60 * 1000;

export function useIdleSignOut(me: Me | null) {
  useEffect(() => {
    if (!me?.user || !me.idleSeconds) return;
    const limit = (me.idleSeconds - 120) * 1000;
    let last = Date.now();
    let out = false;
    const signOut = () => {
      if (out) return;
      out = true;
      location.replace(`/logout?next=${encodeURIComponent(signInUrl(me))}`);
    };
    const beat = () =>
      api<{ signed_in: boolean }>("/api/alive", { json: {} })
        .then((d) => !d.signed_in && signOut())
        .catch(() => undefined);
    const used = (e: Event) => {
      if (out || Date.now() - last > limit) {
        signOut();
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (Date.now() - last >= BEAT_MS) {
        last = Date.now();
        void beat();
      }
    };
    const ask = () => {
      if (document.visibilityState !== "visible") return;
      void api<{ signed_in: boolean }>("/api/alive")
        .then((d) => !d.signed_in && signOut())
        .catch(() => undefined);
    };
    const kinds = ["keydown", "pointerdown", "wheel", "touchstart"];
    for (const k of kinds) window.addEventListener(k, used, { capture: true, passive: false });
    document.addEventListener("visibilitychange", ask);
    window.addEventListener("focus", ask);
    ask();
    return () => {
      for (const k of kinds) window.removeEventListener(k, used, { capture: true });
      document.removeEventListener("visibilitychange", ask);
      window.removeEventListener("focus", ask);
    };
  }, [me]);
}
