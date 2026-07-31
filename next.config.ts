import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Attachments are validated at 4 MB. The extra headroom covers multipart
    // metadata while keeping the action request deliberately bounded.
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
