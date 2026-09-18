import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Outgoing email over SMTP (nodemailer) — configured for Zoho ZeptoMail, the
 * transactional service, though any SMTP relay works.
 *
 * ZeptoMail: SMTP_HOST=smtp.zeptomail.com, SMTP_PORT=587, SMTP_USER=emailapikey
 * (literally), SMTP_PASSWORD=the Mail Agent's SMTP token, and EMAIL_FROM an
 * address on a domain verified in ZeptoMail (unverified From domains bounce
 * with a 5xx). Region hosts: smtp.zeptomail.eu / .in / .au / .jp / .ca.
 *
 * For a plain Zoho *mailbox* instead: smtp.zoho.com:465, SMTP_USER=the mailbox
 * address, SMTP_PASSWORD=an app-specific password; From must be that mailbox.
 */
const SMTP_HOST = process.env.SMTP_HOST ?? "smtp.zoho.com";
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 465);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
// Fall back to the login only when it is itself a mailbox address (ZeptoMail's
// login is the literal "emailapikey", so there EMAIL_FROM is mandatory).
const FROM =
  process.env.EMAIL_FROM ?? (SMTP_USER?.includes("@") ? `McSond Insurance <${SMTP_USER}>` : undefined);

/**
 * Email is optional. Without SMTP credentials nothing is sent and the flows that
 * depend on it degrade quietly rather than failing: verification is skipped
 * entirely (it was never required to sign in), invites still create their row,
 * and password resets report that they couldn't be delivered.
 */
export function isEmailConfigured(): boolean {
  return !!(SMTP_USER && SMTP_PASSWORD && FROM);
}

// Warn once per process instead of on every attempt, so dev logs stay readable.
let warnedUnconfigured = false;
function warnOnce() {
  if (warnedUnconfigured) return;
  warnedUnconfigured = true;
  console.warn("[email] SMTP_USER / SMTP_PASSWORD / EMAIL_FROM not set — outgoing email is disabled for this process.");
}

// One pooled connection per process: Zoho rate-limits connection churn.
let transporter: Transporter | null = null;
function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
      pool: true,
      maxConnections: 2,
      connectionTimeout: 15_000,
      socketTimeout: 30_000,
    });
  }
  return transporter;
}

export type SendResult = { ok: boolean; error?: string };

/** Send one message; never throws. Auth flows must not break on email.
 * Every message carries a plain-text part alongside the HTML — HTML-only mail
 * scores worse with spam filters. */
async function deliver(
  label: string,
  message: { to: string; subject: string; html: string; text: string; replyTo?: string },
): Promise<SendResult> {
  if (!isEmailConfigured()) {
    warnOnce();
    return { ok: false, error: "Email not sent: SMTP is not configured (SMTP_USER, SMTP_PASSWORD, EMAIL_FROM)." };
  }
  try {
    await getTransporter().sendMail({ from: FROM, ...message });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[email] ${label} to ${message.to} failed:`, msg);
    return { ok: false, error: msg };
  }
}

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Super Admin",
  operations: "Operations",
  finance: "Finance",
  support: "Support",
  kyc_reviewer: "KYC Reviewer",
};

export async function sendStaffInvite(opts: {
  to: string;
  role: string;
  inviteId: string;
  signInUrl: string;
  invitedByEmail?: string;
}): Promise<SendResult> {
  // If email isn't configured the invite row still exists, so the role assigns
  // on sign-in — deliver() surfaces that in the result instead of failing.
  const roleLabel = ROLE_LABELS[opts.role] ?? opts.role;
  return deliver("staff invite", {
    to: opts.to,
    subject: "You've been invited to the McSond Insurance staff console",
    html: inviteHtml({ roleLabel, signInUrl: opts.signInUrl, invitedByEmail: opts.invitedByEmail }),
    text: [
      `You've been invited${opts.invitedByEmail ? ` by ${opts.invitedByEmail}` : ""} to join the McSond Insurance staff console as ${roleLabel}.`,
      "Sign in with your Google account using this email address to get started. Your role is applied automatically on first sign-in.",
      `Sign in: ${opts.signInUrl}`,
      "If you weren't expecting this invitation, you can safely ignore this email.",
    ].join("\n\n"),
    replyTo: opts.invitedByEmail,
  });
}

/** Absolute URL into the app, for links in email. */
export function appUrl(path: string): string {
  return `${(process.env.BETTER_AUTH_URL ?? "http://localhost:3001").replace(/\/+$/, "")}${path}`;
}

const DEFAULT_FOOTER = "You're receiving this because you have a McSond Insurance account.";

/**
 * Generic one-message notification: heading, a paragraph, one button.
 * Best-effort — returns { ok:false } rather than throwing, so nothing that
 * sends mail (a KYC check, a policy purchase) ever fails because of it.
 */
export async function sendNotificationEmail(opts: {
  to: string;
  subject: string;
  heading: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  footer?: string;
}): Promise<SendResult> {
  const footer = opts.footer ?? DEFAULT_FOOTER;
  return deliver(`"${opts.subject}"`, {
    to: opts.to,
    subject: opts.subject,
    html: authHtml({ ...opts, footer }),
    text: [opts.heading, opts.body, `${opts.ctaLabel}: ${opts.ctaUrl}`, footer].join("\n\n"),
  });
}

/* ───────────────────────── customer notifications ───────────────────────── */

const firstName = (name: string) => name.trim().split(/\s+/)[0] || "there";

const dateLong = (d: Date) =>
  d.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });

export type KycEmailOutcome = "verified" | "review" | "failed" | "approved" | "rejected";

/** Tell the customer how their identity check ended (automatic or reviewed). */
export function sendKycOutcomeEmail(opts: { to: string; name: string; outcome: KycEmailOutcome }): Promise<SendResult> {
  const hi = firstName(opts.name);
  const copy: Record<KycEmailOutcome, { subject: string; heading: string; body: string; ctaLabel: string; path: string }> = {
    verified: {
      subject: "Your identity is verified",
      heading: `You're verified, ${hi}.`,
      body: "Your identity check passed and your McSond Insurance account is fully activated. You can now bind cover straight from your wallet.",
      ctaLabel: "Get a quote",
      path: "/insurance",
    },
    approved: {
      subject: "Your identity is verified",
      heading: `You're verified, ${hi}.`,
      body: "A member of our team has reviewed and approved your identity check. Your account is fully activated and you can now bind cover from your wallet.",
      ctaLabel: "Get a quote",
      path: "/insurance",
    },
    review: {
      subject: "Your identity check is being reviewed",
      heading: `Almost there, ${hi}.`,
      body: "We found your record, but the name on it doesn't match your account closely enough to clear automatically. A reviewer will look at it shortly — usually within one business day — and we'll email you the result.",
      ctaLabel: "View your KYC status",
      path: "/kyc",
    },
    failed: {
      subject: "We couldn't verify your identity",
      heading: `We couldn't verify you, ${hi}.`,
      body: "The name on the record we found doesn't match the name on your account. Check that your account name matches your ID exactly, then run the check again with your own identity details.",
      ctaLabel: "Try again",
      path: "/kyc",
    },
    rejected: {
      subject: "Your identity check was not approved",
      heading: `We couldn't approve your identity check, ${hi}.`,
      body: "Our team reviewed your identity check and couldn't confirm the record belongs to you. Please verify again using your own NIN, phone number or NIMC share code. If you think this is a mistake, reply to this email.",
      ctaLabel: "Verify again",
      path: "/kyc",
    },
  };
  const c = copy[opts.outcome];
  return sendNotificationEmail({ to: opts.to, subject: c.subject, heading: c.heading, body: c.body, ctaLabel: c.ctaLabel, ctaUrl: appUrl(c.path) });
}

const money = (n: number) => `₦${n.toLocaleString("en-NG")}`;
const dateTime = (d: Date) =>
  d.toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

type ReceiptRow = { label: string; value: string; emphasis?: boolean };

/** Itemised receipt: headline amount, a table of rows, one button. */
async function sendReceiptEmail(opts: {
  to: string;
  subject: string;
  heading: string;
  intro: string;
  amountLabel: string;
  amount: number;
  rows: ReceiptRow[];
  ctaLabel: string;
  ctaUrl: string;
  footer?: string;
}): Promise<SendResult> {
  const footer = opts.footer ?? DEFAULT_FOOTER;
  return deliver(`"${opts.subject}"`, {
    to: opts.to,
    subject: opts.subject,
    html: receiptHtml({ ...opts, footer }),
    text: [
      opts.heading,
      opts.intro,
      `${opts.amountLabel}: ${money(opts.amount)}`,
      ...opts.rows.map((r) => `${r.label}: ${r.value}`),
      `${opts.ctaLabel}: ${opts.ctaUrl}`,
      footer,
    ].join("\n"),
  });
}

/** Policy is bound and the certificate is ready — doubles as the purchase receipt. */
export function sendPolicyIssuedEmail(opts: {
  to: string;
  name: string;
  reference: string;
  planName: string;
  underwriter: string;
  policyNo: string | null;
  regNo: string;
  vehicle: string;
  periodStart: Date;
  periodEnd: Date;
  basePremium: number;
  stampDuty: number;
  vat: number;
  total: number;
  balanceAfter: number;
  boundAt: Date;
}): Promise<SendResult> {
  return sendReceiptEmail({
    to: opts.to,
    subject: `Policy receipt — ${opts.planName} · ${opts.reference}`,
    heading: `Your cover is active, ${firstName(opts.name)}.`,
    intro: `${opts.planName} from ${opts.underwriter} is bound for ${opts.regNo}. This is your receipt; your certificate is ready to download.`,
    amountLabel: "Total paid from wallet",
    amount: opts.total,
    rows: [
      { label: "Policy number", value: opts.policyNo ?? "Being issued", emphasis: true },
      { label: "Underwriter", value: opts.underwriter },
      { label: "Vehicle", value: `${opts.vehicle} · ${opts.regNo}` },
      { label: "Cover period", value: `${dateLong(opts.periodStart)} – ${dateLong(opts.periodEnd)}` },
      { label: "Premium", value: money(opts.basePremium) },
      { label: "Stamp duty", value: money(opts.stampDuty) },
      { label: "VAT", value: money(opts.vat) },
      { label: "Total", value: money(opts.total), emphasis: true },
      { label: "Wallet balance after", value: money(opts.balanceAfter) },
      { label: "Order reference", value: opts.reference },
      { label: "Issued", value: dateTime(opts.boundAt) },
    ],
    ctaLabel: "Download certificate",
    ctaUrl: appUrl(`/insurance/certificate/${encodeURIComponent(opts.reference)}`),
  });
}

/** Wallet top-up landed. */
export function sendTopupReceiptEmail(opts: {
  to: string;
  name: string;
  amount: number;
  balanceAfter: number;
  reference: string;
  channel?: string | null;
  paidAt: Date;
}): Promise<SendResult> {
  const channel = opts.channel ? opts.channel.replace(/_/g, " ") : "Paystack";
  return sendReceiptEmail({
    to: opts.to,
    subject: `Top-up receipt — ${money(opts.amount)} · ${opts.reference}`,
    heading: `${money(opts.amount)} added to your wallet, ${firstName(opts.name)}.`,
    intro: "Your top-up has been credited and is ready to spend on cover.",
    amountLabel: "Amount credited",
    amount: opts.amount,
    rows: [
      { label: "New wallet balance", value: money(opts.balanceAfter), emphasis: true },
      { label: "Payment method", value: channel.charAt(0).toUpperCase() + channel.slice(1) },
      { label: "Paystack reference", value: opts.reference },
      { label: "Paid", value: dateTime(opts.paidAt) },
    ],
    ctaLabel: "View wallet",
    ctaUrl: appUrl("/wallet"),
  });
}

function receiptHtml({
  heading,
  intro,
  amountLabel,
  amount,
  rows,
  ctaLabel,
  ctaUrl,
  footer,
}: {
  heading: string;
  intro: string;
  amountLabel: string;
  amount: number;
  rows: ReceiptRow[];
  ctaLabel: string;
  ctaUrl: string;
  footer: string;
}): string {
  const rowHtml = rows
    .map(
      (r) => `
              <tr>
                <td style="padding:10px 0;border-top:1px solid #efece5;font-size:13px;color:#8a877f;vertical-align:top;">${escapeHtml(r.label)}</td>
                <td align="right" style="padding:10px 0 10px 16px;border-top:1px solid #efece5;font-size:14px;color:#1a1917;${r.emphasis ? "font-weight:600;" : ""}vertical-align:top;">${escapeHtml(r.value)}</td>
              </tr>`,
    )
    .join("");
  return `<!doctype html>
<html>
  <body style="margin:0;background:#faf9f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1917;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e7e4dc;border-radius:14px;overflow:hidden;">
          <tr><td style="background:#11213a;padding:24px 28px;">
            <span style="color:#ffffff;font-size:20px;font-weight:600;letter-spacing:-0.01em;">McSond <span style="font-weight:400;">Insurance</span></span>
            <span style="color:#c8102e;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.14em;display:block;margin-top:4px;">Receipt</span>
          </td></tr>
          <tr><td style="padding:28px 28px 8px;">
            <h1 style="margin:0 0 10px;font-size:22px;font-weight:600;color:#11213a;">${escapeHtml(heading)}</h1>
            <p style="margin:0;font-size:15px;line-height:1.6;color:#54514a;">${escapeHtml(intro)}</p>
          </td></tr>
          <tr><td style="padding:20px 28px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f5;border:1px solid #e7e4dc;border-radius:10px;">
              <tr><td style="padding:16px 18px;">
                <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.12em;color:#8a877f;">${escapeHtml(amountLabel)}</p>
                <p style="margin:4px 0 0;font-size:30px;font-weight:600;letter-spacing:-0.02em;color:#11213a;">${escapeHtml(money(amount))}</p>
              </td></tr>
            </table>
          </td></tr>
          <tr><td style="padding:20px 28px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowHtml}
            </table>
          </td></tr>
          <tr><td style="padding:24px 28px 28px;">
            <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#11213a;color:#ffffff;text-decoration:none;font-size:15px;font-weight:500;padding:12px 22px;border-radius:10px;">
              ${escapeHtml(ctaLabel)}
            </a>
            <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#8a877f;">
              ${escapeHtml(footer)} Keep this email for your records.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function authHtml({
  heading,
  body,
  ctaLabel,
  ctaUrl,
  footer,
}: {
  heading: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  footer: string;
}): string {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#faf9f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1917;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e7e4dc;border-radius:14px;overflow:hidden;">
          <tr><td style="background:#11213a;padding:24px 28px;">
            <span style="color:#ffffff;font-size:20px;font-weight:600;letter-spacing:-0.01em;">McSond <span style="font-weight:400;">Insurance</span></span>
          </td></tr>
          <tr><td style="padding:28px;">
            <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;color:#11213a;">${escapeHtml(heading)}</h1>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#54514a;">${escapeHtml(body)}</p>
            <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#11213a;color:#ffffff;text-decoration:none;font-size:15px;font-weight:500;padding:12px 22px;border-radius:10px;">
              ${escapeHtml(ctaLabel)}
            </a>
            <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#8a877f;">
              ${escapeHtml(footer)}
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function inviteHtml({
  roleLabel,
  signInUrl,
  invitedByEmail,
}: {
  roleLabel: string;
  signInUrl: string;
  invitedByEmail?: string;
}): string {
  const inviter = invitedByEmail ? ` by ${escapeHtml(invitedByEmail)}` : "";
  return `<!doctype html>
<html>
  <body style="margin:0;background:#faf9f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1917;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e7e4dc;border-radius:14px;overflow:hidden;">
          <tr><td style="background:#11213a;padding:24px 28px;">
            <span style="color:#ffffff;font-size:20px;font-weight:600;letter-spacing:-0.01em;">McSond <span style="font-weight:400;">Insurance</span></span>
            <span style="color:#c8102e;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.14em;display:block;margin-top:4px;">Staff console</span>
          </td></tr>
          <tr><td style="padding:28px;">
            <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;color:#11213a;">You've been invited</h1>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#54514a;">
              You've been invited${inviter} to join the McSond Insurance staff console as
              <strong style="color:#1a1917;">${escapeHtml(roleLabel)}</strong>.
            </p>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#54514a;">
              Sign in with your Google account using this email address to get started.
              Your role is applied automatically on first sign-in.
            </p>
            <a href="${escapeHtml(signInUrl)}" style="display:inline-block;background:#11213a;color:#ffffff;text-decoration:none;font-size:15px;font-weight:500;padding:12px 22px;border-radius:10px;">
              Sign in to McSond Insurance
            </a>
            <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#8a877f;">
              If you weren't expecting this invitation, you can safely ignore this email.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
