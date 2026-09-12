"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { Icon } from "@/components/icons";
import { inviteStaff, revokeInvite, type InviteResult } from "@/app/admin/staff/actions";
import type { StaffRole } from "@/lib/permissions";

const ROLE_OPTIONS: { value: StaffRole; label: string }[] = [
  { value: "operations", label: "Operations" },
  { value: "finance", label: "Finance" },
  { value: "support", label: "Support" },
  { value: "kyc_reviewer", label: "KYC Reviewer" },
  { value: "superadmin", label: "Super Admin" },
];

export function InviteStaff() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("operations");
  const [result, setResult] = useState<InviteResult | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    start(async () => {
      const res = await inviteStaff(email, role);
      setResult(res);
      if (res.ok) setEmail("");
    });
  }

  return (
    <div className="relative">
      <Button variant="primary" onClick={() => setOpen((v) => !v)}>
        <Icon name="plus" className="size-4" /> Invite staff
      </Button>

      {open && (
        <form
          onSubmit={submit}
          className="absolute right-0 z-20 mt-2 w-80 rounded-[14px] border border-line bg-surface p-4 shadow-xl"
        >
          <label className="block text-xs font-medium text-muted">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@mcsond.ng"
            className="mt-1 h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-sm text-ink outline-none placeholder:text-faint focus:border-navy/40"
          />

          <label className="mt-3 block text-xs font-medium text-muted">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as StaffRole)}
            className="mt-1 h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-navy/40"
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} className="h-9 px-3 text-sm">
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={pending} className="h-9 px-4 text-sm">
              {pending ? "Sending…" : "Send invite"}
            </Button>
          </div>

          {result && (
            <p className={`mt-3 text-xs leading-relaxed ${result.ok ? "text-success" : "text-crimson"}`}>
              {result.message}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

export function RevokeInviteButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      disabled={pending}
      className="h-8 px-2.5 text-xs text-crimson"
      onClick={() => start(() => revokeInvite(id).then(() => undefined))}
    >
      {pending ? "Revoking…" : "Revoke"}
    </Button>
  );
}
