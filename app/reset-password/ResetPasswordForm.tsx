"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error: err } = await authClient.resetPassword({ newPassword: password, token });
    if (err) {
      setError(err.message ?? "Could not reset the password — the link may have expired.");
      setPending(false);
      return;
    }
    router.push("/?reset=done");
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-3">
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="New password (min. 8 characters)"
        autoComplete="new-password"
        minLength={8}
        required
        className="h-12 w-full rounded-[10px] border border-line bg-surface px-4 text-sm text-ink outline-none focus:border-navy"
      />
      <button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-[10px] bg-navy text-sm font-medium text-surface hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Saving…" : "Set new password"}
      </button>
      {error && <p className="text-sm font-medium text-crimson">{error}</p>}
      <p className="text-xs text-muted">
        All existing sessions are signed out when the password changes.
      </p>
    </form>
  );
}
