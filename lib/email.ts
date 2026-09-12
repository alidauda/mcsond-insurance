import "server-only";
import { Resend } from "resend";

/**
 * Resend email helpers.
 *
 * Requires RESEND_API_KEY (https://resend.com/api-keys) and a verified domain
 * in EMAIL_FROM (https://resend.com/domains). The default `from` is Resend's
 * test address, which only delivers to your own account — set EMAIL_FROM to a
 * verified-domain sender for real invites.
 */
const FROM = process.env.EMAIL_FROM ?? "McSond <onboarding@resend.dev>";

/**
 * Email is optional. Without RESEND_API_KEY nothing is sent and the flows that
 * depend on it degrade quietly rather than failing: verification is skipped
 * entirely (it was never required to sign in), invites still create their row,
 * and password resets report that they couldn't be delivered.
 */
export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

// Warn once per process instead of on every attempt, so dev logs stay readable.
let warnedUnconfigured = false;
function warnOnce() {
  if (warnedUnconfigured) return;
  warnedUnconfigured = true;
  console.warn("[email] RESEND_API_KEY not set — outgoing email is disabled for this process.");
}

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Super Admin",
  operations: "Operations",
  finance: "Finance",
  support: "Support",
  kyc_reviewer: "KYC Reviewer",
};

export type SendResult = { ok: boolean; error?: string };

export async function sendStaffInvite(opts: {
  to: string;
  role: string;
  inviteId: string;
  signInUrl: string;
  invitedByEmail?: string;
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Don't fail the invite if email isn't configured yet — the invite row is
    // still created, so the role assigns on sign-in. Surface it in the result.
    warnOnce();
    return { ok: false, error: "Email not sent: RESEND_API_KEY is not configured." };
  }

  const resend = new Resend(apiKey);
  const roleLabel = ROLE_LABELS[opts.role] ?? opts.role;

  const { error } = await resend.emails.send(
    {
      from: FROM,
      to: [opts.to],
      subject: "You've been invited to the McSond staff console",
      html: inviteHtml({ roleLabel, signInUrl: opts.signInUrl, invitedByEmail: opts.invitedByEmail }),
      replyTo: opts.invitedByEmail,
      tags: [{ name: "category", value: "staff_invite" }],
    },
    // Idempotency key is the second arg in the Resend SDK — prevents duplicate
    // sends on retry (expires after 24h).
    { idempotencyKey: `staff-invite/${opts.inviteId}` },
  );

  if (error) {
    console.error("[email] staff invite failed:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Generic transactional auth email (verification, password reset). Best-effort:
 * returns { ok:false } rather than throwing so auth flows never break on email.
 */
export async function sendAuthEmail(opts: {
  to: string;
  subject: string;
  heading: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    warnOnce();
    return { ok: false, error: "RESEND_API_KEY is not configured." };
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: FROM,
    to: [opts.to],
    subject: opts.subject,
    html: authHtml(opts),
    tags: [{ name: "category", value: "auth" }],
  });

  if (error) {
    console.error(`[email] "${opts.subject}" to ${opts.to} failed:`, error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

function authHtml({
  heading,
  body,
  ctaLabel,
  ctaUrl,
}: {
  heading: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
}): string {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#faf9f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1917;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e7e4dc;border-radius:14px;overflow:hidden;">
          <tr><td style="background:#11213a;padding:24px 28px;">
            <span style="color:#ffffff;font-size:20px;font-weight:600;letter-spacing:-0.01em;">McSond</span>
          </td></tr>
          <tr><td style="padding:28px;">
            <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;color:#11213a;">${escapeHtml(heading)}</h1>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#54514a;">${escapeHtml(body)}</p>
            <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#11213a;color:#ffffff;text-decoration:none;font-size:15px;font-weight:500;padding:12px 22px;border-radius:10px;">
              ${escapeHtml(ctaLabel)}
            </a>
            <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#8a877f;">
              If you didn't request this, you can safely ignore this email.
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
            <span style="color:#ffffff;font-size:20px;font-weight:600;letter-spacing:-0.01em;">McSond</span>
            <span style="color:#c8102e;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.14em;display:block;margin-top:4px;">Staff console</span>
          </td></tr>
          <tr><td style="padding:28px;">
            <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;color:#11213a;">You've been invited</h1>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#54514a;">
              You've been invited${inviter} to join the McSond staff console as
              <strong style="color:#1a1917;">${escapeHtml(roleLabel)}</strong>.
            </p>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#54514a;">
              Sign in with your Google account using this email address to get started.
              Your role is applied automatically on first sign-in.
            </p>
            <a href="${escapeHtml(signInUrl)}" style="display:inline-block;background:#11213a;color:#ffffff;text-decoration:none;font-size:15px;font-weight:500;padding:12px 22px;border-radius:10px;">
              Sign in to McSond
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
