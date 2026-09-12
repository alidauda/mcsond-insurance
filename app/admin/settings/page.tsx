import { PageHeading, Card, Badge, SectionTitle, statusTone, statusLabel } from "@/components/ui";
import { Icon } from "@/components/icons";
import { getSystemProfile, getPaystackSettings, getNemSettings, getSwiftCheckSettings } from "@/lib/settings";
import { PaystackSettingsForm } from "./PaystackSettingsForm";
import { NemSettingsForm } from "./NemSettingsForm";
import { SwiftCheckSettingsForm } from "./SwiftCheckSettingsForm";

const fieldLabel =
  "mb-2 block font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted";
const fieldInput =
  "h-12 w-full rounded-[10px] border border-line bg-surface px-3.5 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-navy";

export default async function AdminSystemProfilePage() {
  const [{ brokerage, integrations, defaults }, paystack, nem, swiftcheck] = await Promise.all([
    getSystemProfile(),
    getPaystackSettings(),
    getNemSettings(),
    getSwiftCheckSettings(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeading
        eyebrow="System profile"
        title={
          <>
            Brokerage <em className="italic text-crimson">configuration.</em>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ── LEFT · Brokerage details ── */}
        <Card className="p-6 sm:p-7">
          <SectionTitle className="text-xl">Brokerage</SectionTitle>

          <div className="mt-6 flex flex-col gap-5">
            {/* Legal name — full width */}
            <div>
              <label className={fieldLabel} htmlFor="legalName">
                Legal name
              </label>
              <input
                id="legalName"
                name="legalName"
                defaultValue={brokerage.legalName}
                className={fieldInput}
              />
            </div>

            {/* NAICOM + RC */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className={fieldLabel} htmlFor="naicom">
                  NAICOM number
                </label>
                <input
                  id="naicom"
                  name="naicom"
                  defaultValue={brokerage.naicom}
                  className={fieldInput}
                />
              </div>
              <div>
                <label className={fieldLabel} htmlFor="rc">
                  RC number
                </label>
                <input
                  id="rc"
                  name="rc"
                  defaultValue={brokerage.rc}
                  className={fieldInput}
                />
              </div>
            </div>

            {/* Registered office — full width */}
            <div>
              <label className={fieldLabel} htmlFor="office">
                Registered office
              </label>
              <input
                id="office"
                name="office"
                defaultValue={brokerage.office}
                className={fieldInput}
              />
            </div>

            {/* Compliance officer + Phone */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className={fieldLabel} htmlFor="complianceOfficer">
                  Compliance officer
                </label>
                <input
                  id="complianceOfficer"
                  name="complianceOfficer"
                  defaultValue={brokerage.complianceOfficer}
                  className={fieldInput}
                />
              </div>
              <div>
                <label className={fieldLabel} htmlFor="phone">
                  Phone
                </label>
                <input
                  id="phone"
                  name="phone"
                  defaultValue={brokerage.phone}
                  className={fieldInput}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* ── RIGHT · Integrations + Defaults ── */}
        <div className="flex flex-col gap-6">
          {/* Integrations */}
          <Card className="p-6 sm:p-7">
            <SectionTitle className="text-xl">Integrations</SectionTitle>

            <ul className="mt-5 flex flex-col">
              {integrations.map((integration) => (
                <li
                  key={integration.name}
                  className="flex items-center justify-between gap-4 border-b border-line py-4 first:pt-0 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{integration.name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted">{integration.note}</p>
                  </div>
                  <Badge tone={statusTone(integration.status)}>
                    {statusLabel(integration.status)}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>

          {/* Paystack keys */}
          <PaystackSettingsForm settings={paystack} />

          {/* NEM broker credentials */}
          <NemSettingsForm settings={nem} />

          {/* SwiftCheck KYC credentials */}
          <SwiftCheckSettingsForm settings={swiftcheck} />

          {/* Defaults */}
          <Card className="p-6 sm:p-7">
            <SectionTitle className="text-xl">Defaults</SectionTitle>

            <div className="mt-6 flex flex-col gap-5">
              <div>
                <label className={fieldLabel} htmlFor="currency">
                  Default currency
                </label>
                <div className="relative">
                  <select
                    id="currency"
                    name="currency"
                    defaultValue={defaults.currency}
                    className={`${fieldInput} appearance-none pr-10`}
                  >
                    <option>{defaults.currency}</option>
                    <option>USD — US Dollar ($)</option>
                    <option>GHS — Ghana Cedi (₵)</option>
                  </select>
                  <Icon
                    name="chevronDown"
                    className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted"
                  />
                </div>
              </div>

              <div>
                <label className={fieldLabel} htmlFor="stampDutyRate">
                  Stamp duty rate
                </label>
                <input
                  id="stampDutyRate"
                  name="stampDutyRate"
                  defaultValue={defaults.stampDutyRate}
                  className={fieldInput}
                />
              </div>

              <div>
                <label className={fieldLabel} htmlFor="vatRate">
                  VAT rate
                </label>
                <input
                  id="vatRate"
                  name="vatRate"
                  defaultValue={defaults.vatRate}
                  className={fieldInput}
                />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
