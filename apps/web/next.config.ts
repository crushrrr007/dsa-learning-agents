import type { NextConfig } from "next";

const apiOrigin = (process.env.LAB_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8417").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/lab-api/:group(topics|problems|progress|agents)/:path*", destination: `${apiOrigin}/:group/:path*` },
      { source: "/lab-api/:action(run|test|predict|viva)", destination: `${apiOrigin}/:action` },
    ];
  },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ...(process.env.NODE_ENV === "production"
          ? [{ key: "Strict-Transport-Security", value: "max-age=63072000" }]
          : []),
      ],
    }];
  },
};

export default nextConfig;
