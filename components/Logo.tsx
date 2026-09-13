import Link from "next/link";

/**
 * The McSond mark — the brand's red nail-and-swoosh glyph (from the official
 * logo) on a navy tile. Kept as inline SVG so it stays crisp at every size and
 * matches app/icon.svg, which is the same drawing.
 */
export function LogoMark({ className = "size-9" }: { className?: string }) {
  return (
    <span
      className={`inline-grid place-items-center rounded-md bg-navy ${className}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" className="size-[82%]" fill="#c8233c">
        {/* swoosh: sweeps up from the left, over the top, down to the base */}
        <path
          d="M6.5 12.5 C 11 7.5, 20.5 6.5, 21.2 20.4"
          fill="none"
          stroke="#c8233c"
          strokeWidth={1.7}
          strokeLinecap="round"
        />
        {/* base block */}
        <rect x="18" y="20.6" width="6.2" height="2.8" rx="0.4" />
        {/* nail: tapered spike from top-right down to the head */}
        <path d="M26.5 5.2 L13.4 18.2 L11.6 16.2 Z" />
        {/* nail head: flat disc, tilted with the spike */}
        <ellipse cx="11.6" cy="17.2" rx="3.6" ry="1.75" transform="rotate(-42 11.6 17.2)" />
      </svg>
    </span>
  );
}

/**
 * Wordmark: "McSond" with the crimson italic "c", followed by "Insurance" in a
 * lighter weight so the product reads at a glance without shouting.
 * tone="light" for dark backgrounds, "dark" for light backgrounds.
 * product=false drops "Insurance" where the shell already labels the product.
 */
export function Wordmark({
  tone = "dark",
  product = true,
  className = "",
}: {
  tone?: "light" | "dark";
  product?: boolean;
  className?: string;
}) {
  const base = tone === "light" ? "text-surface" : "text-navy";
  return (
    <span className={`font-serif font-semibold tracking-tight ${base} ${className}`}>
      M<em className="not-italic text-crimson italic">c</em>Sond
      {product && <span className="font-normal"> Insurance</span>}
    </span>
  );
}

/** Full lockup: mark + wordmark + optional "…Promise kept" tagline (as on the brand logo). */
export function Logo({
  tone = "dark",
  tagline = false,
  product = true,
  href = "/dashboard",
  markClass = "size-10",
  wordClass = "text-2xl",
}: {
  tone?: "light" | "dark";
  tagline?: boolean;
  product?: boolean;
  href?: string;
  markClass?: string;
  wordClass?: string;
}) {
  const sub = tone === "light" ? "text-surface/60" : "text-faint";
  return (
    <Link href={href} className="inline-flex items-center gap-3">
      <LogoMark className={markClass} />
      <span className="flex flex-col leading-none">
        <Wordmark tone={tone} product={product} className={wordClass} />
        {tagline && (
          <span className={`eyebrow mt-1 ${sub}`}>…Promise kept</span>
        )}
      </span>
    </Link>
  );
}
