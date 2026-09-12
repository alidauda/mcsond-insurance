import { getAdminOrders } from "@/lib/orders";
import { AdminOrdersTable } from "./AdminOrdersTable";

export default async function AdminOrdersPage() {
  const adminOrders = await getAdminOrders();
  return <AdminOrdersTable adminOrders={adminOrders} />;
}
