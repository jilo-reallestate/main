"use client";
/** A select that submits its form as soon as the value changes (no extra button). */
export function AutoSubmitSelect({ name, defaultValue, children, className }: { name: string; defaultValue?: string; children: React.ReactNode; className?: string }) {
  return <select name={name} defaultValue={defaultValue} onChange={(e) => e.currentTarget.form?.requestSubmit()} className={className}>{children}</select>;
}
