import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Header } from "@/components/Header";
import { AuthForm } from "@/components/AuthForm";

export default async function SignupPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");
  return (
    <>
      <Header locale={locale} switchHref="/signup" />
      <main className="mx-auto max-w-md px-5 py-14">
        <h1 className="text-3xl font-semibold">{t("signupTitle")}</h1>
        <div className="mb-8 mt-2 h-px w-16 bg-bronze" />
        <AuthForm mode="signup" locale={locale} />
        <p className="mt-6 text-sm">{t("haveAccount")} <Link href="/login" className="underline">{t("loginTitle")}</Link></p>
      </main>
    </>
  );
}
