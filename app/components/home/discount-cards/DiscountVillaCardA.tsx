"use client";

/* ===============================================================
   🅰️ İNDİRİMLİ VİLLA KARTI — ALTERNATİF A · "Premium Yatay Kart"
   ===============================================================
   Referans: "En Yüksek Puanlı Villalar" yatay kartı, Villa In Kalkan
   diline uyarlanmış hâli.
     - Masaüstü: solda büyük fotoğraf (iç boşluklu), sağda bilgi alanı.
       Fotoğrafın sol üst köşesinde petrol zeminli çapraz indirim şeridi.
     - Bilgi alanı: ad + bölge + kapasite | (varsa gerçek) puan,
       ince çizgi, fiyat bloğu (üstü çizili eski fiyat → belirgin
       indirimli fiyat + gecelik tasarruf + geçerlilik tarihi), ince
       çizgi, alt satırda "Villayı İncele" + birincil CTA.
     - Mobil: dikey yığın (fotoğraf üstte, 16:10).
   Veri/hesap: `useDiscountCardModel` (VillaCard ile AYNI kaynak).
   Puan yalnız gerçek yorum verisi varsa gösterilir — uydurma YOK.
   =============================================================== */

import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Bath,
  BedDouble,
  CalendarRange,
  MapPin,
  Star,
  Users,
} from "lucide-react";

import { formatCurrency } from "@/lib/currency";
import { formatDictionaryString } from "@/lib/i18n/format-dictionary-string";

import {
  useDiscountCardModel,
  type DiscountVillaCardProps,
} from "./useDiscountCardModel";

export default function DiscountVillaCardA(props: DiscountVillaCardProps) {
  const { id, title, location, guests, bedrooms, bathrooms, reviewAverage, reviewCount, price } = props;
  const m = useDiscountCardModel(props);
  const titleId = `dvc-a-${id}`;

  return (
    <article
      aria-labelledby={titleId}
      data-discount-card="a"
      className="
        group relative h-full bg-white
        rounded-[6px] border !border-[#244C45]/[0.12]
        p-1.5
        flex flex-col md:flex-row
        transition-[border-color,box-shadow] duration-300 motion-reduce:transition-none
        hover:!border-[#244C45]/25 hover:shadow-[0_22px_44px_-30px_rgba(8,22,19,0.45)]
      "
    >
      {/* ── FOTOĞRAF ── */}
      <Link
        href={m.detailHref}
        tabIndex={-1}
        aria-hidden="true"
        className="relative block shrink-0 overflow-hidden rounded-[3px] aspect-[16/10] md:aspect-auto md:w-[44%] md:min-h-[292px] bg-[#EEF2EF]"
      >
        {m.showImage ? (
          <Image
            src={m.cover!}
            alt=""
            fill
            sizes="(max-width: 768px) 86vw, 280px"
            loading="lazy"
            onError={m.onImageError}
            className="object-cover object-center transition-transform duration-[900ms] ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center select-none">
            <span className="font-display text-[56px] leading-none text-[#244C45]/25">{m.initial}</span>
            <span className="mt-2 text-[10px] tracking-[0.24em] uppercase font-medium text-[var(--color-stone-400)]">
              {m.dict.card.imageComing}
            </span>
          </span>
        )}

        {/* Çapraz indirim şeridi — yalnız gerçek yüzde hesaplanabildiyse. */}
        {m.discountBadgePercent !== null && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -left-[46px] top-[22px] z-10 w-[170px] -rotate-45 bg-[#244C45] py-[5px] text-center text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#E9D3A0] shadow-[0_6px_14px_-6px_rgba(8,22,19,0.6)]"
          >
            {formatDictionaryString(m.dict.card.discountBadge, {
              percent: m.discountBadgePercent,
            })}
          </span>
        )}
      </Link>

      {/* ── BİLGİ ALANI ── */}
      <div className="flex min-w-0 flex-1 flex-col px-3.5 pt-4 pb-3 md:px-5 md:pt-5 md:pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 id={titleId} className="font-display text-[18px] md:text-[19px] font-semibold leading-tight tracking-[-0.015em] text-[#1F3D38]">
              <Link
                href={m.detailHref}
                className="rounded-[2px] hover:text-[#244C45] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244C45]/40 focus-visible:ring-offset-2"
              >
                <span className="line-clamp-1">{title}</span>
              </Link>
            </h3>
            <p className="mt-1 flex items-center gap-1 text-[13px] text-[var(--color-stone-500)]">
              <MapPin size={13} strokeWidth={1.75} className="shrink-0 text-[#C9A55A]" aria-hidden />
              <span className="truncate">{location || m.dict.card.noLocation}</span>
            </p>
          </div>

          {m.hasRating && (
            <div
              className="shrink-0 text-right"
              aria-label={formatDictionaryString(m.dict.card.ratingAriaLabel, {
                value: reviewAverage!.toFixed(1),
                count: reviewCount!,
              })}
            >
              <div className="flex items-center justify-end gap-1 text-[14px] font-semibold text-[#1F3D38] tabular-nums" aria-hidden>
                <Star size={13} className="fill-[#C9A55A] text-[#C9A55A]" />
                {reviewAverage!.toFixed(1)}
                <span className="font-normal text-[var(--color-stone-400)]">/ 5</span>
              </div>
              <div className="mt-0.5 text-[11.5px] text-[var(--color-stone-500)]" aria-hidden>
                {formatDictionaryString(m.dict.card.reviewCount, { n: reviewCount! })}
              </div>
            </div>
          )}
        </div>

        <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-[var(--color-stone-600)]">
          <li className="inline-flex items-center gap-1.5" aria-label={formatDictionaryString(m.dict.card.guestsAriaLabel, { n: guests })}>
            <Users size={14} strokeWidth={1.75} className="text-[#244C45]/70" aria-hidden />
            <span aria-hidden className="tabular-nums">{formatDictionaryString(m.dict.card.guestsValue, { n: guests })}</span>
          </li>
          <li className="inline-flex items-center gap-1.5" aria-label={formatDictionaryString(m.dict.card.bedroomsAriaLabel, { n: bedrooms })}>
            <BedDouble size={14} strokeWidth={1.75} className="text-[#244C45]/70" aria-hidden />
            <span aria-hidden className="tabular-nums">{formatDictionaryString(m.dict.card.bedroomsValue, { n: bedrooms })}</span>
          </li>
          <li className="inline-flex items-center gap-1.5" aria-label={formatDictionaryString(m.dict.card.bathroomsAriaLabel, { n: bathrooms })}>
            <Bath size={14} strokeWidth={1.75} className="text-[#244C45]/70" aria-hidden />
            <span aria-hidden className="tabular-nums">{formatDictionaryString(m.dict.card.bathroomsValue, { n: bathrooms })}</span>
          </li>
        </ul>

        <div aria-hidden="true" className="mt-4 h-px bg-[#244C45]/10" />

        {/* ── FİYAT ── */}
        <div className="mt-4 flex-1">
          {m.showDiscountPricing ? (
            <>
              <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
                <span className="text-[13.5px] text-[var(--color-stone-400)] line-through decoration-[var(--color-stone-400)]/70 tabular-nums">
                  <span className="sr-only">{m.dict.card.originalPriceLabel}: </span>
                  {formatCurrency(m.convertedPrice, m.currency, m.effectiveLocale)}
                </span>
                <span className="inline-flex items-baseline gap-1.5">
                  <span className="sr-only">{m.dict.card.discountedPriceLabel}: </span>
                  <span className="font-display text-[24px] md:text-[26px] font-bold leading-none tracking-[-0.02em] text-[#244C45] tabular-nums">
                    {formatCurrency(m.discountedPrice!.converted, m.currency, m.effectiveLocale)}
                  </span>
                  <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-stone-500)]">
                    {m.dict.card.nightly}
                  </span>
                </span>
              </div>
              {m.nightlySavingsLabel && (
                <p className="mt-1.5 text-[12.5px] font-semibold text-[#A88438]">
                  {m.nightlySavingsLabel}
                </p>
              )}
              <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-[var(--color-stone-600)]">
                <CalendarRange size={13} strokeWidth={1.75} className="shrink-0 text-[#244C45]/60" aria-hidden />
                {m.discountDateRangeLabel}
              </p>
            </>
          ) : (
            <span className="font-display text-[22px] font-bold leading-none tracking-[-0.02em] text-[#244C45] tabular-nums">
              {price
                ? formatCurrency(m.convertedPrice, m.currency, m.effectiveLocale)
                : m.dict.card.priceOnRequest}
            </span>
          )}
        </div>

        <div aria-hidden="true" className="mt-4 h-px bg-[#244C45]/10" />

        {/* ── AKSİYONLAR ── */}
        <div className="mt-3 flex items-center justify-between gap-3">
          <Link
            href={m.detailHref}
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-[2px] text-[12.5px] font-semibold text-[#244C45] underline decoration-[#C9A55A]/60 decoration-1 underline-offset-[5px] hover:decoration-[#C9A55A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244C45]/40 focus-visible:ring-offset-2"
          >
            {m.dict.card.viewVilla}
          </Link>
          <Link
            href={m.reserveHref}
            className="group/cta inline-flex min-w-0 items-center justify-center gap-2 h-10 whitespace-nowrap rounded-full bg-[#244C45] px-4 text-[12.5px] font-semibold text-white hover:bg-[#1c3c36] transition-colors duration-200 motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A55A] focus-visible:ring-offset-2"
          >
            {m.dict.card.bookNow}
            <ArrowRight size={15} strokeWidth={2} className="text-[#C9A55A] transition-transform duration-200 group-hover/cta:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  );
}
