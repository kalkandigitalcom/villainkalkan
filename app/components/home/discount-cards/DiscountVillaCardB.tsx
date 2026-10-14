"use client";

/* ===============================================================
   🅱️ İNDİRİMLİ VİLLA KARTI — ALTERNATİF B · "Editoryal Lüks Kart"
   ===============================================================
   Fotoğrafın baskın olduğu, dergi sayfası gibi ferah kompozisyon.
     - Masaüstü: kartın ~%58'ini kaplayan büyük fotoğraf + yanında
       fildişi zeminli bilgi sütunu. Çerçeve, gölge ve ikon YOK.
     - İndirim oranı: fotoğrafın sol üst köşesinde küçük beyaz rozet.
     - Bilgi hiyerarşisi: bölge (eyebrow) → büyük villa adı → kapasite
       (ikon yerine yalın metin) → kısa altın çizgi → fiyat bloğu
       (küçük üstü çizili eski fiyat, büyük indirimli fiyat) →
       geçerlilik tarihi → tek, sade metin CTA.
     - Mobil: fotoğraf üstte (4:3), bilgi alanı altta.
   Veri/hesap: `useDiscountCardModel` (VillaCard ile AYNI kaynak).
   =============================================================== */

import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

import { formatCurrency } from "@/lib/currency";
import { formatDictionaryString } from "@/lib/i18n/format-dictionary-string";

import {
  useDiscountCardModel,
  type DiscountVillaCardProps,
} from "./useDiscountCardModel";

export default function DiscountVillaCardB(props: DiscountVillaCardProps) {
  const { id, title, location, guests, bedrooms, bathrooms, price } = props;
  const m = useDiscountCardModel(props);
  const titleId = `dvc-b-${id}`;

  const capacity = [
    formatDictionaryString(m.dict.card.guestsValue, { n: guests }),
    formatDictionaryString(m.dict.card.bedroomsValue, { n: bedrooms }),
    formatDictionaryString(m.dict.card.bathroomsValue, { n: bathrooms }),
  ];

  return (
    <article
      aria-labelledby={titleId}
      data-discount-card="b"
      className="group relative h-full flex flex-col md:flex-row bg-[#FBF9F4]"
    >
      {/* ── FOTOĞRAF ── */}
      <Link
        href={m.detailHref}
        tabIndex={-1}
        aria-hidden="true"
        className="relative block shrink-0 overflow-hidden aspect-[4/3] md:aspect-[5/4] md:w-[58%] bg-[#E7ECE8]"
      >
        {m.showImage ? (
          <Image
            src={m.cover!}
            alt=""
            fill
            sizes="(max-width: 768px) 84vw, 440px"
            loading="lazy"
            onError={m.onImageError}
            className="object-cover object-center transition-transform duration-[1200ms] ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center select-none">
            <span className="font-display text-[64px] leading-none text-ink/25">{m.initial}</span>
            <span className="mt-2 text-[10px] tracking-[0.24em] uppercase font-medium text-[var(--color-stone-400)]">
              {m.dict.card.imageComing}
            </span>
          </span>
        )}

        {m.discountBadgePercent !== null && (
          <span className="absolute left-3 top-3 md:left-4 md:top-4 z-10 inline-flex items-center gap-1.5 bg-white/95 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
            {formatDictionaryString(m.dict.card.discountBadge, {
              percent: m.discountBadgePercent,
            })}
          </span>
        )}
      </Link>

      {/* ── BİLGİ SÜTUNU ── */}
      <div className="flex min-w-0 flex-1 flex-col justify-between px-5 py-5 md:px-8 md:py-8">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-brand-hover truncate">
            {location || m.dict.card.noLocation}
          </p>
          <h3
            id={titleId}
            className="mt-2 font-display text-[22px] md:text-[27px] font-medium leading-[1.12] tracking-[-0.025em] text-ink"
          >
            <Link
              href={m.detailHref}
              className="focus:outline-none focus-visible:underline focus-visible:decoration-accent focus-visible:underline-offset-4"
            >
              <span className="line-clamp-2">{title}</span>
            </Link>
          </h3>
          <p className="mt-2.5 text-[13px] text-[var(--color-stone-600)]">
            {capacity.join(" · ")}
          </p>

          <div aria-hidden="true" className="mt-5 md:mt-6 h-[2px] w-8 bg-accent" />

          <div className="mt-5 md:mt-6">
            {m.showDiscountPricing ? (
              <>
                <p className="text-[13px] text-[var(--color-stone-400)] line-through decoration-[var(--color-stone-400)]/70 tabular-nums">
                  <span className="sr-only">{m.dict.card.originalPriceLabel}: </span>
                  {formatCurrency(m.convertedPrice, m.currency, m.effectiveLocale)}
                </p>
                <p className="mt-1 flex items-baseline gap-2">
                  <span className="sr-only">{m.dict.card.discountedPriceLabel}: </span>
                  <span className="font-display text-[30px] md:text-[34px] font-semibold leading-none tracking-[-0.03em] text-ink tabular-nums">
                    {formatCurrency(m.discountedPrice!.converted, m.currency, m.effectiveLocale)}
                  </span>
                  <span className="text-[12px] text-[var(--color-stone-500)]">
                    / {m.dict.card.nightly.toLocaleLowerCase(m.effectiveLocale)}
                  </span>
                </p>
                {m.nightlySavingsLabel && (
                  <p className="mt-2 text-[12.5px] font-medium text-accent-strong">
                    {m.nightlySavingsLabel}
                  </p>
                )}
                <p className="mt-1 text-[12px] text-[var(--color-stone-500)]">
                  {m.discountDateRangeLabel}
                </p>
              </>
            ) : (
              <p className="font-display text-[28px] font-semibold leading-none tracking-[-0.03em] text-ink tabular-nums">
                {price
                  ? formatCurrency(m.convertedPrice, m.currency, m.effectiveLocale)
                  : m.dict.card.priceOnRequest}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 md:mt-8 border-t !border-ink/10 pt-4">
          <Link
            href={m.reserveHref}
            className="group/cta inline-flex items-center gap-2 text-[13.5px] font-semibold tracking-[0.01em] text-brand hover:text-brand-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-4 focus-visible:ring-offset-[#FBF9F4]"
          >
            {m.dict.card.bookNow}
            <ArrowRight size={16} strokeWidth={1.75} className="text-brand transition-transform duration-200 group-hover/cta:translate-x-1 motion-reduce:transition-none" aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  );
}
