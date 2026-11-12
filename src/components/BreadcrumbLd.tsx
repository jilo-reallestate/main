import { getTranslations } from "next-intl/server";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbLd } from "@/lib/seo";

type Crumb = { key?: "crumbProperties" | "crumbProjects"; label?: string; path: string };
/** Invisible breadcrumb markup (Home > section > page) so Google can show the trail in results. */
export async function BreadcrumbLd({ locale, crumbs }: { locale: string; crumbs: Crumb[] }) {
  const t = await getTranslations("seo");
  return <JsonLd data={breadcrumbLd([{ name: t("crumbHome"), path: `/${locale}` }, ...crumbs.map((c) => ({ name: c.label ?? t(c.key!), path: `/${locale}${c.path}` }))])} />;
}
