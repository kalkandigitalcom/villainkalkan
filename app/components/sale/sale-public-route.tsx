import "server-only";

import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";

import SaleVillaDetail from "./SaleVillaDetail";
import { buildSaleListingJsonLd } from "./sale-structured-data";
import { JsonLd, buildBreadcrumb } from "@/app/components/seo/StructuredData";
import { loadSaleVillaDetail } from "@/app/services/sale-villa-detail.service";
import { findPublicSaleListingIdsBySlug } from "@/app/services/sale-listing-public.service";
import { getCachedSettings } from "@/lib/cache.helpers";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { formatDictionaryString } from "@/lib/i18n/format-dictionary-string";
import { localeHref } from "@/lib/i18n/locale-href";
import { buildLocaleAlternates } from "@/lib/i18n/seo-alternates";
import { SITE_NAME_FALLBACK } from "@/lib/site-name-fallback";
import {
  SALE_ARCHIVE_PATH,
  saleDetailPath,
} from "@/lib/sale-listing-public.helper";

/* ===============================================================
   🌐 SATILIK — PUBLIC ROTA MANTIĞI (EN kök + TR /tr)
   ===============================================================
   Kiralık `villa-detail-route.tsx` deseni: EN ve TR sayfa dosyaları
   AYNI modülü `locale` ile çağırır (kopya mantık YOK).
   GÖRÜNÜRLÜK: slug → (1) satılık + aktif + silinmemiş villanın ilanı,
   yoksa (2) bağımsız gayrimenkul ilanı (108). İlan yükleyici
   `mode: "public"` → yayında olmayan ilan null → 404.
   Admin önizlemesi (önizleme modu) bu modülü KULLANMAZ.
=============================================================== */

const loadPublicBySlug = cache(async (slug: string, locale: Locale) => {
  for (const listingId of await findPublicSaleListingIdsBySlug(slug)) {
    const data = await loadSaleVillaDetail(listingId, { locale, mode: "public" });
    if (data) return data;
  }
  return null;
});

function siteUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");
  return base ? `${base}${path}` : path;
}

function plainText(s: string | null | undefined, max = 160): string | null {
  const t = (s || "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/* ---------------- LİSTE ---------------- */

export async function buildSaleArchiveMetadata(locale: Locale): Promise<Metadata> {
  const t = getDictionary(locale).sale;
  const settings = await getCachedSettings().catch(() => null);
  const brand = settings?.site_name?.trim() || SITE_NAME_FALLBACK;
  const title = formatDictionaryString(t.archiveMetaTitle, { brand });
  const description = t.archiveMetaDescription;
  const { canonical, languages } = buildLocaleAlternates(SALE_ARCHIVE_PATH, locale);
  return {
    title,
    description,
    alternates: { canonical, languages },
    openGraph: { title, description, type: "website", url: siteUrl(canonical) },
    twitter: { card: "summary_large_image", title, description },
  };
}

/* ---------------- DETAY ---------------- */

export async function buildSaleDetailMetadata(slug: string, locale: Locale): Promise<Metadata> {
  const t = getDictionary(locale).sale;
  const data = await loadPublicBySlug(slug, locale);
  if (!data) {
    return { title: t.notFoundTitle, robots: { index: false, follow: false } };
  }
  const typeLabel = (t.propertyTypes[data.listing.propertyType] ?? "").toLowerCase();
  const fallbackTitle = data.locationName
    ? formatDictionaryString(t.detailMetaTitleFallback, { title: data.title, type: typeLabel, location: data.locationName })
    : formatDictionaryString(t.detailMetaTitleFallbackNoLocation, { title: data.title, type: typeLabel });
  const title = data.seo.title || fallbackTitle;
  const description =
    data.seo.description || plainText(data.listing.description) || t.archiveMetaDescription;
  const { canonical, languages } = buildLocaleAlternates(saleDetailPath(data.slug || slug), locale);
  const cover = data.imageUrls[0];
  return {
    title,
    description,
    robots: { index: true, follow: true },
    alternates: { canonical, languages },
    openGraph: {
      title,
      description,
      type: "website",
      url: siteUrl(canonical),
      ...(cover ? { images: [{ url: cover }] } : {}),
    },
    twitter: {
      card: cover ? "summary_large_image" : "summary",
      title,
      description,
      ...(cover ? { images: [cover] } : {}),
    },
  };
}

export async function renderSaleDetailPage({ slug, locale }: { slug: string; locale: Locale }) {
  const t = getDictionary(locale).sale;
  const data = await loadPublicBySlug(slug, locale);
  /* Yayında olmayan / bulunamayan ilan → gerçek 404 (HTTP 404 +
     app/not-found.tsx). Taslak ilanın varlığı public'e sızdırılmaz. */
  if (!data) notFound();

  const breadcrumbLd = buildBreadcrumb(
    [
      { name: t.breadcrumbHome, url: localeHref("/", locale) },
      { name: t.archiveTitle, url: localeHref(SALE_ARCHIVE_PATH, locale) },
      { name: data.title },
    ],
    locale === DEFAULT_LOCALE ? undefined : locale
  );
  const listingLd = buildSaleListingJsonLd(
    data,
    locale,
    data.seo.description || plainText(data.listing.description, 500)
  );

  return (
    <>
      <JsonLd data={listingLd} />
      <JsonLd data={breadcrumbLd} />
      <SaleVillaDetail data={data} locale={locale} />
    </>
  );
}
