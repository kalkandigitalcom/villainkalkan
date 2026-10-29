import type { Metadata } from "next";
import { cache } from "react";

import { getVillaBySlug } from "@/app/services/villa.service";
import {
  getVillaTranslatedDescription,
  getVillaTranslatedSeoDescription,
  getVillaTranslatedSeoTitle,
} from "@/lib/i18n/get-villa-translation.server";
import {
  getTranslationsForParents,
  resolveTranslatedField,
} from "@/lib/i18n/get-translation.server";
import {
  getCachedSettings,
  getCachedVillaReviews,
  getCachedVillaReviewStats,
} from "@/lib/cache.helpers";
import type { Locale } from "@/lib/i18n/config";
import { buildLocaleAlternates } from "@/lib/i18n/seo-alternates";
import { localeHref } from "@/lib/i18n/locale-href";
import { stripHtml } from "@/lib/html-sanitize";
import { getVillaDistances } from "@/app/services/villa-distance.service";
import {
  getVillaFeaturesByVilla,
  type Feature,
} from "@/app/services/villa-feature.service";
import { getRuleItemsByVilla } from "@/app/services/rule-item.service";
import { getPriceIncludeItemsByVilla } from "@/app/services/price-include-item.service";
import { getDistanceIconKey } from "@/lib/distance.helper";
import { getTranslatedDistanceLabel } from "@/lib/distance-label.helper";
import type { TranslatedDistance } from "@/app/components/villa/VillaDistancesSection";
import type { TranslatedFeature } from "@/app/components/villa/VillaFeaturesSection";
import type {
  TranslatedPriceInclude,
  TranslatedRule,
} from "@/app/components/villa/VillaPriceIncludesAndRulesSection";
import VillaDetailBody from "@/app/components/villa/VillaDetailBody";
import { getVillaImages } from "@/app/services/villa-image/villa-image.read";
import { getVillaPrices } from "@/app/services/villa-price.service";
import { getVillaDiscounts } from "@/app/services/villa-discount.service";
import {
  resolveVillaImageUrl,
  resolveAssetUrlVersioned,
} from "@/lib/storage.helpers";
import {
  fetchExternalCalendarStringsForVilla,
  EMPTY_EXTERNAL_STRING_ARRAYS,
} from "@/lib/external-calendar.public.helper";
import {
  normalizeYouTubeVideos,
  type VillaYouTubeVideo,
} from "@/lib/youtube.helper";
import {
  buildBreadcrumb,
  buildVacationRental,
} from "@/app/components/seo/StructuredData";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isValidYmd } from "@/lib/availability.helper";

/* ===============================================================
   🛡️ VİLLA DETAY ROTASI — EN (`/kiralik-villa/[slug]`) + TR
   (`/tr/kiralik-villa/[slug]`) ORTAK SUNUCU MANTIĞI
   ===============================================================
   İçerik modeli: DB canonical kolonları İngilizce ANA içeriktir;
   Türkçe `villa_translations` / `*_translations` satırlarından gelir.
   Her iki dil de AYNI çeviri katmanını kullanır (`locale` parametresi):
     • EN (DEFAULT_LOCALE) → canonical değerler, ek sorgu YOK.
     • TR → çeviri satırı; boş alan canonical (İngilizce) değere düşer.
   Villa ADI ve bölge adı özel isimdir — çevrilmez.
   Mesafe başlıkları `villa_distances` canonical (Türkçe anahtar kelime)
   verisidir; görünen ad statik `distanceLabels` sözlüğünden çözülür,
   ikon anahtarı her zaman orijinal başlıktan hesaplanır.
   =============================================================== */

/* generateMetadata + page aynı request içinde aynı villayı çağırır;
   React cache() ile TEK DB sorgusu paylaşılır. */
const getVillaBySlugCached = cache((slug: string) => getVillaBySlug(slug));

/* Mevcut anchor kimlikleri korunur (MobileBookingCta / private villa ile aynı). */
const BOOKING_SIDEBAR_ID: Record<Locale, string> = {
  tr: "booking-sidebar",
  en: "booking-sidebar-en",
};

export async function buildVillaDetailMetadata(
  slug: string,
  locale: Locale
): Promise<Metadata> {
  const villa = await getVillaBySlugCached(slug);
  if (!villa) {
    return {
      title: getDictionary(locale).villa.notFoundTitle,
      robots: { index: false, follow: false },
    };
  }

  const translatedSeoTitle = await getVillaTranslatedSeoTitle(
    villa.id,
    villa.seo_title,
    locale
  );
  const title =
    (translatedSeoTitle && translatedSeoTitle.trim()) || villa.title || "Villa";
  const description = await getVillaTranslatedSeoDescription(
    villa.id,
    villa.seo_description,
    villa.description,
    locale
  );

  const { canonical, languages } = buildLocaleAlternates(
    `/kiralik-villa/${villa.slug || slug}`,
    locale
  );
  const cover =
    villa.images && villa.images.length > 0 ? villa.images[0] : undefined;

  return {
    title,
    description,
    robots: villa.noindex
      ? { index: false, follow: false }
      : { index: true, follow: true },
    alternates: { canonical, languages },
    openGraph: {
      title,
      description,
      type: "website",
      url: canonical,
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

export type VillaDetailSearchParams = Promise<{
  start?: string | string[];
  end?: string | string[];
}>;

export async function renderVillaDetailPage({
  slug,
  searchParams,
  locale,
}: {
  slug: string;
  searchParams?: VillaDetailSearchParams;
  locale: Locale;
}) {
  const dict = getDictionary(locale);

  /* Rezervasyon geçişinde URL ile taşınan giriş/çıkış tarihleri. */
  const sp = searchParams ? await searchParams : {};
  const rawStart = Array.isArray(sp?.start) ? sp.start[0] : sp?.start;
  const rawEnd = Array.isArray(sp?.end) ? sp.end[0] : sp?.end;
  const initialStart = isValidYmd(rawStart) ? rawStart : null;
  const initialEnd = isValidYmd(rawEnd) ? rawEnd : null;
  const hasInitialRange =
    !!initialStart && !!initialEnd && initialStart < initialEnd;

  const villa = await getVillaBySlugCached(slug);
  if (!villa) {
    return (
      <section className="section-narrow py-32 text-center">
        <p className="eyebrow !text-[var(--color-stone-400)]">404</p>
        <h2 className="font-display text-3xl text-[var(--color-stone-900)] mt-3">
          {dict.villa.notFoundTitle}
        </h2>
        <p className="text-[var(--color-stone-500)] mt-3">
          {dict.villa.notFoundBody}
        </p>
        <a href={localeHref("/arama", locale)} className="btn-ghost mt-6 inline-flex">
          {dict.villa.notFoundCta}
        </a>
      </section>
    );
  }

  const title = villa.title;
  const description = await getVillaTranslatedDescription(
    villa.id,
    villa.description,
    locale
  );
  const youtubeVideos: VillaYouTubeVideo[] = normalizeYouTubeVideos(
    villa.youtube_videos
  );

  const [distances, features, rules, priceIncludes] = await Promise.all([
    getVillaDistances(villa.id),
    getVillaFeaturesByVilla(villa.id) as Promise<Feature[]>,
    getRuleItemsByVilla(villa.id),
    getPriceIncludeItemsByVilla(villa.id),
  ]);

  const [
    images,
    prices,
    discounts,
    externalBlocks,
    settings,
    reviews,
    reviewStats,
  ] = await Promise.all([
    getVillaImages(villa.id),
    getVillaPrices(villa.id),
    getVillaDiscounts(villa.id),
    fetchExternalCalendarStringsForVilla(villa.id).catch(
      () => EMPTY_EXTERNAL_STRING_ARRAYS
    ),
    getCachedSettings(),
    getCachedVillaReviews(villa.id),
    getCachedVillaReviewStats(villa.id),
  ]);

  /* Koleksiyon başına TEK sorgu; ana dilde (EN) sorgu atılmaz. */
  const [featureTranslations, ruleTranslations, priceIncludeTranslations] =
    await Promise.all([
      getTranslationsForParents(
        "villa_feature",
        features.map((f) => f.id),
        locale
      ),
      getTranslationsForParents("rule_item", rules.map((r) => r.id), locale),
      getTranslationsForParents(
        "price_include_item",
        priceIncludes.map((p) => p.id),
        locale
      ),
    ]);

  const translatedDistances: TranslatedDistance[] = distances.map((d) => ({
    id: d.id,
    displayTitle: getTranslatedDistanceLabel(d.title, locale),
    displayDistance: d.distance,
    iconKey: getDistanceIconKey(d.title),
  }));
  const translatedFeatures: TranslatedFeature[] = features.map((f) => ({
    id: f.id,
    displayName: resolveTranslatedField(
      featureTranslations.get(f.id)?.name,
      f.name
    ),
  }));
  const translatedRules: TranslatedRule[] = rules.map((r) => ({
    id: r.id,
    displayTitle: resolveTranslatedField(
      ruleTranslations.get(r.id)?.title,
      r.title
    ),
  }));
  const translatedPriceIncludes: TranslatedPriceInclude[] = priceIncludes.map(
    (p) => ({
      id: p.id,
      displayTitle: resolveTranslatedField(
        priceIncludeTranslations.get(p.id)?.title,
        p.title
      ),
    })
  );

  /* Bölge adı özel isimdir — her dilde canonical gösterilir. */
  const locationName = villa.location;

  const watermark = {
    logo:
      resolveAssetUrlVersioned(
        settings?.watermark_logo,
        settings?.updated_at
      ) ?? null,
    enabled: settings?.watermark_enabled ?? false,
    opacity: settings?.watermark_opacity ?? 0.15,
    position: settings?.watermark_position ?? "center",
    size: settings?.watermark_size ?? 25,
  } as const;

  const imageUrls = images
    .map((img) => resolveVillaImageUrl(img.image_url))
    .filter((u): u is string => typeof u === "string" && u.length > 0);

  const minPrice = prices?.length
    ? prices.reduce(
        (acc, pr) =>
          pr.price > 0 && (acc === null || pr.price < acc.price)
            ? { price: Number(pr.price), currency: pr.currency || "TRY" }
            : acc,
        null as { price: number; currency: string } | null
      )
    : null;

  const vacationRentalLd = buildVacationRental({
    slug: villa.slug || slug,
    title,
    description: stripHtml(description || villa.description),
    images: imageUrls,
    locationName: locationName || null,
    latitude: typeof villa.latitude === "number" ? villa.latitude : null,
    longitude: typeof villa.longitude === "number" ? villa.longitude : null,
    guests: villa.guests,
    bedrooms: villa.bedrooms,
    bathrooms: villa.bathrooms,
    features: translatedFeatures.map((f) => f.displayName).filter(Boolean),
    priceFrom: minPrice
      ? { amount: minPrice.price, currency: minPrice.currency }
      : null,
    aggregateRating:
      reviewStats.count > 0
        ? { ratingValue: reviewStats.average, reviewCount: reviewStats.count }
        : null,
    locale,
  });

  const breadcrumbLd = buildBreadcrumb(
    [
      { name: dict.header.home, url: localeHref("/", locale) },
      /* SEO — robots-engelli /arama yerine indexlenebilir arşiv. */
      { name: dict.header.villas, url: localeHref("/kiralik-villalar", locale) },
      { name: title },
    ],
    locale
  );

  return (
    <VillaDetailBody
      locale={locale}
      villa={villa}
      villaTitle={title}
      displayLocation={locationName}
      displayDescription={description}
      imageUrls={imageUrls}
      watermark={watermark}
      youtubeVideos={youtubeVideos}
      prices={prices}
      discounts={discounts}
      externalBlocks={externalBlocks}
      distances={translatedDistances}
      features={translatedFeatures}
      rules={translatedRules}
      priceIncludes={translatedPriceIncludes}
      reviews={reviews}
      reviewStats={reviewStats}
      orphanGapRuleEnabled={settings?.orphan_gap_rule_enabled ?? true}
      contactPhone={settings?.phone ?? null}
      contactWhatsappLink={settings?.whatsapp_link ?? null}
      initialStart={hasInitialRange ? initialStart : undefined}
      initialEnd={hasInitialRange ? initialEnd : undefined}
      bookingSidebarId={BOOKING_SIDEBAR_ID[locale]}
      vacationRentalLd={vacationRentalLd}
      breadcrumbLd={breadcrumbLd}
    />
  );
}
