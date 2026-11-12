/** PLACEHOLDER wordmark. Replace with the client's official SVG (symbol, horizontal lockup, Arabic lockup) from /public/brand. */
export function Logo({ light = false, short = false }: { light?: boolean; short?: boolean }) {
  return (
    <span className={`whitespace-nowrap ${light ? "text-ivory" : "text-tx"}`} aria-label="JILO Real Estate">
      <span className="text-xl font-extrabold tracking-[.16em]">JILO</span>
      <span className={`ms-2 text-[10px] font-medium tracking-[.28em] text-gold-3 rtl:tracking-normal${short ? " hidden min-[430px]:inline" : ""}`}>REAL ESTATE</span>
    </span>
  );
}
