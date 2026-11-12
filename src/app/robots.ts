import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/en/admin", "/ar/admin", "/en/agent", "/ar/agent", "/en/account", "/ar/account", "/en/dashboard", "/ar/dashboard", "/en/saved", "/ar/saved", "/en/notifications", "/ar/notifications", "/auth/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
