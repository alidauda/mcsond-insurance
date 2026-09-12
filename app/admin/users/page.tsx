import { Eyebrow } from "@/components/ui";
import { UsersTable } from "@/components/admin/UsersTable";
import { listCustomers } from "@/lib/admin-users";

// Server Component: fetches via the permission-checked admin API.
export default async function AdminUsersPage() {
  const rows = await listCustomers();

  return (
    <div className="mx-auto max-w-6xl">
      <Eyebrow className="text-muted">Users</Eyebrow>
      <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight text-navy">
        Customers
      </h1>
      <p className="mt-2 text-muted">{rows.length} accounts. Click a row to manage.</p>

      <div className="mt-8">
        <UsersTable rows={rows} />
      </div>
    </div>
  );
}
