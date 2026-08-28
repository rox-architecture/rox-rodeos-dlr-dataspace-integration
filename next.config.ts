import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Self-contained server bundle in .next/standalone, used by the Dockerfile.
   * Harmless for `npm run start`, which ignores it.
   */
  output: "standalone",

  /**
   * lib/settings.ts reads its config file at runtime, and the build's file
   * tracer cannot resolve that path statically — without these excludes it
   * conservatively copies the whole project directory into the bundle.
   * None of the following is needed to serve a request.
   */
  outputFileTracingExcludes: {
    "/*": [
      "./RODEOS-main/**/*",
      "./design/**/*",
      "./data/**/*",
      "./.next/cache/**/*",
      "./node_modules/typescript/**/*",
      "./node_modules/@types/**/*",
      "./node_modules/eslint/**/*",
      "./node_modules/eslint-config-next/**/*",
      "./node_modules/.cache/**/*",
    ],
  },
};

export default nextConfig;
