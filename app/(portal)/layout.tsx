import { CustomerShell } from "@/components/CustomerShell";
import { requireCustomer } from "@/lib/server-session";
import { getCustomerNavBadges } from "@/lib/nav-counts";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  // Redirect UX (no session -> "/", staff -> "/admin"). Not the only gate:
  // pages/actions re-check via the DAL, since layouts don't re-run on nav.
  const user = await requireCustomer();
  const badges = await getCustomerNavBadges(user.id);
  return (
    <CustomerShell
      user={{
        name: user.name,
        email: user.email,
        initials: user.initials,
      }}
      badges={badges}
    >
      {children}
    </CustomerShell>
  );
}
