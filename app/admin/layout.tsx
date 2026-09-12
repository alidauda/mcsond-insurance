import { AdminShell } from "@/components/AdminShell";
import { requireStaff } from "@/lib/server-session";
import { getAdminNavBadges } from "@/lib/nav-counts";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Redirect UX (no session -> "/", customer -> "/dashboard"). Mutating actions
  // re-check permissions via requirePermission().
  const user = await requireStaff();
  const badges = await getAdminNavBadges();
  return (
    <AdminShell
      user={{
        name: user.name,
        email: user.email,
        initials: user.initials,
        role: user.role,
      }}
      badges={badges}
    >
      {children}
    </AdminShell>
  );
}
