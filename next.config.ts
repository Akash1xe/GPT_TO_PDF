import type { NextConfig } from "next";

/**
 * Next.js needs inline bootstrapping scripts; a strict nonce-based script CSP
 * is reserved for a future architecture review. Defense-in-depth policies
 * here avoid blocking the local print preview's same-origin window messaging.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Content-Security-Policy", value: "object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/print", headers: [{ key: "Cache-Control", value: "no-store, private, max-age=0" }] },
    ];
  },
};

export default nextConfig;
