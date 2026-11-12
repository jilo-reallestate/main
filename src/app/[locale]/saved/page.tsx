import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SavedList } from "@/components/SavedList";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params; const t = await getTranslations({ locale, namespace: "v2.x" });
  return { title: t("svT"), robots: { index: false } };
}
export default async function SavedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; setRequestLocale(locale);
  const t = await getTranslations("v2.x");
  return (<><Header locale={locale} switchHref="/saved" /><main className="wrap pb-24 pt-10 md:pb-0"><div className="eyebrow">{t("svT")}</div><h1 className="mt-3 text-[clamp(40px,7vw,84px)]">{t("svT")}</h1><SavedList /></main><Footer /></>);
}
