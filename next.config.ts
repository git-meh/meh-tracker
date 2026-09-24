import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse v2 uses pdfjs-dist v5, which has module-level browser globals.
  // Excluding them from Next.js's server bundle ensures they run as native
  // Node modules and don't get inlined in a way that breaks initialisation.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  // React Compiler + the new native Rust port (experimental).
  // ~20–50% faster compiles on large apps vs the Babel version.
  ...(process.env.NODE_ENV === "development"
    ? {
        reactCompiler: true,
        experimental: {
          turbopackRustReactCompiler: true // native compiler; requires reactCompiler: true
          // turbopackMemoryEviction: 'auto', // already default — leave it; only set false to debug
        }
      }
    : {})
};

export default nextConfig;
