"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { login, signup, type AuthState } from "@/actions/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function AuthForm({ mode, locale }: { mode: "login" | "signup"; locale: string }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "login" ? login : signup, null);

  if (state?.notice) return <p role="status" className="rounded-md border border-success bg-white p-4 text-success">✓ {t("checkEmail")}</p>;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      {mode === "signup" && (
        <label className="block text-sm">{t("fullName")}<Input name="full_name" required autoComplete="name" className="mt-1" /></label>
      )}
      <label className="block text-sm">{t("email")}<Input name="email" type="email" required autoComplete="email" dir="ltr" className="mt-1" /></label>
      <label className="block text-sm">{t("password")}
        <Input name="password" type="password" required minLength={mode === "signup" ? 8 : undefined}
          autoComplete={mode === "login" ? "current-password" : "new-password"} dir="ltr" className="mt-1" />
      </label>
      {state?.error && <p role="alert" className="text-sm text-danger">{t(state.error as "invalid" | "weak" | "failed" | "demo")}</p>}
      <Button type="submit" disabled={pending} className="w-full">{mode === "login" ? t("loginCta") : t("signupCta")}</Button>
    </form>
  );
}
