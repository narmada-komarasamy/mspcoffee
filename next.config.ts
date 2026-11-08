import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  outputFileTracingIncludes: {
    '/api/email/send': ['./public/msp-logo.png', './public/data/phone-bill-reimbursements.csv'],
    '/api/phone-bills/pdf': ['./public/msp-logo.png', './public/data/phone-bill-reimbursements.csv'],
    '/api/user-guides/*': ['./docs/instruction-guides/*.pdf', './docs/instruction-guides/courier-guide-page-*.png', './docs/instruction-guides/fleet-guide-page-*.png'],
  },
};

export default nextConfig;
