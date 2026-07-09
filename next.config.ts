import type { NextConfig } from "next";

const generatedCatalogTraceExcludes =
  process.env.ACV_INCLUDE_LOCAL_CATALOG_ARTIFACTS === "1"
    ? []
    : [
        "./data/imports/sports-checklists/raw/**/*",
        "./data/imports/sports-checklists/normalized/**/*",
        "./data/imports/sports-checklists/index/**/*",
        "./data/imports/sports-checklists/logs/**/*"
      ];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingExcludes: generatedCatalogTraceExcludes.length ? { "/*": generatedCatalogTraceExcludes } : undefined
};

export default nextConfig;
