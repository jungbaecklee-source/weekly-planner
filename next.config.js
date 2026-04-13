/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        "web-push": false,
        "net": false,
        "tls": false,
        "fs": false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
