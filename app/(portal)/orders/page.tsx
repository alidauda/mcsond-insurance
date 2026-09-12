import { PageHeading } from "@/components/ui";
import { getOrders } from "@/lib/orders";
import { OrdersTable } from "./OrdersTable";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ placed?: string }>;
}) {
  const [orders, sp] = await Promise.all([getOrders(), searchParams]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeading
        eyebrow="Policies & Receipts"
        title={
          <>
            Everything you&apos;ve <em className="italic text-crimson">covered.</em>
          </>
        }
      />

      {sp.placed && (
        <div className="rounded-[12px] border border-success/30 bg-success-bg px-5 py-4 text-sm font-medium text-success">
          Policy {sp.placed} bound — paid from your wallet. Your certificate is ready.
        </div>
      )}

      <OrdersTable orders={orders} />
    </div>
  );
}
