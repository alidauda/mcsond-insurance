"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui";
import { Icon } from "@/components/icons";
import {
  suspendUser,
  reactivateUser,
  setUserKyc,
  impersonate,
} from "@/app/admin/users/actions";

interface UserActionsProps {
  userId: string;
  banned: boolean;
  kyc: "verified" | "pending" | "unverified";
}

/**
 * Action bar. Buttons stay enabled for everyone; the server actions enforce
 * permissions (a staffer without the capability gets a thrown FORBIDDEN, which
 * surfaces as an error rather than a silent no-op).
 */
export function UserActions({ userId, banned, kyc }: UserActionsProps) {
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-3">
      {banned ? (
        <Button variant="secondary" disabled={pending} onClick={() => start(() => reactivateUser(userId))}>
          <Icon name="check" className="size-4" /> Reactivate
        </Button>
      ) : (
        <Button variant="danger" disabled={pending} onClick={() => start(() => suspendUser(userId))}>
          <Icon name="ban" className="size-4" /> Suspend
        </Button>
      )}

      {kyc !== "verified" && (
        <Button variant="secondary" disabled={pending} onClick={() => start(() => setUserKyc(userId, "verified"))}>
          <Icon name="check" className="size-4" /> Approve KYC
        </Button>
      )}

      <Button variant="secondary" disabled={pending} onClick={() => start(() => impersonate(userId))}>
        <Icon name="eye" className="size-4" /> View as user
      </Button>

      {pending && <span className="text-xs text-muted">Working…</span>}
    </div>
  );
}
