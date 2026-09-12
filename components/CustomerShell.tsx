"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { customerNav, type NavBadges } from "@/lib/nav";
import { authClient } from "@/lib/auth-client";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/icons";
import { Avatar, IconButton, cx } from "@/components/ui";

export interface ShellUser {
  name: string;
  email: string;
  initials: string;
  company?: string;
}

const CRUMBS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/wallet": "Wallet",
  "/orders": "Orders & receipts",
  "/insurance": "Insurance",
  "/insurance/certificate": "Certificate",
  "/insurance/motor": "Motor quote",
  "/support": "Support tickets",
  "/kyc": "Identity check",
};

function crumbFor(pathname: string): string {
  return CRUMBS[pathname] ?? CRUMBS[`/${pathname.split("/")[1]}`] ?? "Dashboard";
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function CustomerShell({
  user,
  badges = {},
  children,
}: {
  user: ShellUser;
  /** Live sidebar counts keyed by href (see lib/nav-counts.ts). */
  badges?: NavBadges;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="px-6 pt-6 pb-5">
        <Logo tone="dark" markClass="size-10" wordClass="text-2xl" />
        <p className="eyebrow mt-3 ml-[3.25rem] -translate-y-3">Customer portal</p>
      </div>
      <div className="mx-6 border-t border-line" />

      <nav className="flex-1 overflow-y-auto px-4 py-5">
        {customerNav.map((group) => (
          <div key={group.heading} className="mb-6">
            <p className="px-3 pb-2 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-faint">
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
                        active ? "bg-navy text-surface" : "text-ink-soft hover:bg-navy/5",
                      )}
                    >
                      <Icon name={item.icon} className="size-[18px]" />
                      <span className="flex-1">{item.label}</span>
                      {badge && (
                        <span
                          className={cx(
                            "grid min-w-5 place-items-center rounded-full px-1.5 text-[0.7rem] font-semibold",
                            active ? "bg-surface/20 text-surface" : "bg-line text-muted",
                          )}
                        >
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

      <div className="mx-4 mb-4 flex items-center gap-3 rounded-[12px] border border-line bg-surface/60 px-3 py-3">
        <Avatar initials={user.initials} />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
          <p className="truncate text-[0.72rem] text-faint">{user.company ?? user.email}</p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          aria-label="Sign out"
          className="inline-grid size-9 place-items-center rounded-[10px] border border-line bg-surface text-ink-soft transition-colors hover:bg-canvas"
        >
          <Icon name="logout" className="size-[18px]" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[272px] shrink-0 border-r border-line lg:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-navy/30 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[280px] border-r border-line shadow-xl">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
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
            <Link href="/dashboard" className="text-faint hover:text-muted">
              McSond
            </Link>
            <span className="text-line">/</span>
            <span className="text-ink-soft">{crumbFor(pathname)}</span>
          </div>

          <div className="relative min-w-0 flex-1 sm:max-w-md sm:ml-2">
            <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
            <input
              placeholder="Search policies, tickets…"
              className="h-10 w-full rounded-[10px] border border-line bg-surface pl-10 pr-12 text-sm text-ink outline-none placeholder:text-faint focus:border-navy/40"
            />
            <kbd className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-line bg-canvas px-1.5 py-0.5 font-mono text-[0.62rem] text-faint sm:block">
              ⌘K
            </kbd>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <IconButton name="bell" label="Notifications" />
            <IconButton name="settings" label="Settings" href="/support" />
          </div>
        </header>

        <main className="flex-1 px-4 py-7 sm:px-6 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
