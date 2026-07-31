import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://engdepthanal-coral.vercel.app";
  return ["", "/courses", "/privacy", "/terms", "/community-guidelines", "/copyright", "/contact"].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date("2026-07-30"),
    changeFrequency: path === "/courses" ? "daily" as const : "monthly" as const,
    priority: path === "" ? 1 : 0.7,
  }));
}
