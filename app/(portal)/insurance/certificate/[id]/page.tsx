import { notFound } from "next/navigation";
import { PageHeading, Card, SectionLabel, Button, Divider, Money, Badge, statusTone, statusLabel } from "@/components/ui";
import { Icon } from "@/components/icons";
import { getPolicyCertificate } from "@/lib/orders";
import { naira } from "@/lib/format";
import { RENEWAL_WINDOW_DAYS } from "@/lib/quote";

// Request-time only: the certificate depends on the live DB and the caller's session.
export const dynamic = "force-dynamic";

/* 03 · Auto-issued certificate — server component. Every field is sourced from
 * the bound policy row; nothing here is presentational fixture data. */

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <p className="mt-2 text-[0.95rem] font-medium text-ink">{value}</p>
    </div>
  );
}

export default async function CertificatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ bound?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const cert = await getPolicyCertificate(id);
  if (!cert) notFound();

  const justBound = sp.bound === "1";
  const vehicle = [cert.details.vehicle, cert.details.plate].filter(Boolean).join(" · ");
  const whatsNext = [
    `Certificate emailed to ${cert.email}`,
    `Auto-renewal reminder ${RENEWAL_WINDOW_DAYS} days before expiry`,
    "File a claim 24/7 from your dashboard",
  ];

  return (
    <div className="space-y-8">
      <PageHeading
        eyebrow={justBound ? `Bind successful · ${cert.boundAt}` : `Certificate · ${cert.reference}`}
        title={
          justBound ? (
            <>
              You&rsquo;re <em className="italic text-crimson">covered.</em>
            </>
          ) : (
            <>
              Certificate of <em className="italic text-crimson">insurance.</em>
            </>
          )
        }
        actions={
          <>
            {cert.externalCertificateUrl ? (
              <a
                href={cert.externalCertificateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-navy/25 px-5 py-3 text-sm font-medium text-navy transition-colors hover:bg-navy/5"
              >
                <Icon name="download" className="size-4" /> Download NEM certificate
              </a>
            ) : (
              <Button variant="outline" icon="download">
                Download PDF
              </Button>
            )}
            <Button variant="primary" href={`/orders/${cert.reference}`}>
              View policy
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Certificate (2 cols) ── */}
        <Card className="relative lg:col-span-2 p-8 sm:p-10">
          <div className="absolute right-8 top-8 flex items-center gap-3 sm:right-10 sm:top-10">
            <Badge tone={statusTone(cert.stage)} mono>
              {statusLabel(cert.stage)}
            </Badge>
            <span className="grid size-12 place-items-center rounded-full border border-crimson font-serif text-xl text-crimson">
              {cert.underwriterMark}
            </span>
          </div>

          <SectionLabel>Certificate of Insurance</SectionLabel>

          <h2 className="mt-5 font-serif text-3xl font-semibold text-navy sm:text-4xl">{cert.product}</h2>
          <p className="mt-2 text-sm text-muted">Underwritten by {cert.underwriter}.</p>

          <div className="mt-9 grid gap-x-8 gap-y-7 sm:grid-cols-2">
            <Field label="Policy no." value={cert.policyNo} />
            {cert.naicomId && <Field label="NAICOM ID" value={cert.naicomId} />}
            <Field label="Insured" value={cert.insured} />
            {vehicle ? (
              <Field label="Vehicle" value={vehicle} />
            ) : (
              <Field label="Class of cover" value={cert.category} />
            )}
            <Field label="Sum insured" value={naira(cert.sumInsured)} />
            <Field label="Premium" value={naira(cert.premium)} />
            <Field label="Period of cover" value={cert.period} />
          </div>

          <Divider className="mt-9" />

          <div className="mt-7 flex items-end justify-between gap-6">
            <div>
              <SectionLabel>Issued by</SectionLabel>
              <p className="mt-3 font-serif text-2xl italic text-navy">{cert.underwriter}</p>
              <p className="mt-1 text-sm text-muted">
                {cert.provider === "nem"
                  ? `Issued by NEM's eInsurance platform via McSond Insurance Brokers · ${cert.boundAt}`
                  : `Bound electronically via McSond Insurance Brokers · ${cert.boundAt}`}
              </p>
              {cert.providerRef && (
                <p className="mt-1 font-mono text-xs text-faint">Underwriter ref {cert.providerRef}</p>
              )}
            </div>
            <div className="grid size-16 shrink-0 place-items-center gap-0.5 rounded-[8px] bg-admin text-surface">
              <span className="font-mono text-[0.62rem] tracking-[0.16em]">QR</span>
              <span className="font-mono text-[0.55rem] tracking-[0.16em] text-surface/70">VERIFY</span>
            </div>
          </div>
        </Card>

        {/* ── Receipt + What happens next (1 col) ── */}
        <div className="space-y-6">
          <Card className="p-6">
            <SectionLabel>Receipt</SectionLabel>
            <dl className="mt-5 space-y-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted">Reference</dt>
                <dd className="font-mono text-ink">{cert.receipt.reference}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted">Paid from</dt>
                <dd className="font-medium text-ink">{cert.receipt.paidFrom}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted">Premium · {cert.termMonths} mo</dt>
                <dd className="font-mono tnum text-ink">{naira(cert.premium)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted">Stamp duty</dt>
                <dd className="font-mono tnum text-ink">{naira(cert.stampDuty)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted">VAT</dt>
                <dd className="font-mono tnum text-ink">{naira(cert.vat)}</dd>
              </div>
              <Divider />
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted">Total</dt>
                <dd>
                  <Money value={cert.receipt.total} className="text-lg text-navy" />
                </dd>
              </div>
            </dl>
          </Card>

          {(cert.debitNoteUrl || cert.creditNoteUrl) && (
            <Card className="p-6">
              <SectionLabel>Underwriter documents</SectionLabel>
              <ul className="mt-4 flex flex-col gap-2.5 text-sm">
                {cert.externalCertificateUrl && (
                  <li>
                    <a href={cert.externalCertificateUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-navy hover:underline">
                      <Icon name="file" className="size-4" /> Certificate (PDF)
                    </a>
                  </li>
                )}
                {cert.debitNoteUrl && (
                  <li>
                    <a href={cert.debitNoteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-navy hover:underline">
                      <Icon name="file" className="size-4" /> Debit note (PDF)
                    </a>
                  </li>
                )}
                {cert.creditNoteUrl && (
                  <li>
                    <a href={cert.creditNoteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-navy hover:underline">
                      <Icon name="file" className="size-4" /> Credit note (PDF)
                    </a>
                  </li>
                )}
              </ul>
            </Card>
          )}

          <Card className="p-6">
            <SectionLabel>What happens next</SectionLabel>
            <ol className="mt-5 space-y-4">
              {whatsNext.map((item, i) => (
                <li key={i} className="flex gap-3 text-sm leading-relaxed text-ink-soft">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-navy/5 font-mono text-[0.7rem] font-semibold text-navy">
                    {i + 1}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}
