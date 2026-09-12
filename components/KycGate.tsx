import Link from "next/link";
import { Card } from "@/components/ui";
import { Icon } from "@/components/icons";
import type { KycStatus } from "@/lib/mock-data";

/**
 * Banner shown above the buying flows when the customer's identity isn't
 * cleared yet. The real enforcement is server-side in the bind actions — this
 * just tells them before they fill in a long form.
 */
export function KycGate({ status }: { status: KycStatus }) {
  if (status === "verified") return null;
  const pending = status === "pending";
  return (
    <Card
      className={
        pending
          ? "flex flex-col gap-3 border-warning/30 bg-warning-bg p-5 sm:flex-row sm:items-center sm:justify-between"
          : "flex flex-col gap-3 border-crimson/30 bg-danger-bg p-5 sm:flex-row sm:items-center sm:justify-between"
      }
    >
      <div className="flex items-start gap-3">
        <Icon
          name={pending ? "bell" : "shield"}
          className={pending ? "mt-0.5 size-5 shrink-0 text-warning" : "mt-0.5 size-5 shrink-0 text-crimson"}
        />
        <div>
          <p className="text-sm font-semibold text-ink">
            {pending ? "Your identity is being reviewed" : "Verify your identity to buy cover"}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {pending
              ? "A reviewer is checking your details. You'll be able to bind cover as soon as it clears."
              : "Nigerian insurance rules require us to confirm who you are. It takes a few seconds."}
          </p>
        </div>
      </div>
      {!pending && (
        <Link
          href="/kyc"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-[10px] bg-navy px-5 py-3 text-sm font-medium text-surface transition-colors hover:bg-navy-800"
        >
          <Icon name="shieldCheck" className="size-4" /> Verify now
        </Link>
      )}
    </Card>
  );
}
