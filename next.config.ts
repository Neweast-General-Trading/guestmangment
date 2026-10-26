import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
  serverExternalPackages: ["nodemailer", "mssql", "imapflow", "hdb"],
  allowedDevOrigins: [
    "guest.neweast.cloud",
    "20.74.222.101",
    "10.100.15.16",
    "172.1.0.14",
    "127.0.0.1",
    "localhost",
  ],
  async headers() {
    return [
      {
        source: "/api/intranet/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Authorization, Content-Type, X-Intranet-Key" },
          { key: "Access-Control-Max-Age", value: "86400" },
        ],
      },
    ];
  },
};

export default nextConfig;
