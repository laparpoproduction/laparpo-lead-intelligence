import type { NextConfig } from "next";
import { assertProductionServerEnvironment } from "./src/lib/env";

assertProductionServerEnvironment();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
