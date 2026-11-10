import Link from "next/link";
import { ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";

import PageHero from "@/app/components/ui/PageHero";
import { JsonLd, buildBreadcrumb } from "@/app/components/seo/StructuredData";
import SaleVillaCard from "./SaleVillaCard";
import { buildSaleItemListJsonLd } from "./sale-structured-data";
import { listPublicSaleCards } from "@/app/services/sale-listing-public.service";
import { getExchangeRatesMap } from "@/app/services/exchange-rate.service";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { formatDictionaryString } from "@/lib/i18n/format-dictionary-string";
import { localeHref } from "@/lib/i18n/locale-href";
import { computePageWindow } from "@/lib/pagination";
import { PROPERTY_TYPES } from "@/lib/sale-listing.helper";
import {
  SALE_ARCHIVE_PATH,
  SALE_SORTS,
  buildSaleArchiveHref,
  filterSaleCards,
  paginateSaleCards,
  parseSaleArchiveParams,
  sortSaleCards,
  type SaleSort,
} from "@/lib/sale-listing-public.helper";

/* ===============================================================
   🌐 /satilik-villalar (EN) + /tr/satilik-villalar (TR) — ORTAK GÖVDE
   ===============================================================
   Kiralık arşivin tasarım dili (PageHero, sol filtre + sağ grid,
   numaralı sayfalama). Filtreler JS'siz GET formu (bölge, gayrimenkul
   tipi, EUR fiyat aralığı, sıralama) → paylaşılabilir/indekslenebilir
   URL. Veri: yalnız YAYINDAKİ ilanlar (sale-listing-public.service).
   Kiralık arşiv bileşenleri DEĞİŞTİRİLMEDİ.
=============================================================== */

export type SaleArchiveSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SaleVillasArchiveBody({
  locale,
  searchParams,
}: {
  locale: Locale;
  searchParams?: SaleArchiveSearchParams;
}) {
  const dict = getDictionary(locale);
  const t = dict.sale;
  const sp = searchParams ? await searchParams : {};
  const filters = parseSaleArchiveParams(sp);
  const basePath = localeHref(SALE_ARCHIVE_PATH, locale);

  const [allCards, rates] = await Promise.all([
    listPublicSaleCards(),
    getExchangeRatesMap().catch(() => ({ rates: {}, updatedAt: null })),
  ]);
  const ratesToTry = rates.rates as Record<string, number | undefined>;

  const regions = Array.from(
    new Map(
      allCards
        .filter((c) => c.locationId && c.locationName)
        .map((c) => [c.locationId as string, c.locationName as string])
    )
  ).sort((a, b) => a[1].localeCompare(b[1], locale === "tr" ? "tr" : "en"));
  const types = PROPERTY_TYPES.filter((pt) => allCards.some((c) => c.propertyType === pt));

  const filtered = sortSaleCards(filterSaleCards(allCards, filters, ratesToTry), filters.sort, ratesToTry);
  const { items, currentPage, totalPages } = paginateSaleCards(filtered, filters.page);
  const hasFilters =
    !!filters.regionId || !!filters.propertyType || filters.minEur !== null || filters.maxEur !== null;

  const sortLabels: Record<SaleSort, string> = {
    featured: t.sortFeatured,
    "price-asc": t.sortPriceAsc,
    "price-desc": t.sortPriceDesc,
    newest: t.sortNewest,
  };

  const breadcrumbLd = buildBreadcrumb(
    [
      { name: t.breadcrumbHome, url: localeHref("/", locale) },
      { name: t.archiveTitle },
    ],
    locale === DEFAULT_LOCALE ? undefined : locale
  );

  const fieldClass =
    "w-full rounded-xl border border-[var(--color-stone-200)] bg-white px-3.5 py-2.5 text-[13.5px] text-[var(--color-stone-800)] focus:outline-none focus:ring-2 focus:ring-[var(--color-champagne-500)]/40";
  const labelClass =
    "block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-stone-500)] mb-1.5";

  return (
    <>
      <JsonLd data={breadcrumbLd} />
      {items.length > 0 && <JsonLd data={buildSaleItemListJsonLd(items, locale)} />}

      <main data-sale-archive>
        <PageHero
          breadcrumb={[
            { name: t.breadcrumbHome, href: localeHref("/", locale) },
            { name: t.archiveTitle },
          ]}
          eyebrow={t.archiveEyebrow}
          title={t.archiveTitle}
          stat={{ value: filtered.length, label: t.archiveStatLabel }}
        />

        <section className="px-5 md:px-10 lg:px-16 pt-8 md:pt-12 pb-24 md:pb-32">
          <div className="max-w-site mx-auto grid grid-cols-1 md:grid-cols-[260px_1fr] lg:grid-cols-[300px_1fr] gap-x-8 lg:gap-x-12 gap-y-8">
            {/* ─── FİLTRELER (GET formu, JS'siz) ─── */}
            <aside>
              <form
                method="get"
                action={basePath}
                data-sale-filters
                className="md:sticky md:top-28 rounded-2xl border border-[var(--color-stone-100)] bg-white p-5 space-y-5"
              >
                <p className="flex items-center gap-2 font-display text-[17px] font-semibold text-[var(--color-stone-900)]">
                  <SlidersHorizontal size={16} aria-hidden /> {t.filtersTitle}
                </p>
                <div>
                  <label htmlFor="sale-filter-region" className={labelClass}>{t.filterRegion}</label>
                  <select id="sale-filter-region" name="bolge" defaultValue={filters.regionId ?? ""} className={fieldClass}>
                    <option value="">{t.filterRegionAll}</option>
                    {regions.map(([id, name]) => (
                      <option key={id} value={id}>{name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="sale-filter-type" className={labelClass}>{t.filterType}</label>
                  <select id="sale-filter-type" name="tip" defaultValue={filters.propertyType ?? ""} className={fieldClass}>
                    <option value="">{t.filterTypeAll}</option>
                    {types.map((pt) => (
                      <option key={pt} value={pt}>{t.propertyTypes[pt]}</option>
                    ))}
                  </select>
                </div>
                <fieldset>
                  <legend className={labelClass}>{t.filterPrice}</legend>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" name="min" min={0} step={1000} inputMode="numeric" placeholder={t.filterMin} aria-label={`${t.filterPrice} ${t.filterMin}`} defaultValue={filters.minEur ?? ""} className={fieldClass} />
                    <input type="number" name="max" min={0} step={1000} inputMode="numeric" placeholder={t.filterMax} aria-label={`${t.filterPrice} ${t.filterMax}`} defaultValue={filters.maxEur ?? ""} className={fieldClass} />
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-[var(--color-stone-400)]">{t.filterPriceNote}</p>
                </fieldset>
                <div>
                  <label htmlFor="sale-filter-sort" className={labelClass}>{t.sortLabel}</label>
                  <select id="sale-filter-sort" name="sort" defaultValue={filters.sort} className={fieldClass}>
                    {SALE_SORTS.map((s) => (
                      <option key={s} value={s}>{sortLabels[s]}</option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="w-full rounded-xl bg-ink px-4 py-3 text-[13.5px] font-semibold text-white hover:opacity-90">
                  {t.filterApply}
                </button>
                {hasFilters && (
                  <Link href={basePath} className="block text-center text-[12.5px] text-[var(--color-stone-500)] underline underline-offset-4">
                    {t.filterReset}
                  </Link>
                )}
              </form>
            </aside>

            {/* ─── SONUÇLAR ─── */}
            <div>
              <p className="mb-5 text-[13px] text-[var(--color-stone-500)]" data-sale-result-count>
                {formatDictionaryString(t.resultsCount, { n: filtered.length })}
              </p>
              {items.length === 0 ? (
                <div className="rounded-2xl border border-[var(--color-stone-100)] bg-white/60 px-6 py-16 text-center">
                  <h2 className="font-display text-[26px] text-[var(--color-stone-900)] tracking-[-0.02em]">
                    {allCards.length === 0 ? t.emptyNoneTitle : t.emptyTitle}
                  </h2>
                  <p className="mx-auto mt-4 max-w-md text-[13.5px] leading-relaxed text-[var(--color-stone-500)]">
                    {allCards.length === 0 ? t.emptyNoneBody : t.emptyBody}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-7">
                  {items.map((c, i) => (
                    <SaleVillaCard key={c.villaId} card={c} locale={locale} priority={i === 0} />
                  ))}
                </div>
              )}

              {totalPages > 1 && (
                <nav aria-label={t.paginationAria} className="mt-14 flex flex-wrap items-center justify-center gap-1.5 text-[12.5px]">
                  {currentPage > 1 ? (
                    <Link href={buildSaleArchiveHref(basePath, { ...filters, page: currentPage - 1 })} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 font-medium text-[var(--color-stone-600)] hover:bg-[var(--color-sand-50)]">
                      <ChevronLeft size={14} /> {t.paginationPrev}
                    </Link>
                  ) : null}
                  {computePageWindow(currentPage, totalPages).map((p, idx) =>
                    p === "…" ? (
                      <span key={`gap-${idx}`} className="px-2 text-[var(--color-stone-400)]" aria-hidden>…</span>
                    ) : (
                      <Link
                        key={p}
                        href={buildSaleArchiveHref(basePath, { ...filters, page: p })}
                        aria-current={p === currentPage ? "page" : undefined}
                        className={
                          "inline-flex min-w-[32px] items-center justify-center rounded-full px-2.5 py-1.5 font-medium tabular-nums " +
                          (p === currentPage ? "bg-[var(--color-stone-900)] text-white" : "text-[var(--color-stone-600)] hover:bg-[var(--color-sand-50)]")
                        }
                      >
                        {p}
                      </Link>
                    )
                  )}
                  {currentPage < totalPages ? (
                    <Link href={buildSaleArchiveHref(basePath, { ...filters, page: currentPage + 1 })} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 font-medium text-[var(--color-stone-600)] hover:bg-[var(--color-sand-50)]">
                      {t.paginationNext} <ChevronRight size={14} />
                    </Link>
                  ) : null}
                </nav>
              )}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
