import type { NextConfig } from "next";
import { join } from "path";

const nextConfig: NextConfig = {
  /* config options here */
  outputFileTracingRoot: join(process.cwd(), "bun.lock"),
};

export default nextConfig;
