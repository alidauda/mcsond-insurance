"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { cx } from "@/components/ui";

type Mode = "sign-in" | "sign-up";

const inputCls =
  "h-12 w-full rounded-[10px] border border-line bg-surface px-4 text-sm text-ink outline-none focus:border-navy";

/** Email + password sign-in / sign-up. Google (above) remains an alternative. */
export function EmailPasswordForm() {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setNotice(null);

    const { error: err } =
      mode === "sign-in"
        ? await authClient.signIn.email({ email, password, callbackURL: "/dashboard" })
        : await authClient.signUp.email({
            name: name.trim(),
            email,
            password,
            company: company.trim() || undefined,
            callbackURL: "/dashboard",
          });

    if (err) {
      setError(err.message ?? "Something went wrong — try again.");
      setPending(false);
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      setError("Enter your email above first, then tap “Forgot password?” again.");
      return;
    }
    setError(null);
    await authClient.requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/reset-password`,
    });
    // Constant message regardless of account existence (no user enumeration).
    setNotice(`If an account exists for ${email}, a reset link is on its way.`);
  }

  return (
    <div className="mt-7">
      {/* divider */}
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-faint">
          or with email
        </span>
        <span className="h-px flex-1 bg-line" />
      </div>

      {/* mode toggle */}
      <div className="mt-5 grid grid-cols-2 gap-1 rounded-[10px] border border-line bg-surface p-1">
        {(["sign-in", "sign-up"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
              setNotice(null);
            }}
            className={cx(
              "rounded-[7px] py-2 text-sm font-medium transition-colors",
              mode === m ? "bg-navy text-surface" : "text-muted hover:text-ink",
            )}
          >
            {m === "sign-in" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        {mode === "sign-up" && (
          <>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              autoComplete="name"
              required
              className={inputCls}
            />
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Company (optional)"
              autoComplete="organization"
              className={inputCls}
            />
          </>
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          autoComplete="username"
          required
          className={inputCls}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === "sign-up" ? "Password (min. 8 characters)" : "Password"}
          autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
          minLength={8}
          required
          className={inputCls}
        />

        <button
          type="submit"
          disabled={pending}
          className="h-12 w-full rounded-[10px] bg-navy text-sm font-medium text-surface transition-colors hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending
            ? mode === "sign-in"
              ? "Signing in…"
              : "Creating account…"
            : mode === "sign-in"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>

      <div className="mt-3 flex items-center justify-between text-sm">
        {mode === "sign-in" ? (
          <button
            type="button"
            onClick={handleForgotPassword}
            className="text-muted hover:text-navy hover:underline"
          >
            Forgot password?
          </button>
        ) : (
          <span className="text-xs text-muted">
            We’ll send a verification email — you can sign in right away.
          </span>
        )}
      </div>

      {error && <p className="mt-3 text-sm font-medium text-crimson">{error}</p>}
      {notice && <p className="mt-3 text-sm font-medium text-success">{notice}</p>}
    </div>
  );
}
