import clsx from "clsx";
import type { InputHTMLAttributes } from "react";

export const fieldCls = "min-h-[46px] w-full rounded-2xl border-0 bg-surf px-4 text-[15px] text-tx placeholder:text-mu focus-visible:outline-gold-3";
export function Input({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx(fieldCls, className)} {...p} />;
}
