import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { naira } from "@/lib/format";

/* ──────────────────────────────────────────────────────────────
   Presentational kit. All server-safe (no hooks). Compose freely.
   For interactive tabs/filters, see components/Interactive.tsx.
   ────────────────────────────────────────────────────────────── */

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/* Eyebrow — monospace uppercase kicker above a heading. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("eyebrow", className)}>{children}</p>;
}

/**
 * Page heading block: eyebrow + serif display title (+ optional actions row).
 * Pass `title` as JSX so you control the crimson italic accent, e.g.
 *   title={<>Good morning, <em className="text-crimson italic">Adaeze.</em></>}
 */
export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="max-w-3xl">
        {eyebrow && <Eyebrow className="mb-3">{eyebrow}</Eyebrow>}
        <h1 className="display text-4xl sm:text-5xl">{title}</h1>
        {description && <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

/* Card — white surface with warm border. */
export function Card({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  return (
    <Tag className={cx("rounded-[14px] border border-line bg-surface", className)}>{children}</Tag>
  );
}

/* Section label inside cards (mono uppercase, smaller). */
export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cx("font-mono text-[0.7rem] uppercase tracking-[0.16em] text-muted", className)}>
      {children}
    </p>
  );
}

/* Serif section title (e.g. "Recent activity", "Ledger"). */
export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cx("font-serif text-2xl font-semibold text-navy", className)}>{children}</h2>;
}

type ButtonVariant =
  | "primary"
  | "accent"
  | "dark"
  | "outline"
  | "ghost"
  | "dangerSoft"
  | "successSoft"
  | "secondary"
  | "danger";

const buttonStyles: Record<ButtonVariant, string> = {
  primary: "bg-navy text-surface hover:bg-navy-800",
  accent: "bg-crimson text-surface hover:bg-crimson-700",
  dark: "bg-admin text-surface hover:bg-admin-800",
  outline: "border border-navy/25 text-navy hover:bg-navy/5",
  ghost: "text-navy hover:bg-navy/5",
  dangerSoft: "border border-crimson/30 bg-danger-bg text-crimson hover:bg-crimson-100",
  successSoft: "border border-success/30 bg-success-bg text-success hover:bg-success-bg",
  secondary: "border border-navy/20 bg-surface text-ink hover:border-navy/40 hover:bg-navy/[0.03]",
  danger: "bg-crimson text-surface hover:bg-crimson-700",
};

/** Button — renders a Link when `href` is set, else a <button>. */
export function Button({
  children,
  variant = "primary",
  href,
  icon,
  className,
  type,
  ...rest
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  href?: string;
  icon?: IconName;
  className?: string;
  type?: "button" | "submit";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = cx(
    "inline-flex items-center justify-center gap-2 rounded-[10px] px-5 py-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    buttonStyles[variant],
    className,
  );
  const inner = (
    <>
      {icon && <Icon name={icon} className="size-4" />}
      {children}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type={type ?? "button"} className={cls} {...rest}>
      {inner}
    </button>
  );
}

/* Icon-only button (bell, gear, more). */
export function IconButton({
  name,
  label,
  href,
  className,
  tone = "light",
}: {
  name: IconName;
  label: string;
  href?: string;
  className?: string;
  tone?: "light" | "dark";
}) {
  const cls = cx(
    "inline-grid size-9 place-items-center rounded-[10px] border transition-colors",
    tone === "light"
      ? "border-line bg-surface text-ink-soft hover:bg-canvas"
      : "border-admin-700 bg-admin-800 text-surface/80 hover:bg-admin-700",
    className,
  );
  const inner = <Icon name={name} className="size-[18px]" />;
  return href ? (
    <Link href={href} className={cls} aria-label={label}>
      {inner}
    </Link>
  ) : (
    <button type="button" className={cls} aria-label={label}>
      {inner}
    </button>
  );
}

export type BadgeTone = "success" | "warning" | "danger" | "neutral" | "info";

const badgeStyles: Record<BadgeTone, { wrap: string; dot: string }> = {
  success: { wrap: "border-success/30 text-success bg-success-bg", dot: "bg-success" },
  warning: { wrap: "border-warning/30 text-warning bg-warning-bg", dot: "bg-warning" },
  danger: { wrap: "border-crimson/30 text-crimson bg-danger-bg", dot: "bg-crimson" },
  neutral: { wrap: "border-line text-muted bg-surface", dot: "bg-faint" },
  info: { wrap: "border-navy/25 text-navy bg-navy/5", dot: "bg-navy" },
};

/** Status pill with a leading dot. */
export function Badge({
  children,
  tone = "neutral",
  dot = true,
  mono = false,
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  dot?: boolean;
  mono?: boolean;
  className?: string;
}) {
  const s = badgeStyles[tone];
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        mono && "font-mono text-[0.7rem] tracking-wide",
        s.wrap,
        className,
      )}
    >
      {dot && <span className={cx("size-1.5 rounded-full", s.dot)} />}
      {children}
    </span>
  );
}

/** Monospace tag chip (neutral, for codes / categories). */
export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 font-mono text-[0.7rem] tracking-wide text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Avatar with initials. */
export function Avatar({
  initials,
  className,
  tone = "navy",
}: {
  initials: string;
  className?: string;
  tone?: "navy" | "crimson" | "muted";
}) {
  const tones = {
    navy: "bg-navy-100 text-navy",
    crimson: "bg-crimson-100 text-crimson",
    muted: "bg-line-soft text-ink-soft",
  };
  return (
    <span
      className={cx(
        "inline-grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold",
        tones[tone],
        className,
      )}
    >
      {initials}
    </span>
  );
}

/**
 * Money — serif, tabular figures. Use for headline amounts (wallet, totals).
 * `sign` shows +/- (for ledger deltas, where negatives go crimson).
 */
export function Money({
  value,
  className,
  sign = false,
  colorBySign = false,
}: {
  value: number;
  className?: string;
  sign?: boolean;
  colorBySign?: boolean;
}) {
  const color = colorBySign ? (value < 0 ? "text-crimson" : "text-success") : undefined;
  return <span className={cx("font-serif tnum", color, className)}>{naira(value, { sign })}</span>;
}

/* Thin divider. */
export function Divider({ className }: { className?: string }) {
  return <hr className={cx("border-0 border-t border-line", className)} />;
}

/** Tone helper for the shared Status union → BadgeTone. */
export function statusTone(status: string): BadgeTone {
  switch (status) {
    case "active":
    case "delivered":
    case "verified":
    case "resolved":
    case "paid":
    case "live":
      return "success";
    case "renew":
    case "pending":
    case "in-review":
    case "attention":
      return "warning";
    case "in-transit":
    case "open":
    case "suspended":
    case "failed":
      return "danger";
    default:
      return "neutral";
  }
}

/** Pretty label for the Status union. */
export function statusLabel(status: string): string {
  return status.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ──────────────────────────────────────────────────────────────
   Table primitives — used by the admin user/staff consoles.
   ────────────────────────────────────────────────────────────── */

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="overflow-x-auto rounded-[14px] border border-line">
      <table className={cx("w-full border-collapse text-sm", className)}>{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={cx(
        "border-b border-line bg-canvas px-4 py-3 text-left font-mono text-[0.62rem] uppercase tracking-[0.12em] text-faint",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cx("border-b border-line px-4 py-3 text-ink-soft", className)}>{children}</td>;
}

/* Re-export the interactive filter chips so callers import from one place. */
export { FilterChips } from "./FilterChips";
export type { FilterChip } from "./FilterChips";
