import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/pricing", "/legal/privacy", "/legal/terms"],
      disallow: ["/dashboard/", "/api/"],
    },
    sitemap: "https://erebus.sh/sitemap.xml",
  };
}
