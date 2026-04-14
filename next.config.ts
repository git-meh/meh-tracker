import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse v2 uses pdfjs-dist v5, which has module-level browser globals.
  // Excluding them from Next.js's server bundle ensures they run as native
  // Node modules and don't get inlined in a way that breaks initialisation.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
