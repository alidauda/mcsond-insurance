// Liveness probe for the container healthcheck. Deliberately DB-free so a
// database blip doesn't get the container restarted.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" });
}
