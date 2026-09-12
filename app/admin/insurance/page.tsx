import { PageHeading } from "@/components/ui";
import { getAdminInsurancePlans } from "@/lib/catalog";
import InsurancePlansClient from "./InsurancePlansClient";

export default async function AdminInsurancePlansPage() {
  const plans = await getAdminInsurancePlans();

  return (
    <div className="flex flex-col gap-8">
      <PageHeading
        eyebrow={`Insurance plans · ${plans.length} plans`}
        title={
          <>
            Set the <em className="italic text-crimson">cover terms.</em>
          </>
        }
        description="Annual premium, underwriter, class and features per plan. Plans on the NEM eInsurance API are priced live by NEM (the premium here is only the displayed from-price). Customers only see plans marked Live; stamp duty and VAT are added at quote time."
      />
      <InsurancePlansClient plans={plans} />
    </div>
  );
}
