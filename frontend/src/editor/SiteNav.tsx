/**
 * The bar across the top of every page but the editor (which keeps its
 * own): the name, then Explore, Create (your games) and — for teachers —
 * Approvals, each an icon over a word, as microStudio's is; then who is
 * signed in and the light/dark button.
 */
import { AccountMenu } from "./AccountBits";
import { useSession } from "./session";
import { Icon } from "./ui/icons";
import { ThemeToggle } from "./ui/ThemeToggle";

export type NavPlace = "home" | "explore" | "games" | "moderation" | "";

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
      <a className="site-logo" href="#/" aria-label="GameIDE home">
        <span className="site-logo-game">Game</span>
        <span className="site-logo-ide">IDE</span>
      </a>
      <nav className="site-nav-items" aria-label="Site">
        {item("explore", "#/explore", Icon.search(20), "Explore", "nav-explore")}
        {item("games", "#/games", Icon.create(20), "Create", "nav-games")}
        {(me.user?.teacher || me.user?.admin) && item("moderation", "#/moderation", Icon.approve(20), "Approvals", "link-moderation")}
      </nav>
      <span className="spacer" />
      <AccountMenu />
      <ThemeToggle />
    </header>
  );
}
