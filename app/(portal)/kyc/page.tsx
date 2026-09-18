import { requireCustomer } from "@/lib/server-session";
import { getKycEvidence, getKycAttempts, getDeclaredIdentity } from "@/lib/kyc";
import { isSwiftCheckConfigured, availableMethods } from "@/lib/swiftcheck";
import { Card } from "@/components/ui";
import KycClient from "./KycClient";

// Request-time only: status and history come from the live DB.
export const dynamic = "force-dynamic";

export default async function KycPage() {
  const me = await requireCustomer();
  const [configured, evidence, attempts, declared] = await Promise.all([
    isSwiftCheckConfigured(),
    getKycEvidence(me.id),
    getKycAttempts(me.id, 5),
    getDeclaredIdentity(me.id),
  ]);

  if (!configured) {
    return (
      <Card className="p-8 text-sm text-muted">
        Identity verification isn&rsquo;t available right now. Please check back shortly.
      </Card>
    );
  }

  return (
    <KycClient
      accountName={me.name}
      status={evidence?.status ?? "unverified"}
      evidence={evidence}
      attempts={attempts}
      methods={availableMethods()}
      declared={declared}
    />
  );
}
