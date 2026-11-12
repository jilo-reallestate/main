import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Logo } from "@/components/ui/Logo";
import { NavActions } from "@/components/NavActions";
import { ThemeToggle } from "@/components/ThemeToggle";

/** Floating glass navigation. switchHref = the same page in the OTHER language (slugs differ per language, so the page supplies it). */
export async function Header({ locale, switchHref = "/" }: { locale: string; switchHref?: string }) {
  const t = await getTranslations("nav");
  const other = locale === "ar" ? "en" : "ar";
  const a = "hidden rounded-full px-3.5 py-2 text-sm font-medium text-mu hover:bg-surf hover:text-tx lg:block";
  return (
    <header className="sticky top-3 z-40 mx-3 mt-3 sm:mx-6">
      <nav className="glass flex items-center justify-between gap-3 rounded-full py-2 pe-2 ps-6 shadow-[0_8px_30px_rgba(0,0,0,.06)]">
        <Link href="/" className="shrink-0"><Logo short /></Link>
        <div className="flex shrink-0 items-center gap-1">
          <Link href="/properties?purpose=sale" className={a}>{t("buy")}</Link>
          <Link href="/properties?purpose=rent" className={a}>{t("rent")}</Link>
          <Link href="/projects" className={a}>{t("offplan")}</Link>
          <Link href="/about" className={a}>{t("about")}</Link>
          <Link href={switchHref} locale={other} lang={other} className="rounded-full px-3 py-2 text-sm font-medium text-mu hover:bg-surf hover:text-tx">{t("switch")}</Link>
          <ThemeToggle />
          <NavActions />
        </div>
      </nav>
    </header>
  );
}
