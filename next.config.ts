import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  outputFileTracingIncludes: {
    '/api/user-guides/*': ['./docs/instruction-guides/*.pdf', './docs/instruction-guides/courier-guide-page-*.png', './docs/instruction-guides/fleet-guide-page-*.png'],
  },
};

export default nextConfig;
