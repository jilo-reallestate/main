import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { getSessionProfile } from "@/lib/auth";

/** Sends each person to the right workspace for their role. */
export const dynamic = "force-dynamic";

export default async function Dashboard({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const p = await getSessionProfile();
  if (!p) redirect({ href: "/login", locale });
  redirect({ href: p!.role === "admin" ? "/admin" : p!.role === "agent" ? "/agent" : "/account", locale });
}
