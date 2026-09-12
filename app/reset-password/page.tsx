import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Eyebrow } from "@/components/ui";
import { ResetPasswordForm } from "./ResetPasswordForm";

/**
 * Landing page for password-reset links (…/reset-password?token=…).
 * Better Auth appends ?error=INVALID_TOKEN when the link is expired/used.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const sp = await searchParams;

  return (
    <div className="flex min-h-screen flex-col bg-canvas px-6 py-10 sm:px-12">
      <Logo tone="dark" tagline href="/" markClass="size-10" wordClass="text-2xl" />
      <div className="flex flex-1 flex-col justify-center">
        <div className="mx-auto w-full max-w-md">
          <Eyebrow>Password reset</Eyebrow>
          {sp.error || !sp.token ? (
            <>
              <h1 className="mt-4 font-serif text-4xl font-semibold tracking-tight text-navy">
                That link has <em className="italic text-crimson">expired.</em>
              </h1>
              <p className="mt-3 text-base text-muted">
                Reset links are single-use and valid for 30 minutes. Request a new one from the
                sign-in page.
              </p>
              <Link
                href="/"
                className="mt-6 inline-flex h-12 items-center rounded-[10px] bg-navy px-6 text-sm font-medium text-surface hover:bg-navy-800"
              >
                ← Back to sign in
              </Link>
            </>
          ) : (
            <>
              <h1 className="mt-4 font-serif text-4xl font-semibold tracking-tight text-navy">
                Choose a <em className="italic text-crimson">new password.</em>
              </h1>
              <ResetPasswordForm token={sp.token} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
