// Liveness probe for container orchestrators and load balancers. Deliberately
// exposes nothing about the configuration — /api/config does that.
export const dynamic = "force-dynamic"

export async function GET() {
  return Response.json({ status: "ok" })
}
