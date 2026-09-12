"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Icon } from "@/components/icons";

/**
 * Google sign-in island. Sends the user through Better Auth's Google OAuth
 * flow; on success the callback lands on /dashboard (the two layouts then
 * route staff to /admin and customers to /dashboard via requireX()).
 */
export function GoogleSignInButton({
  label = "Continue with Google",
  variant = "primary",
}: {
  label?: string;
  variant?: "primary" | "inline";
}) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/dashboard",
      });
    } catch {
      setPending(false);
    }
  }

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="font-semibold text-crimson hover:text-crimson-700 disabled:opacity-60"
      >
        {pending ? "Redirecting…" : label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="flex h-14 w-full items-center justify-center gap-3 rounded-[12px] border border-navy/20 bg-surface text-base font-medium text-ink transition-colors hover:border-navy/40 hover:bg-navy/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Icon name="google" className="size-5" />
      {pending ? "Redirecting…" : label}
    </button>
  );
}
