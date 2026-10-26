/**
 * A person's avatar: one picture from xp.py's AVATARS (public/avatars/, the
 * same pictures as PyIDE's), or their own photo once a teacher approved it
 * ("photo:<slug>", served by /photo/<slug>), or a plain silhouette for
 * someone who hasn't chosen. PyIDE's static/avatar.js does the same for its
 * pages; this is GameIDE's React version of it, not a copy of that file.
 *
 * The id is checked against a pattern before it becomes a URL: the server
 * only ever saves ids from its list, but this is where an id turns into
 * markup, so this is where the check belongs.
 */
export function avatarUrl(id: string | null | undefined): string | null {
  const photo = /^photo:([a-z0-9]{4,16})$/.exec(id ?? "");
  if (photo) return `/photo/${photo[1]}`;
  return /^[a-z0-9-]{1,40}$/.test(id ?? "") ? `/avatars/${id}.webp` : null;
}

export function Avatar({ id, size = 36, className = "" }: { id: string | null | undefined; size?: number; className?: string }) {
  const src = avatarUrl(id);
  return (
    <span className={`avatar ${className}`} style={{ width: size, height: size }} data-avatar={id ?? ""}>
      {src ? (
        <img src={src} alt="" loading="lazy" decoding="async" />
      ) : (
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <rect width="100" height="100" fill="#2a3140" />
          <circle cx="50" cy="40" r="17" fill="#4a5466" />
          <path d="M16 100 Q18 66 50 64 Q82 66 84 100Z" fill="#4a5466" />
        </svg>
      )}
    </span>
  );
}
