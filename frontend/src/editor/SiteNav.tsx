/**
 * The bar across the top of every page but the editor (which keeps its
 * own): the name, then Explore, Create (your games), Classes (signed in)
 * and — for teachers — Approvals, each an icon over a word, as microStudio's is; then who is
 * signed in and the light/dark button.
 */
import { AccountMenu } from "./AccountBits";
import { LOGO_CELLS, LOGO_COLORS } from "./logoCells";
import { useSession } from "./session";
import { Icon } from "./ui/icons";
import { ThemeToggle } from "./ui/ThemeToggle";

export type NavPlace = "home" | "explore" | "games" | "classes" | "moderation" | "";

/** GameIDE's mark: the pixel cartridge (scripts/make_logo.py, also the favicon). */
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
      {LOGO_CELLS.flatMap((row, y) => [...row].map((c, x) => (LOGO_COLORS[c] ? <rect key={`${x},${y}`} x={x} y={y} width="1" height="1" fill={LOGO_COLORS[c]} /> : null)))}
    </svg>
  );
}

/** The name: the mark, "Game", and "IDE" as a bit of code. GameIDE's own, not microStudio's two-tone word. */
export function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className={`logo${small ? " small" : ""}`}>
      <LogoMark size={small ? 22 : 32} />
      <span className="logo-game">Game</span>
      <span className="logo-ide">IDE</span>
    </span>
  );
}

export function SiteNav({ at }: { at: NavPlace }) {
  const { me } = useSession();
  const item = (place: NavPlace, href: string, icon: React.ReactNode, label: string, testid: string) => (
    <a className={`site-nav-item${at === place ? " on" : ""}`} href={href} data-testid={testid} aria-current={at === place ? "page" : undefined}>
      {icon}
      <span>{label}</span>
    </a>
  );
  return (
    <header className="site-nav">
      <a className="site-logo" href="#/" aria-label="GameIDE home" data-testid="site-logo">
        <Logo />
      </a>
      <nav className="site-nav-items" aria-label="Site">
        {item("explore", "#/explore", Icon.search(20), "Explore", "nav-explore")}
        {item("games", "#/games", Icon.create(20), "Create", "nav-games")}
        {me.user && item("classes", "#/classes", Icon.classes(20), "Classes", "nav-classes")}
        {(me.user?.teacher || me.user?.admin) && item("moderation", "#/moderation", Icon.approve(20), "Approvals", "link-moderation")}
      </nav>
      <span className="spacer" />
      <AccountMenu />
      <ThemeToggle />
    </header>
  );
}
