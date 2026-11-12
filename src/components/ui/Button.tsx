import clsx from "clsx";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "gold" | "outline" | "ghost" | "secondary" | "bronze";
const v: Record<Variant, string> = {
  primary: "bg-tx text-bg",
  gold: "bg-goldgrad text-[#1a1409]",
  outline: "border-[1.5px] border-ln text-tx hover:bg-surf",
  ghost: "text-tx hover:bg-surf",
  secondary: "border-[1.5px] border-ln text-tx hover:bg-surf", // legacy alias
  bronze: "bg-goldgrad text-[#1a1409]", // legacy alias
};
export const btn = (variant: Variant = "primary", small = false, extra?: string) =>
  clsx("inline-flex items-center justify-center gap-2 rounded-full font-semibold transition duration-200 hover:-translate-y-0.5 hover:shadow-lg active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none",
    small ? "min-h-[38px] px-4 text-[13px]" : "min-h-[46px] px-6 text-[15px]", v[variant], extra);

export function Button({ variant = "primary", small, className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; small?: boolean }) {
  return <button className={btn(variant, small, className)} {...p} />;
}
