import { notFound } from "next/navigation";
import { getAdminOrder } from "@/lib/orders";
import { AdminOrderDetail } from "./AdminOrderDetail";

// Request-time only (no generateStaticParams): data depends on the live DB and
// the caller's session.
export const dynamic = "force-dynamic";

export default async function AdminOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getAdminOrder(id);
  if (!order) notFound();

  return (
    <AdminOrderDetail
      order={order}
      customerName={order.customer}
      customerEmail=""
      customerInitials={order.customerInitials}
    />
  );
}
