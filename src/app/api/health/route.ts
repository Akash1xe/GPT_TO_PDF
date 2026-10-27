/**
 * Operational smoke-test endpoint. It never reads or returns user content.
 * User-submitted conversation APIs are intentionally deferred to later chunks.
 */
export function GET() {
  return Response.json(
    { status: "ok", service: "chat-to-pdf-web", phase: "release-candidate" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
