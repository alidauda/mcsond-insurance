import Link from "next/link";

/** The McSond mark — crimson glyph on a navy tile. */
export function LogoMark({ className = "size-9" }: { className?: string }) {
  return (
    <span
      className={`inline-grid place-items-center rounded-md bg-navy ${className}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" className="size-[64%]" fill="none" stroke="#c8233c" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {/* mast */}
        <path d="M11 7v18" />
        {/* jib + counter-jib */}
        <path d="M7 9h16" />
        {/* hoist line + hook */}
        <path d="M20 9v5" />
        <path d="M18.5 14h3" />
        {/* base */}
        <path d="M8 25h6" />
      </svg>
    </span>
  );
}

/**
 * Wordmark: "Mc S ond." with the crimson italic "c".
 * tone="light" for dark backgrounds, "dark" for light backgrounds.
 */
export function Wordmark({
  tone = "dark",
  className = "",
}: {
  tone?: "light" | "dark";
  className?: string;
}) {
  const base = tone === "light" ? "text-surface" : "text-navy";
  return (
    <span className={`font-serif font-semibold tracking-tight ${base} ${className}`}>
      M<em className="not-italic text-crimson italic">c</em>Sond
    </span>
  );
}

/** Full lockup: mark + wordmark + optional "…Promise kept" tagline. */
export function Logo({
  tone = "dark",
  tagline = false,
  href = "/dashboard",
  markClass = "size-10",
  wordClass = "text-2xl",
}: {
  tone?: "light" | "dark";
  tagline?: boolean;
  href?: string;
  markClass?: string;
  wordClass?: string;
}) {
  const sub = tone === "light" ? "text-surface/60" : "text-faint";
  return (
    <Link href={href} className="inline-flex items-center gap-3">
      <LogoMark className={markClass} />
      <span className="flex flex-col leading-none">
        <Wordmark tone={tone} className={wordClass} />
        {tagline && (
          <span className={`eyebrow mt-1 ${sub}`}>…Promise kept</span>
        )}
      </span>
    </Link>
  );
}
