/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    const path = require("path");
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
      stream: false,
      url: false,
      zlib: false,
      http: false,
      https: false,
      assert: false,
      os: false,
      path: false,
      buffer: path.join(process.cwd(), "node_modules", "buffer", "index.js"),
      process: path.join(process.cwd(), "node_modules", "process", "browser.js"),
      // Add fallbacks for packages that are not needed in browser
      "@react-native-async-storage/async-storage": false,
      "pino-pretty": false,
    };
    return config;
  },
  async rewrites() {
    // Use backend URL from environment
    const base = process.env.API_BASE;
    
    if (!base) {
      throw new Error("API_BASE environment variable is required. Please set it in your environment variables.");
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log("[Next.js] API_BASE configured:", base);
    }

    return [
      {
        source: "/api/:path*",
        destination: `${base}/api/:path*`,
      },
    ];
  },
  headers: async () => {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "unsafe-none",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
