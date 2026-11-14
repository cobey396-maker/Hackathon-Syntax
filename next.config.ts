import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false, // the dev badge sat on top of the sidebar Reset button
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
