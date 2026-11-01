import Link from "next/link";
import { CalendarRange, ArrowUpRight, Sparkles } from "lucide-react";

import { shortGapsRepository } from "@/lib/db/short-gaps.repository";
import HorizontalCarousel from "../villa/HorizontalCarousel";
import {
  SHORT_GAP_NIGHTS,
  bucketMonthLabel,
  bucketMonthToSlug,
} from "@/lib/short-gaps.helpers";
/* 🛡️ PHASE 11 — ay adları artık hardcoded TR dizisinden DEĞİL,
   dictionary'den (`home.months`) geliyor. TR değerleri
   `lib/short-gaps.helpers.ts > MONTH_NAMES_TR` ile BİREBİR aynı →
   TR etiketleri ("Ocak 2026") DEĞİŞMEZ. Link yapısı (ASCII ay slug'ı)
   DİL BAĞIMSIZ kalır — `bucketMonthToSlug` DEĞİŞMEDİ. */
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
/* 🛡️ NAVIGATION LOCALE PERSISTENCE — iç link aktif locale'i taşır
   (bkz. lib/i18n/locale-href.ts). */
import { localeHref } from "@/lib/i18n/locale-href";
import { formatDictionaryString } from "@/lib/i18n/format-dictionary-string";
import type { MonthNumber } from "@/lib/i18n/dictionaries/types";
import HomeSectionHeading from "@/app/components/home/HomeSectionHeading";

/* ===============================================================
   🛡️ KISA SÜRELİ TARİHLER — ANA SAYFA SECTION (server component)
   ===============================================================
   Mevcut homepage section paterni (CategoryCollection/LocationCollection):
     - Server-only render, kendi verisini çeker (get_short_gap_counts RPC).
     - Veri yoksa null döner → layout sessizce gizlenir (CLS yok).
     - Hiçbir mevcut sistemi etkilemez; salt-okuma.

   SAYI = DISTINCT villa sayısı (RPC count(DISTINCT villa_id)).
   minimum_stay_nights KULLANILMAZ.
   =============================================================== */

type GapCountRow = {
  bucket_month: string;
  gap_nights: number;
  villa_count: number;
};

type MonthGroup = {
  bucketMonth: string;
  label: string;
  slug: string;
  counts: Map<number, number>; // gap_nights → villa_count
};

export default async function ShortGapsSection({
  locale = DEFAULT_LOCALE,
}: {
  locale?: Locale;
} = {}) {
  const dict = getDictionary(locale).home.shortGaps;
  const carouselDict = getDictionary(locale).home.carousel;
  const months_ = getDictionary(locale).home.months;
  const monthName = (m: number) => months_[m as MonthNumber] ?? "";
  const { data, error } = await shortGapsRepository.getShortGapCounts();
  if (error || !Array.isArray(data) || data.length === 0) return null;

  /* Ay bazında grupla (RPC zaten bucket_month, gap_nights sıralı döner). */
  const byMonth = new Map<string, MonthGroup>();
  for (const row of data as GapCountRow[]) {
    const bm = String(row.bucket_month);
    const nights = Number(row.gap_nights);
    const count = Number(row.villa_count);
    if (!bm || count <= 0) continue;

    let group = byMonth.get(bm);
    if (!group) {
      group = {
        bucketMonth: bm,
        label: bucketMonthLabel(bm, monthName),
        slug: bucketMonthToSlug(bm),
        counts: new Map(),
      };
      byMonth.set(bm, group);
    }
    group.counts.set(nights, count);
  }

  const months = Array.from(byMonth.values()).filter(
    (m) => m.label && m.slug && m.counts.size > 0
  );
  if (months.length === 0) return null;

  return (
    <section
      id="kisa-sureli-firsatlar"
      className="scroll-mt-24 md:scroll-mt-28 px-5 md:px-10 lg:px-16 pt-14 md:pt-20 pb-14 md:pb-20"
    >
      <div className="max-w-site mx-auto">
        <HomeSectionHeading title={dict.title} subtitle={dict.subtitle} />

        <HorizontalCarousel
          showArrows
          ariaLabel={dict.carouselAriaLabel}
          prevLabel={carouselDict.previous}
          nextLabel={carouselDict.next}
          className="pb-1"
        >
          <ul role="list" className="flex flex-nowrap min-w-max gap-5 md:gap-6">
            {months.map((m) => (
              <li
                key={m.bucketMonth}
                className="snap-start shrink-0 w-[80vw] max-w-[300px] sm:w-[320px] md:w-[300px] lg:w-[320px]"
              >
                <div
                  className={
                    /* 2026-11 — ortak public kart sistemi (beyaz, ince
                       kenarlık, gölgesiz; koyu gradient zemin kaldırıldı). */
                    "pub-card pub-card-hover pub-card-pad-sm group relative overflow-hidden h-full flex flex-col"
                  }
                >
                  {/* ── HEADER — büyük editorial ay tipografisi + fırsat rozeti ── */}
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div className="min-w-0">
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-strong">
                        <Sparkles size={11} strokeWidth={2.2} aria-hidden />
                        {dict.badge}
                      </span>
                      <h3 className="pub-card-title mt-1.5 text-[18px] md:text-[19px] truncate">
                        {m.label}
                      </h3>
                    </div>
                    <span className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--color-stone-50)] text-ink">
                      <CalendarRange className="w-[18px] h-[18px]" />
                    </span>
                  </div>

                  {/* Brand accent underline — turuncu→mavi, ince */}
                  <div
                    aria-hidden="true"
                    className="mt-3 mb-3 h-[2px] w-10 rounded-full bg-brand"
                  />

                  {/* ── GECE LİSTESİ — mevcut veri/link/sayı BİREBİR aynı ── */}
                  <ul className="flex flex-col gap-1 flex-1">
                    {SHORT_GAP_NIGHTS.map((nights) => {
                      const count = m.counts.get(nights) ?? 0;
                      if (count <= 0) return null;
                      return (
                        <li key={nights}>
                          <Link
                            href={localeHref(`/kisa-sureli-tarihler/${m.slug}/${nights}`, locale)}
                            className="group/row flex items-center justify-between rounded-lg px-3 py-2.5 -mx-1 hover:bg-[var(--color-stone-50)] transition-colors motion-reduce:transition-none"
                          >
                            <span className="text-[13px] text-[var(--color-stone-600)] group-hover/row:text-ink transition-colors motion-reduce:transition-none">
                              {formatDictionaryString(dict.nightsLabel, {
                                n: nights,
                              })}
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold tabular-nums">
                              <span className="px-2 py-0.5 rounded-full bg-brand-soft text-brand-strong leading-none">
                                {count}
                              </span>
                              <ArrowUpRight className="w-3.5 h-3.5 text-[var(--color-stone-400)] group-hover/row:text-brand group-hover/row:translate-x-0.5 transition-[color,transform] motion-reduce:transition-none" />
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </li>
            ))}
          </ul>
        </HorizontalCarousel>
      </div>
    </section>
  );
}
