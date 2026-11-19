import type { NextConfig } from "next";

const production = process.env.NODE_ENV === "production";

// Next.js hydrates with inline scripts, so script-src needs 'unsafe-inline' without nonces. The
// rest is locked to this origin: no third-party scripts, fonts are self-hosted by next/font, and
// the page cannot be framed.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source; Next compiles them with the app.
  transpilePackages: ["@clearloop/db", "@clearloop/business-time"],
  serverExternalPackages: ["pg"],
  poweredByHeader: false,
  async headers() {
    const headers = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    if (production) headers.push({ key: "Content-Security-Policy", value: csp });
    return [{ source: "/(.*)", headers }];
  },
};

export default nextConfig;
