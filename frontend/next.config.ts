import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  allowedDevOrigins: ["joyspin.wirayd.my.id", "*.wirayd.my.id"],
};

export default nextConfig;
