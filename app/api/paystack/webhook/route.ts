import { isValidWebhookSignature, isPaystackConfigured } from "@/lib/paystack";
import { creditPaystackTopup } from "@/lib/wallet-mutations";

/**
 * Paystack webhook (set the URL in the Paystack dashboard, e.g.
 * https://<your-ngrok-host>/api/paystack/webhook). This is the source of
 * truth for crediting top-ups — it fires even if the customer never returns
 * to the callback page. Verify the HMAC before trusting a byte; respond 200
 * quickly so Paystack doesn't re-deliver.
 */
export async function POST(request: Request) {
  if (!(await isPaystackConfigured())) {
    return new Response("Paystack not configured", { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");
  if (!(await isValidWebhookSignature(rawBody, signature))) {
    return new Response("Invalid signature", { status: 401 });
  }

  let event: {
    event?: string;
    data?: {
      reference?: string;
      amount?: number;
      currency?: string;
      channel?: string;
      gateway_response?: string;
      paid_at?: string;
    };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Malformed payload", { status: 400 });
  }

  // Currency is checked here exactly as the callback path checks it: without
  // it a non-Naira charge would have its minor units credited as Naira.
  if (
    event.event === "charge.success" &&
    event.data?.reference &&
    typeof event.data.amount === "number" &&
    event.data.currency === "NGN"
  ) {
    // Never log the payload: it carries the cardholder's name, email, card bin
    // and last four, and the Paystack authorization code.
    const outcome = await creditPaystackTopup({
      reference: event.data.reference,
      paidKobo: event.data.amount,
      channel: event.data.channel ?? null,
      gatewayResponse: event.data.gateway_response ?? null,
      paidAt: event.data.paid_at ?? null,
    });
    // Unknown references (charges that aren't wallet top-ups) are ignored.
    if (outcome === "recovered") {
      console.warn(`[paystack] webhook recovered a written-off top-up: ${event.data.reference}`);
    }
  }

  return Response.json({ received: true });
}
