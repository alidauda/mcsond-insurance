"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { adminNav, type NavBadges } from "@/lib/nav";
import { authClient } from "@/lib/auth-client";
import { LogoMark, Wordmark } from "@/components/Logo";
import { Icon } from "@/components/icons";
import { Avatar, cx } from "@/components/ui";

export interface AdminShellUser {
  name: string;
  email: string;
  initials: string;
  role: string;
}

const roleLabels: Record<string, string> = {
  superadmin: "Super Admin",
  operations: "Operations",
  finance: "Finance",
  support: "Support",
  kyc_reviewer: "KYC Reviewer",
};

const CRUMBS: Record<string, string> = {
  "/admin": "Overview",
  "/admin/users": "User control",
  "/admin/orders": "Policies",
  "/admin/insurance": "Insurance plans",
  "/admin/wallets": "Wallets & ledger",
  "/admin/support": "Support inbox",
  "/admin/staff": "Staff & RBAC",
  "/admin/audit": "Audit trail",
  "/admin/reports": "Reports",
  "/admin/settings": "System profile",
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function crumbFor(pathname: string): string {
  if (CRUMBS[pathname]) return CRUMBS[pathname];
  const section = "/" + pathname.split("/").slice(1, 3).join("/"); // e.g. /admin/users
  return CRUMBS[section] ?? "Overview";
}

export function AdminShell({
  user,
  badges = {},
  children,
}: {
  user: AdminShellUser;
  /** Live sidebar counts keyed by href (see lib/nav-counts.ts). */
  badges?: NavBadges;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const roleLabel = roleLabels[user.role] ?? user.role;

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-admin text-surface">
      <div className="px-6 pt-6 pb-5">
        <Link href="/admin" className="flex items-center gap-3">
          <LogoMark className="size-10" />
          <span className="flex flex-col leading-none">
            <Wordmark tone="light" product={false} className="text-2xl" />
            <span className="mt-1.5 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-admin-muted">
              Insurance · Staff console
            </span>
          </span>
        </Link>
      </div>
      <div className="mx-6 border-t border-admin-700" />

      <nav className="flex-1 overflow-y-auto px-4 py-5">
        {adminNav.map((group) => (
          <div key={group.heading} className="mb-6">
            <p className="px-3 pb-2 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-admin-muted">
              {group.heading}
            </p>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                const badge = badges[item.href];
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cx(
                        "flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors",
                        active ? "bg-admin-700 text-surface" : "text-surface/70 hover:bg-admin-800 hover:text-surface",
                      )}
                    >
                      <Icon name={item.icon} className="size-[18px]" />
                      <span className="flex-1">{item.label}</span>
                      {badge && (
                        <span className="rounded-full bg-admin-800 px-2 py-0.5 font-mono text-[0.62rem] text-admin-muted">
                          {badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mx-4 mb-4 flex items-center gap-3 border-t border-admin-700 px-2 pt-4">
        <Avatar initials={user.initials} className="bg-crimson text-surface" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="truncate font-mono text-[0.68rem] text-admin-muted">{roleLabel}</p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          aria-label="Sign out"
          className="grid size-9 place-items-center rounded-[10px] bg-admin-800 text-surface/70 hover:bg-admin-700"
        >
          <Icon name="logout" className="size-[18px]" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[268px] shrink-0 lg:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-admin/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[280px] shadow-xl">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-canvas/90 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="grid size-9 place-items-center rounded-[10px] border border-line bg-surface text-ink lg:hidden"
            aria-label="Open menu"
          >
            <Icon name="dots" className="size-5" />
          </button>

          <div className="hidden items-center gap-2 font-mono text-[0.72rem] uppercase tracking-[0.16em] sm:flex">
            <Link href="/admin" className="text-faint hover:text-muted">
              Admin
            </Link>
            <span className="text-line">/</span>
            <span className="text-ink-soft">{crumbFor(pathname)}</span>
          </div>

          <span className="ml-1 hidden items-center gap-1.5 rounded-full border border-crimson/30 bg-danger-bg px-3 py-1.5 font-mono text-[0.66rem] uppercase tracking-wide text-crimson md:inline-flex">
            <span className="size-1.5 rounded-full bg-crimson" />
            <Icon name="shieldCheck" className="size-3.5" />
            {roleLabel}
          </span>

          <div className="relative ml-auto min-w-0 flex-1 sm:max-w-sm">
            <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
            <input
              placeholder="Search users, policies, tickets…"
              className="h-10 w-full rounded-[10px] border border-line bg-surface pl-10 pr-12 text-sm text-ink outline-none placeholder:text-faint focus:border-navy/40"
            />
            <kbd className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-line bg-canvas px-1.5 py-0.5 font-mono text-[0.62rem] text-faint sm:block">
              ⌘K
            </kbd>
          </div>

          <button
            type="button"
            className="grid size-9 place-items-center rounded-[10px] border border-line bg-surface text-ink-soft hover:bg-canvas"
            aria-label="Notifications"
          >
            <Icon name="bell" className="size-[18px]" />
          </button>
        </header>

        <main className="flex-1 px-4 py-7 sm:px-6 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
