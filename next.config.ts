import type { NextConfig } from "next";
import { assertProductionServerEnvironment } from "./src/lib/env";

assertProductionServerEnvironment();

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
