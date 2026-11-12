import clsx from "clsx";
import type { ReactNode } from "react";

type Tone = "success" | "warning" | "danger" | "info";
const tones: Record<Tone, string> = {
  success: "text-success bg-success/10", warning: "text-warning bg-warning/15", danger: "text-danger bg-danger/10", info: "text-info bg-info/10",
};
/** Status chip. Always pass an icon or text; never rely on color alone. */
export function Tag({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", tones[tone])}>{children}</span>;
}
