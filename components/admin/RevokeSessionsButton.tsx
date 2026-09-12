"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui";
import { revokeAllSessions } from "@/app/admin/users/actions";

export function RevokeSessionsButton({ userId, disabled }: { userId: string; disabled?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      disabled={pending || disabled}
      className="h-9 px-3 text-xs text-crimson"
      onClick={() => start(() => revokeAllSessions(userId))}
    >
      {pending ? "Revoking…" : "Revoke all sessions"}
    </Button>
  );
}
