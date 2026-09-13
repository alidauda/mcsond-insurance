import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo, Wordmark } from "@/components/Logo";
import { Icon } from "@/components/icons";
import { Eyebrow, Avatar } from "@/components/ui";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { EmailPasswordForm } from "@/components/EmailPasswordForm";
import { signIn } from "@/lib/mock-data";
import { getSession } from "@/lib/server-session";
import { STAFF_ROLES } from "@/lib/permissions";

export default async function SignInPage() {
  // Already signed in (validated against the DB, not just cookie presence) →
  // straight to the right portal. Stale cookies fall through to the form.
  const session = await getSession();
  if (session) {
    const role = (session.user as { role?: string }).role ?? "user";
    redirect(STAFF_ROLES.includes(role as (typeof STAFF_ROLES)[number]) ? "/admin" : "/dashboard");
  }
  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[1.08fr_0.92fr]">
      {/* ── Left · navy brand panel (desktop) ── */}
      <aside className="relative hidden overflow-hidden bg-navy px-14 py-12 text-surface lg:flex lg:flex-col lg:justify-between">
        {/* oversized watermark */}
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-24 right-2 select-none font-serif text-[26rem] font-semibold leading-none text-surface/[0.04]"
        >
          M
        </span>

        <Logo tone="light" tagline href="/" markClass="size-11" wordClass="text-2xl" />

        <div className="relative max-w-xl">
          <Eyebrow className="text-surface/55">{signIn.eyebrow}</Eyebrow>
          <h1 className="mt-6 font-serif text-6xl font-semibold leading-[1.02] tracking-tight">
            Every policy your business depends on,{" "}
            <em className="italic text-crimson">in one place.</em>
          </h1>
          <p className="mt-7 max-w-md text-lg leading-relaxed text-surface/75">{signIn.blurb}</p>
        </div>

        <figure className="relative max-w-lg border-l-2 border-crimson/70 pl-5">
          <blockquote className="font-serif text-xl italic leading-relaxed text-surface/85">
            “{signIn.testimonial.quote}”
          </blockquote>
          <figcaption className="mt-4 flex items-center gap-3">
            <Avatar initials={signIn.testimonial.initials} className="bg-surface/15 text-surface" />
            <div className="leading-tight">
              <p className="text-sm font-semibold">{signIn.testimonial.name}</p>
              <p className="text-sm text-surface/60">{signIn.testimonial.title}</p>
            </div>
          </figcaption>
        </figure>
      </aside>

      {/* ── Right · auth card ── */}
      <main className="flex min-h-screen flex-col px-6 py-10 sm:px-12 lg:px-16">
        {/* mobile logo */}
        <div className="lg:hidden">
          <Logo tone="dark" tagline href="/" markClass="size-10" wordClass="text-2xl" />
        </div>

        <div className="flex flex-1 flex-col justify-center">
          <div className="mx-auto w-full max-w-md">
            <Eyebrow>Sign in</Eyebrow>
            <h2 className="mt-4 font-serif text-5xl font-semibold tracking-tight text-navy">
              Welcome <em className="italic text-crimson">back.</em>
            </h2>
            <p className="mt-3 text-base text-muted">
              Sign in to compare quotes, bind cover and download your certificates.
            </p>

            <div className="mt-9">
              <GoogleSignInButton />
            </div>

            <EmailPasswordForm />

            <hr className="my-7 border-0 border-t border-line" />

            <ul className="grid grid-cols-3 gap-4">
              {signIn.trust.map((t) => (
                <li key={t.tag}>
                  <p className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-faint">{t.tag}</p>
                  <p className="mt-1 text-sm text-ink-soft">{t.label}</p>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex items-center justify-center gap-2 text-sm text-muted">
              <Icon name="lock" className="size-4 text-faint" />
              Staff member?
              <Link href="/admin" className="font-medium text-navy hover:underline">
                Admin sign-in →
              </Link>
            </div>
          </div>
        </div>

        <footer className="mt-8 hidden items-center gap-2 text-xs text-faint lg:flex">
          <Wordmark tone="dark" className="text-sm" /> · Promise kept · v1.0
        </footer>
      </main>
    </div>
  );
}
