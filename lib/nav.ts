import type { IconName } from "@/components/icons";

export type NavItem = {
  label: string;
  href: string;
  icon: IconName;
};

/**
 * Live sidebar counts, keyed by nav href (e.g. { "/admin/support": "17" }).
 * Computed per request in the layouts — see lib/nav-counts.ts. Absent keys
 * render no badge, so a zero count simply shows nothing.
 */
export type NavBadges = Record<string, string>;

export type NavGroup = {
  heading: string;
  items: NavItem[];
};

/** Customer portal navigation (light sidebar). */
export const customerNav: NavGroup[] = [
  {
    heading: "Workspace",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: "home" },
      { label: "Wallet", href: "/wallet", icon: "wallet" },
      { label: "Policies & receipts", href: "/orders", icon: "receipt" },
    ],
  },
  {
    heading: "Buy",
    items: [
      { label: "Insurance", href: "/insurance", icon: "shield" },
    ],
  },
  {
    heading: "Account",
    items: [{ label: "Identity check", href: "/kyc", icon: "shieldCheck" }],
  },
  {
    heading: "Help",
    items: [{ label: "Support tickets", href: "/support", icon: "ticket" }],
  },
];

/** Admin console navigation (dark sidebar). */
export const adminNav: NavGroup[] = [
  {
    heading: "Operations",
    items: [
      { label: "Overview", href: "/admin", icon: "gauge" },
      { label: "User control", href: "/admin/users", icon: "users" },
      { label: "Policies", href: "/admin/orders", icon: "receipt" },
      { label: "Insurance plans", href: "/admin/insurance", icon: "shield" },
      { label: "Wallets & ledger", href: "/admin/wallets", icon: "wallet" },
      { label: "Support inbox", href: "/admin/support", icon: "inbox" },
    ],
  },
  {
    heading: "Governance",
    items: [
      { label: "Staff & RBAC", href: "/admin/staff", icon: "shieldCheck" },
      { label: "Audit trail", href: "/admin/audit", icon: "file" },
      { label: "Reports", href: "/admin/reports", icon: "barChart" },
    ],
  },
  {
    heading: "Configuration",
    items: [{ label: "System profile", href: "/admin/settings", icon: "settings" }],
  },
];
