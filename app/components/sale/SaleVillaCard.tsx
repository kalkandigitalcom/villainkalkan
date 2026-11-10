import Link from "next/link";
import { Bath, DoorOpen, MapPin, Ruler, Star } from "lucide-react";

import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/config";
import { localeHref } from "@/lib/i18n/locale-href";
import { formatSalePrice } from "@/lib/sale-listing.helper";
import {
  saleDetailPath,
  type SalePublicCard,
} from "@/lib/sale-listing-public.helper";

/* ===============================================================
   🏡 SATILIK VİLLA KARTI — public liste (/satilik-villalar)
   Kiralık VillaCard'ın tasarım dili (beyaz kart, ince kenarlık,
   yuvarlak köşe, Manrope başlık) — satılık gayrimenkule özel içerik:
   satış fiyatı, oda / banyo / m², gayrimenkul tipi, satış durumu.
   Kiralık kart bileşeni DEĞİŞTİRİLMEDİ.
=============================================================== */
export default function SaleVillaCard({
  card,
  locale,
  priority = false,
}: {
  card: SalePublicCard;
  locale: Locale;
  priority?: boolean;
}) {
  const t = getDictionary(locale).sale;
  const href = localeHref(saleDetailPath(card.slug), locale);
  const nf = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-GB", { maximumFractionDigits: 0 });
  const price =
    card.priceOnRequest || card.salePrice === null
      ? t.priceOnRequest
      : formatSalePrice(card.salePrice, card.saleCurrency, locale === "tr" ? "tr" : "en");
  const rooms = card.roomLayout || (card.bedrooms ? String(card.bedrooms) : null);
  const status =
    card.saleStatus === "sold" ? t.statusSold : card.saleStatus === "reserved" ? t.statusReserved : null;

  return (
    <article
      data-sale-card
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--color-stone-200)] bg-white transition-shadow duration-300 hover:shadow-[0_18px_40px_-20px_rgb(27_26_23/0.25)] motion-reduce:transition-none"
    >
      <Link href={href} className="relative block aspect-[16/11] overflow-hidden bg-[var(--color-sand-100)]">
        {card.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.coverImage}
            alt={card.title}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : undefined}
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center font-display text-[56px] text-[var(--color-stone-300)]">
            {card.title.slice(0, 1)}
          </span>
        )}
        <span className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-ink/90 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white">
            {t.propertyTypes[card.propertyType] ?? card.propertyType}
          </span>
          {status && (
            <span className="rounded-full bg-white/95 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[var(--color-stone-800)]">
              {status}
            </span>
          )}
        </span>
        {card.isFeatured && (
          <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-[var(--color-champagne-600)]" aria-hidden>
            <Star size={13} className="fill-current" />
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
        {card.locationName && (
          <p className="flex items-center gap-1.5 text-[11.5px] font-medium uppercase tracking-[0.14em] text-[var(--color-stone-500)]">
            <MapPin size={12} className="text-accent" aria-hidden />
            <span className="truncate">{card.locationName}</span>
          </p>
        )}
        <h3 className="mt-1.5 font-display text-[19px] font-semibold leading-snug tracking-[-0.015em] text-[var(--color-stone-900)]">
          <Link href={href} className="after:absolute after:inset-0 after:content-['']">
            {card.title}
          </Link>
        </h3>

        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-[var(--color-stone-600)]">
          {rooms && (
            <li className="inline-flex items-center gap-1.5">
              <DoorOpen size={14} aria-hidden /> {rooms} <span className="sr-only">{t.factRooms}</span>
            </li>
          )}
          {card.bathrooms ? (
            <li className="inline-flex items-center gap-1.5">
              <Bath size={14} aria-hidden /> {card.bathrooms} {t.factBathrooms.toLowerCase()}
            </li>
          ) : null}
          {card.builtAreaM2 ? (
            <li className="inline-flex items-center gap-1.5">
              <Ruler size={14} aria-hidden /> {nf.format(card.builtAreaM2)} {t.sqm}
            </li>
          ) : null}
        </ul>

        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <p className="font-display text-[21px] font-bold leading-none tracking-[-0.02em] text-[var(--color-stone-900)] tabular-nums" data-sale-card-price>
            {price}
          </p>
          {card.referenceCode && (
            <span className="text-[11px] text-[var(--color-stone-400)]">
              {t.referenceLabel} {card.referenceCode}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
