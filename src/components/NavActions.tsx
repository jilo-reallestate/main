"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/client";
import { IS_DEMO } from "@/lib/data";
import { useApp } from "@/components/Providers";
import { btn } from "@/components/ui/Button";

/** Search, saved count and login/account. Client side so public pages stay statically cached. */
export function NavActions() {
  const t = useTranslations("nav"), { saved, setSearchOpen } = useApp();
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    if (IS_DEMO) return;
    const sb = createClient();
    sb.auth.getUser().then(({ data }) => setAuthed(!!data.user));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setAuthed(!!s?.user));
    return () => sub.subscription.unsubscribe();
  }, []);
  const ic = "relative hidden h-10 w-10 place-items-center rounded-full text-lg text-mu hover:bg-surf hover:text-tx md:grid";
  return (
    <>
      <button onClick={() => setSearchOpen(true)} aria-label={t("search")} className={ic}>⌕</button>
      <Link href="/saved" aria-label={t("saved")} className={ic}>♡{saved.size > 0 && <b className="absolute -end-0.5 -top-0.5 min-w-[17px] rounded-full bg-goldgrad text-[10px] leading-[17px] text-[#1a1409]">{saved.size}</b>}</Link>
      <Link href={authed ? "/dashboard" : "/login"} className={btn("primary", true, "whitespace-nowrap")}>{authed ? t("dashboard") : t("login")}</Link>
    </>
  );
}
