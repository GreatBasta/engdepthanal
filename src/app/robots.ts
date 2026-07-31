import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin/", "/profile/", "/my-courses/"] },
    sitemap: "https://engdepthanal-coral.vercel.app/sitemap.xml",
  };
}
