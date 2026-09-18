// Sends one test message through the configured SMTP mailbox, so the Zoho
// credentials can be checked without going through a sign-up or invite.
//
// Usage: npm run email:test -- someone@example.com
// Reads SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD / EMAIL_FROM from .env
// (same variables as lib/email.ts).
import nodemailer from "nodemailer";

const to = process.argv[2];
if (!to) {
  console.error("Usage: npm run email:test -- <recipient@example.com>");
  process.exit(1);
}
const { SMTP_HOST = "smtp.zeptomail.com", SMTP_PORT = "587", SMTP_USER, SMTP_PASSWORD, EMAIL_FROM } = process.env;
if (!SMTP_USER || !SMTP_PASSWORD || !EMAIL_FROM) {
  console.error("SMTP_USER, SMTP_PASSWORD and EMAIL_FROM must be set in .env");
  process.exit(1);
}

const port = Number(SMTP_PORT);
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port,
  secure: port === 465,
  auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
});

console.log(`Connecting to ${SMTP_HOST}:${port} as ${SMTP_USER}…`);
await transporter.verify();
console.log("SMTP login OK.");

const info = await transporter.sendMail({
  from: EMAIL_FROM,
  to,
  subject: "McSond Insurance — SMTP test",
  text: `This is a test message from the McSond Insurance portal, sent at ${new Date().toISOString()}.`,
});
console.log(`Sent. Server response: ${info.response}`);
transporter.close();
