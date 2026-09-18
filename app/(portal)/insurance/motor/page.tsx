import { redirect } from "next/navigation";
import { Card, Button } from "@/components/ui";
import { getInsurancePlan } from "@/lib/catalog";
import { getWalletBalance } from "@/lib/wallet";
import { requireCustomer } from "@/lib/server-session";
import { getKycStatus, getDeclaredIdentity, getVerifiedPolicyholder } from "@/lib/kyc";
import {
  isNemConfigured,
  getVehicleTypes,
  getVehicleMakes,
  getBranchLocations,
  getEnhancedTypes,
  type NemEnhancedType,
} from "@/lib/nem";
import MotorQuoteClient from "./MotorQuoteClient";

// Request-time only: reference data comes from NEM and the wallet from the DB.
export const dynamic = "force-dynamic";

export default async function MotorQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const [sp, me, walletBalance] = await Promise.all([searchParams, requireCustomer(), getWalletBalance()]);
  const kycStatus = await getKycStatus(me.id);
  const plan = sp.plan ? await getInsurancePlan(sp.plan) : undefined;
  if (!plan || plan.provider !== "nem" || !plan.productCode) redirect("/insurance");

  if (!(await isNemConfigured())) {
    return (
      <Card className="p-8">
        <p className="text-sm text-muted">
          NEM motor cover isn&rsquo;t available right now — the underwriter connection hasn&rsquo;t been configured.
        </p>
        <Button variant="outline" href="/insurance" className="mt-4">
          ← Back to plans
        </Button>
      </Card>
    );
  }

  let vehicleTypes, makes, branches: Awaited<ReturnType<typeof getBranchLocations>> = [];
  let enhancedTypes: NemEnhancedType[] = [];
  try {
    [vehicleTypes, makes] = await Promise.all([getVehicleTypes(), getVehicleMakes()]);
    if (plan.productCode !== "mtp") branches = await getBranchLocations();
    if (plan.productCode === "emtp") enhancedTypes = await getEnhancedTypes();
  } catch (err) {
    return (
      <Card className="p-8">
        <p className="text-sm font-medium text-crimson">
          We couldn&rsquo;t reach NEM to load vehicle data{err instanceof Error ? ` (${err.message})` : ""}. Try again in a moment.
        </p>
        <Button variant="outline" href="/insurance" className="mt-4">
          ← Back to plans
        </Button>
      </Card>
    );
  }

  // Only types NEM will write comprehensive cover for.
  const types = plan.productCode === "comp" ? vehicleTypes.filter((t) => t.comprehensive) : vehicleTypes;
  const [firstName, ...rest] = me.name.trim().split(/\s+/);
  const [declared, verified] = await Promise.all([getDeclaredIdentity(me.id), getVerifiedPolicyholder(me.id)]);

  return (
    <MotorQuoteClient
      plan={{ id: plan.id, name: plan.name, underwriter: plan.underwriter, product: plan.productCode, features: plan.features }}
      vehicleTypes={types}
      makes={makes}
      branches={branches}
      enhancedTypes={enhancedTypes}
      defaults={{
        firstName: firstName ?? "",
        lastName: rest.join(" "),
        email: me.email,
        dob: declared.dateOfBirth ?? "",
        sex: declared.gender === "m" ? "male" : declared.gender === "f" ? "female" : "",
        phone: declared.phone ?? "",
        state: declared.stateOfOrigin ?? "",
      }}
      walletBalance={walletBalance}
      kycStatus={kycStatus}
      verified={verified}
    />
  );
}
