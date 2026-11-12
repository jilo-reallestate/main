import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Header } from "@/components/Header";
import { AuthForm } from "@/components/AuthForm";

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");
  return (
    <>
      <Header locale={locale} switchHref="/login" />
      <main className="mx-auto max-w-md px-5 py-14">
        <h1 className="text-3xl font-semibold">{t("loginTitle")}</h1>
        <div className="mb-8 mt-2 h-px w-16 bg-bronze" />
        <AuthForm mode="login" locale={locale} />
        <p className="mt-6 text-sm">{t("noAccount")} <Link href="/signup" className="underline">{t("signupTitle")}</Link></p>
      </main>
    </>
  );
}
