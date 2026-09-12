"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Icon } from "@/components/icons";

/** Sign-out island: ends the Better Auth session, then returns home. */
export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className={`inline-flex items-center gap-2 rounded-[10px] px-3 py-2 text-sm font-medium transition-colors ${className ?? ""}`}
    >
      <Icon name="logout" className="size-[18px]" />
      Sign out
    </button>
  );
}
