import { getInsurancePlans, getInsuranceMeta } from "@/lib/catalog";
import { getWalletBalance } from "@/lib/wallet";
import { requireCustomer } from "@/lib/server-session";
import { getKycStatus } from "@/lib/kyc";
import { Card } from "@/components/ui";
import InsuranceClient from "./InsuranceClient";

export default async function InsurancePlansPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const [plans, meta, me, walletBalance, sp] = await Promise.all([
    getInsurancePlans(),
    getInsuranceMeta(),
    requireCustomer(),
    getWalletBalance(),
    searchParams,
  ]);
  const kycStatus = await getKycStatus(me.id);

  if (plans.length === 0) {
    return (
      <Card className="p-8 text-sm text-muted">
        No insurance plans are available right now — check back shortly.
      </Card>
    );
  }

  return (
    <InsuranceClient
      plans={plans}
      underwriters={meta.underwriters}
      blurb={meta.blurb}
      customerName={me.name}
      walletBalance={walletBalance}
      initialPlanId={sp.plan}
      kycStatus={kycStatus}
    />
  );
}
