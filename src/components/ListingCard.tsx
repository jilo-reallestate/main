import clsx from "clsx";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Art, seedOf } from "@/components/Art";
import { SaveButton, CompareButton } from "@/components/CardActions";
import { Tag } from "@/components/ui/Tag";
import { formatMoney } from "@/lib/money";
import { coverOf, mediaUrl, pick, type ListingRow } from "@/lib/data";
import { formatNumber } from "@/lib/format";

export function ListingCard({ l, locale, big = false, priority = false }: { l: ListingRow; locale: string; big?: boolean; priority?: boolean }) {
  const t = useTranslations();
  const p = l.property, tr = pick(p.property_translations, locale);
  const area = pick(p.area?.area_translations, locale)?.name ?? "", cover = coverOf(p.property_media), title = tr?.title ?? p.reference_code, href = `/properties/${tr?.slug ?? ""}`;
  const price = formatMoney(l.price, l.currency, locale), period = l.purpose === "rent" && l.price_period ? ` ${t(`period.${l.price_period}`)}` : "";
  const offplan = p.completion_status === "off_plan", seed = seedOf(p.id);
  const sqft = p.size_sqft ? `${formatNumber(Math.round(p.size_sqft), locale)} ${t("prop.sqft")}` : "–";
  const ppsf = l.purpose === "sale" && p.size_sqft ? `${l.currency} ${formatNumber(Math.round(l.price / p.size_sqft), locale)}` : "–";
  const bd = p.bedrooms !== null ? t("prop.beds", { n: p.bedrooms }) : "";
  const chip = "absolute start-3.5 rounded-full bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-[#0B0D0E] backdrop-blur-md";
  return (
    <article className={clsx("group relative overflow-hidden rounded-lg bg-surf transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_26px_50px_rgba(0,0,0,.14)]", big && "min-h-[340px] sm:col-span-2 sm:row-span-2")}>
      <Link href={href} className="block h-full">
        <div className={clsx("relative overflow-hidden", big ? "absolute inset-0" : "aspect-[4/3]")}>
          {cover ? <Image src={mediaUrl(cover)} alt={title} fill priority={priority} sizes={big ? "(min-width:640px) 50vw, 100vw" : "(min-width:1024px) 25vw, (min-width:640px) 50vw, 100vw"} className="object-cover transition-transform duration-700 group-hover:scale-105" />
            : <Art seed={seed} h={big ? 420 : 300} className="absolute inset-0 transition-transform duration-700 group-hover:scale-105 [&_svg]:h-full [&_svg]:w-full" />}
          <span className={clsx(chip, "top-3.5")}>{offplan ? t("nav.offplan") : l.purpose === "sale" ? t("search.buy") : t("search.rent")}</span>
          {(l.flags?.isNew || l.flags?.drop) && <span className={clsx(chip, "top-14 !bg-goldgrad")}>{l.flags.drop ? t("v2.x.dr") : t("v2.x.nw")}</span>}
        </div>
        <div className={clsx("p-5", big && "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-7 pt-16 text-white")}>
          <div className={clsx("mb-1.5 flex items-center gap-2 text-[13px]", big ? "text-white/80" : "text-mu")}>{area} <Tag tone="success"><span aria-hidden>✓</span>{t("status.published")}</Tag></div>
          <h3 className={clsx("leading-tight tracking-tight", big ? "text-[clamp(26px,3.4vw,40px)]" : "text-xl")}>{title}</h3>
          <p className="mt-2.5 text-xl font-bold tracking-tight">{price}<small className={clsx("text-[13px] font-medium", big ? "text-white/75" : "text-mu")}>{period}</small></p>
          <p className="mt-3 flex flex-wrap gap-1.5 text-xs font-medium">
            {[t(`types.${p.type}`), bd, sqft].filter(Boolean).map((x, i) => <i key={`${i}-${x}`} className={clsx("rounded-full px-2.5 py-1 not-italic", big ? "bg-white/20" : "bg-bg text-mu")}>{x}</i>)}
          </p>
        </div>
      </Link>
      <div className="absolute end-3 top-3 z-10"><SaveButton id={p.id} /></div>
      <div className="absolute bottom-3 end-3 z-10"><CompareButton item={{ id: p.id, href, title, area, price: price + period, type: t(`types.${p.type}`), beds: bd || "–", baths: p.bathrooms !== null ? t("prop.baths", { n: p.bathrooms }) : "–", size: sqft, ppsf, seed }} /></div>
    </article>
  );
}
