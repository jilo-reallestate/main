import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Logo } from "@/components/ui/Logo";
import { getCompany } from "@/lib/data";
import { COMPANY } from "@/lib/company";

export async function Footer() {
  const t = await getTranslations(), co = await getCompany();
  const phone = COMPANY.phone || co.phone || t("v2.x.ft.ph"), col = "mb-3 block text-xs font-bold uppercase tracking-[.14em] text-mu rtl:tracking-normal";
  const a = "block py-1 text-[15px] hover:text-ac";
  return (
    <>
    <footer className="wrap mt-16 pb-10">
      <div className="grid gap-8 border-t border-ln pt-14 md:grid-cols-[2fr_1fr_1fr_1fr]">
        <div><Logo /><p className="mt-3 max-w-[30ch] text-mu">{t("footer.tagline")}</p></div>
        <div><b className={col}>{t("v2.x.ft.ex")}</b><Link className={a} href="/properties?purpose=sale">{t("nav.buy")}</Link><Link className={a} href="/properties?purpose=rent">{t("nav.rent")}</Link><Link className={a} href="/projects">{t("nav.offplan")}</Link></div>
        <div><b className={col}>{t("v2.x.ft.co")}</b><Link className={a} href="/about">{t("nav.about")}</Link><span className={a}>{t("v2.x.ft.cr")}</span></div>
        <div><b className={col}>{t("v2.x.ft.ct")}</b><a className={a} dir="ltr" href={`tel:${phone.replace(/[^\d+]/g, "")}`}>{phone}</a><span className={a} dir="ltr">{co.email || t("v2.x.ft.em")}</span></div>
      </div>
      <div className="mt-6 flex flex-wrap justify-between gap-2 text-[13px] text-mu"><span>© {new Date().getFullYear()} JILO Real Estate. {t("footer.rights")}</span><span>AED · USD · GBP</span></div>
    </footer>
    <div className="border-t border-ln bg-surf py-4 pb-28 text-center text-[13px] text-mu md:pb-4">{t.rich("footer.credit", { a: (c) => <a href="https://plulaiconsulting.com" target="_blank" rel="noopener" dir="ltr" className="font-semibold text-tx hover:text-ac">{c}</a> })}</div>
    </>
  );
}
