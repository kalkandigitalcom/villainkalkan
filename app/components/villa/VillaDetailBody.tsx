import type { ComponentProps } from "react";
import { Bath, BedDouble, Clock, MapPin, Users } from "lucide-react";

/* ===============================================================
   🛡️ VillaDetailBody — PHASE 10G (TR/EN/DE TASARIM PARİTESİ)
   ===============================================================
   TR villa detay sayfasının (`app/(public)/kiralik-villa/[slug]/
   page.tsx`) GÖVDESİNİN, hiçbir DOM/CSS değişikliği YAPILMADAN
   çıkarılmış ortak hali. Artık TR, EN ve DE AYNI component'i
   render eder — tek fark `locale` prop'u ve çağıran tarafta ZATEN
   ÇÖZÜLMÜŞ (çevrilmiş) metin prop'larıdır.

   ⚠️ SÖZLEŞME — "caller resolves, component renders":
   Bu component HİÇBİR veri çekmez, HİÇBİR çeviri sorgusu atmaz.
   Tüm DB okumaları + çeviri çözümü çağıran page.tsx'te yapılır
   (TR'de çeviri katmanı HİÇ ÇALIŞMAZ — identity değerler geçilir,
   ek sorgu YOK). Tek istisna `SimilarVillasSection`: kendi verisini
   çeker (mevcut, DEĞİŞTİRİLMEMİŞ davranış).

   ⚠️ VİLLA ADI ÇEVRİLMEZ — özel isimdir; her locale'de canonical
   `villa.title` gösterilir (`villaTitle` prop'u).

   ⚠️ TR ÇIKTISI: `locale="tr"` ile üretilen DOM, bu refactor
   ÖNCESİNDEKİ TR sayfasıyla BİREBİR AYNIDIR — tüm className/grid/
   ikon/sıra/koşullar taşındı, hiçbiri değiştirilmedi; hardcoded TR
   metinlerinin YERİNE geçen dictionary değerleri byte-identical'dır.
   =============================================================== */

import PriceList from "@/app/components/villa/PriceList";
import ShortStayFeeNotice from "@/app/components/villa/ShortStayFeeNotice";
import CollapsibleDescription from "@/app/components/villa/CollapsibleDescription";
import AccommodationLayout from "@/app/components/villa/AccommodationLayout";
import VillaPoolSection from "@/app/components/villa/VillaPoolSection";
import VillaReviewsSection from "@/app/components/villa/VillaReviewsSection";
import SimilarVillasSection from "@/app/components/villa/SimilarVillasSection";
import FavoriteButton from "@/app/components/favorites/FavoriteButton";
import Gallery from "@/app/components/villa/Gallery";
import BookingSidebar from "@/app/components/villa/BookingSidebar";
import MobileBookingCta from "@/app/components/villa/MobileBookingCta";
import VillaShareLinks from "@/app/components/villa/VillaShareLinks";
import VillaSectionNav from "@/app/components/villa/VillaSectionNav";
import {
  VillaAvailabilityShortcut,
  VillaShowPhotosButton,
} from "@/app/components/villa/VillaDetailActions";
import {
  VILLA_DESCRIPTION_ANCHOR_ID,
  villaSectionAnchorId,
} from "@/app/components/villa/villa-detail-events";
import VillaDetailTabs from "@/app/components/villa/VillaDetailTabs";
import VillaMapModal from "@/app/components/villa/VillaMapModal";
import VillaDistancesSection, {
  type TranslatedDistance,
} from "@/app/components/villa/VillaDistancesSection";
import VillaFeaturesSection, {
  type TranslatedFeature,
} from "@/app/components/villa/VillaFeaturesSection";
import VillaPriceIncludesAndRulesSection, {
  type TranslatedPriceInclude,
  type TranslatedRule,
} from "@/app/components/villa/VillaPriceIncludesAndRulesSection";

import { JsonLd } from "@/app/components/seo/StructuredData";
import { sanitizeHtml, stripHtml } from "@/lib/html-sanitize";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { formatDictionaryString } from "@/lib/i18n/format-dictionary-string";
import type { Locale } from "@/lib/i18n/config";
import type { VillaDTO } from "@/app/services/villa.service";

/* Alt component'lerin KENDİ prop tiplerinden türetilir — burada
   paralel/ikinci bir tip tanımı İCAT EDİLMEZ (drift riski yok). */
type PricesProp = ComponentProps<typeof PriceList>["prices"];
/* BookingSidebar'ın tipi PriceList'inkinden DAR (null kabul etmez) —
   ikisini de besleyen tek prop olduğu için dar olan seçilir. */
type DiscountsProp = ComponentProps<typeof BookingSidebar>["discounts"];
type ExternalBlocksProp = ComponentProps<
  typeof BookingSidebar
>["externalBlocks"];
type WatermarkProp = ComponentProps<typeof Gallery>["watermark"];
type VideosProp = ComponentProps<typeof Gallery>["videos"];
type ReviewsProp = ComponentProps<typeof VillaReviewsSection>["reviews"];
type ReviewStatsProp = ComponentProps<typeof VillaReviewsSection>["stats"];

export type VillaDetailBodyProps = {
  locale: Locale;
  villa: VillaDTO;
  /** Canonical villa adı — ÇEVRİLMEZ (özel isim). */
  villaTitle: string;
  /** Çözülmüş lokasyon adı (TR'de `villa.location`). */
  displayLocation: string;
  /** Çözülmüş açıklama HTML'i (TR'de `villa.description`). */
  displayDescription: string | null;

  imageUrls: string[];
  watermark: WatermarkProp;
  youtubeVideos: VideosProp;

  prices: PricesProp;
  discounts: DiscountsProp;
  externalBlocks: ExternalBlocksProp;

  distances: TranslatedDistance[];
  features: TranslatedFeature[];
  rules: TranslatedRule[];
  priceIncludes: TranslatedPriceInclude[];

  reviews: ReviewsProp;
  reviewStats: ReviewStatsProp;

  orphanGapRuleEnabled: boolean;
  /* ⓘ `minPrice` prop'u KALDIRILDI: bu component'te tek tüketicisi
     mobil CTA'nın fiyat gösterimiydi ve o kaldırıldı. Sayfalardaki
     `minPrice` değişkeni JSON-LD `priceFrom` için AYNEN duruyor. */

  /* 🔄 MOBİL CTA İLETİŞİM AKSİYONLARI — ham `settings` alanları.
     Türetme (tel: / wa.me fallback) AŞAĞIDA TEK YERDE yapılır;
     çağıran sayfalar (tr/en/de) yalnız ham değeri geçer. Yeni
     business logic YOK — `app/(public)/layout.tsx` ve
     `FloatingSocial` ile BİREBİR AYNI ifade. */
  contactPhone?: string | null;
  contactWhatsappLink?: string | null;

  /** /arama'dan gelen tarihler — opsiyonel hydrate (TR davranışı). */
  initialStart?: string;
  initialEnd?: string;

  /** Sayfa başına EŞSİZ olmalı (MobileBookingCta `targetId` ile eşleşir). */
  bookingSidebarId: string;

  /** JSON-LD — locale'e özel, çağıran tarafta üretilir.
   *  🛡️ Opsiyonel YALNIZ gizli link (/v/[token]) için: off-market kayıt
   *  SEO yüzeyine girmesin diye o gövde JSON-LD VERMEZ. Normal TR/EN/DE
   *  detay sayfaları her zaman verir → çıktıları BİREBİR aynı. */
  vacationRentalLd?: Record<string, unknown>;
  breadcrumbLd?: Record<string, unknown>;

  /** 🛡️ Gizli link + PASİF villa: rezervasyon sayfası pasif villayı
   *  açmadığı için "Rezervasyon Yap" gizlenir (BookingSidebar'ın MEVCUT
   *  prop'u). Verilmezse BookingSidebar varsayılanı (false) → normal
   *  sayfalar BİREBİR aynı. */
  hideReservationCta?: boolean;
};

export default function VillaDetailBody({
  locale,
  villa,
  villaTitle,
  displayLocation,
  displayDescription,
  imageUrls,
  watermark,
  youtubeVideos,
  prices,
  discounts,
  externalBlocks,
  distances,
  features,
  rules,
  priceIncludes,
  reviews,
  reviewStats,
  orphanGapRuleEnabled,
  contactPhone,
  contactWhatsappLink,
  initialStart,
  initialEnd,
  bookingSidebarId,
  vacationRentalLd,
  breadcrumbLd,
  hideReservationCta,
}: VillaDetailBodyProps) {
  const dict = getDictionary(locale);

  /* 🔄 Mobil CTA iletişim href'leri — `app/(public)/layout.tsx` ve
     `FloatingSocial` ile BİREBİR AYNI türetme (yeni mantık YOK):
     whatsapp_link öncelikli, yoksa telefon hanelerinden wa.me. */
  const ctaPhoneDigits = (contactPhone || "").replace(/\D/g, "");
  const ctaPhoneHref = contactPhone?.trim()
    ? `tel:${contactPhone.trim()}`
    : null;
  const ctaWhatsappHref =
    contactWhatsappLink?.trim() ||
    (ctaPhoneDigits ? `https://wa.me/${ctaPhoneDigits}` : null);

  /* 🛡️ Üst tanıtım bandı — yalnız GÖRÜNÜM: mevcut prop'lardan türetilir,
     yeni veri/sorgu YOK. */
  const documentNumber = villa.tourism_document_number?.trim() || "";
  const heroStats = [
    {
      key: "guests",
      Icon: Users,
      value: villa.guests,
      label: dict.card.person,
    },
    {
      key: "bathrooms",
      Icon: Bath,
      value: villa.bathrooms,
      label: dict.card.bathroom,
    },
    {
      key: "bedrooms",
      Icon: BedDouble,
      value: villa.bedrooms,
      label: dict.card.bedroom,
    },
  ].filter((s) => typeof s.value === "number" && s.value > 0);

  return (
    <>
      {/* ═══ A — PAYLAŞ ŞERİDİ (beyaz) ═══ */}
      <div
        data-villa-share-strip
        className="bg-white border-b border-[var(--color-stone-100)] px-5 md:px-10 lg:px-16"
      >
        <div className="max-w-site mx-auto flex items-center justify-between gap-3 py-3">
          <VillaShareLinks title={villaTitle} locale={locale} />
          {/* Dar ekranda ikon (paylaşım ikonlarıyla çakışmasın),
              sm+ ekranda metinli buton — aynı FavoriteButton mantığı. */}
          <div className="shrink-0 sm:hidden">
            <FavoriteButton villaId={villa.id} variant="icon" locale={locale} />
          </div>
          <div className="hidden shrink-0 sm:block">
            <FavoriteButton
              villaId={villa.id}
              variant="detail"
              locale={locale}
            />
          </div>
        </div>
      </div>

      {/* ═══ B — TANITIM BANDI (koyu lacivert, iki kolon) ═══ */}
      <section
        data-villa-intro
        className="bg-ink text-white px-5 md:px-10 lg:px-16 py-8 md:py-12 lg:py-14"
      >
        <div className="max-w-site mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 items-center gap-7 md:gap-8 lg:gap-12">
          <div className="min-w-0 lg:col-span-5">
            {documentNumber && (
              <p
                data-villa-document-number
                className="inline-flex max-w-full items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-white/85 ring-1 ring-white/15"
              >
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                />
                <span className="truncate">
                  {formatDictionaryString(dict.villa.documentNumber, {
                    n: documentNumber,
                  })}
                </span>
              </p>
            )}

            <h1 className="mt-4 font-display font-bold text-[30px] md:text-[36px] lg:text-[44px] leading-[1.08] tracking-[-0.02em] text-white break-words">
              {villaTitle}
            </h1>

            {displayLocation && (
              <p className="mt-3 flex items-center gap-2 text-[14px] md:text-[15px] text-white/80">
                <MapPin
                  size={16}
                  strokeWidth={1.8}
                  className="shrink-0 text-accent"
                  aria-hidden
                />
                <span className="min-w-0 truncate">{displayLocation}</span>
              </p>
            )}

            {heroStats.length > 0 && (
              <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
                {heroStats.map(({ key, Icon, value, label }) => (
                  <li key={key} className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15">
                      <Icon size={16} strokeWidth={1.8} aria-hidden />
                    </span>
                    <span className="text-[14px] leading-tight">
                      <strong className="font-semibold text-white tabular-nums">
                        {value}
                      </strong>{" "}
                      <span className="text-white/70">{label}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {imageUrls.length > 0 && (
              <div className="mt-7">
                <VillaShowPhotosButton
                  count={imageUrls.length}
                  locale={locale}
                />
              </div>
            )}
          </div>

          <div className="min-w-0 order-first md:order-last lg:col-span-7">
            <Gallery
              layout="single"
              images={imageUrls}
              watermark={watermark}
              villaTitle={villaTitle}
              videos={youtubeVideos}
              locale={locale}
            />
          </div>
        </div>
      </section>

      <div className="pb-24 md:pb-32">
        {/* SEO — JSON-LD structured data */}
        {vacationRentalLd && <JsonLd data={vacationRentalLd} />}
        {breadcrumbLd && <JsonLd data={breadcrumbLd} />}

        {/* ═══ C — NAVİGASYON ŞERİDİ (doğal konumda; ulaşınca Header
            altında yapışkan — şerit kabı VillaSectionNav içinde) ═══ */}
        <VillaSectionNav locale={locale} />

        <div className="px-5 md:px-10 lg:px-16">
          <div className="max-w-site mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-8 lg:gap-10">
              {/* LEFT — ~70%: içerik gövdesi */}
              <div className="min-w-0 lg:col-span-7 pt-8 md:pt-10 space-y-10 md:space-y-12">
                {/* DESCRIPTION */}
                <section
                  id={VILLA_DESCRIPTION_ANCHOR_ID}
                  className="scroll-mt-[180px]"
                >
                  <h2 className="font-display text-2xl md:text-3xl text-[var(--color-stone-900)] tracking-[-0.015em]">
                    {dict.villa.aboutTitle}
                  </h2>
                  {displayDescription && displayDescription.trim() ? (
                    <CollapsibleDescription
                      html={sanitizeHtml(displayDescription)}
                      collapsible={
                        stripHtml(displayDescription).trim().length > 280
                      }
                      locale={locale}
                    />
                  ) : (
                    <div className="card-premium mt-5 p-6 md:p-7 text-[var(--color-stone-600)] leading-[1.75] text-[15px]">
                      <span className="italic text-[var(--color-stone-400)]">
                        {dict.villa.descriptionEmpty}
                      </span>
                    </div>
                  )}
                </section>

                {/* 🛡️ İÇERİK BÖLÜMLERİ — Fiyatlar, Müsaitlik, Konum, Özellikler
                    sayfada ardışık ve hep açık (navigasyon hedefleri). */}
                <VillaDetailTabs
                  fiyatlar={
                    <section>
                      <h2 className="font-display text-2xl md:text-3xl text-[var(--color-stone-900)] tracking-[-0.015em] mb-4">
                        {dict.villa.seasonPricesTitle}
                      </h2>
                      {prices.length === 0 ? (
                        <p className="text-[var(--color-stone-400)] text-sm italic">
                          {dict.price.noPriceInfo}
                        </p>
                      ) : (
                        <PriceList
                          prices={prices}
                          minimumStayNights={villa.minimum_stay_nights ?? null}
                          deposit={villa.deposit ?? null}
                          discounts={discounts}
                          locale={locale}
                        />
                      )}

                      <ShortStayFeeNotice
                        cleaningFee={villa.cleaning_fee}
                        cleaningCurrency={villa.cleaning_currency}
                        cleaningLimit={villa.cleaning_limit}
                        locale={locale}
                      />
                    </section>
                  }
                  konum={
                    <div className="space-y-10">
                      <VillaDistancesSection
                        distances={distances}
                        locale={locale}
                      />
                    </div>
                  }
                  ozellikler={
                    <VillaFeaturesSection features={features} locale={locale} />
                  }
                />

                {/* 🛡️ KONAKLAMA DÜZENİ (mig 047) */}
                <AccommodationLayout
                  bedrooms={villa.bedroom_layout ?? []}
                  bathrooms={villa.bathroom_layout ?? []}
                  locale={locale}
                />

                {/* 🏊 HAVUZ BİLGİLERİ */}
                <VillaPoolSection villa={villa} locale={locale} />

                {/* 🔥 INCLUDES + RULES */}
                <VillaPriceIncludesAndRulesSection
                  priceIncludes={priceIncludes}
                  rules={rules}
                  locale={locale}
                />

                {/* 🛡️ FAZ 33 — REVIEWS SECTION (şeridin "Yorumlar" hedefi) */}
                <div
                  id={villaSectionAnchorId("yorumlar")}
                  data-villa-section="yorumlar"
                  className="scroll-mt-[180px]"
                >
                  <VillaReviewsSection
                    villaId={villa.id}
                    reviews={reviews}
                    stats={reviewStats}
                    locale={locale}
                  />
                </div>
              </div>

              {/* RIGHT (sidebar) — sticky DEĞİL, normal akış. */}
              {/* Kart, navigasyon şeridinin üst hizasından başlayıp içeriğe
                taşar (yalnız lg+). Mobilde normal akış. */}
              <aside
                id={bookingSidebarId}
                className="min-w-0 lg:col-span-3 relative pt-0 lg:-mt-14"
              >
                <VillaAvailabilityShortcut locale={locale} />
                <div className="mt-3 rounded-[28px] lg:shadow-[0_28px_60px_-32px_rgba(27,46,94,0.45)]">
                  <BookingSidebar
                    villaSlug={villa.slug}
                    villaId={villa.id}
                    externalBlocks={externalBlocks}
                    prices={prices}
                    discounts={discounts}
                    deposit={villa.deposit}
                    cleaning_fee={villa.cleaning_fee}
                    cleaning_currency={villa.cleaning_currency}
                    cleaning_limit={villa.cleaning_limit}
                    pool_heating_fee={villa.pool_heating_fee}
                    pool_heating_currency={villa.pool_heating_currency}
                    pool_heating_months={villa.pool_heating_months}
                    custom_prepayment_rate={
                      villa.custom_prepayment_rate ?? null
                    }
                    minimum_stay_nights={villa.minimum_stay_nights ?? null}
                    orphanGapRuleEnabled={orphanGapRuleEnabled}
                    initialStart={initialStart}
                    initialEnd={initialEnd}
                    locale={locale}
                    hideReservationCta={hideReservationCta}
                  />
                </div>

                {/* 🕓 GİRİŞ & ÇIKIŞ SAATLERİ */}
                <div
                  className="
              mt-6 rounded-2xl
              border border-[var(--color-stone-100)]
              bg-gradient-to-b from-[var(--color-sand-50)]/70 to-white
              shadow-[0_10px_28px_-20px_rgba(27,46,94,0.18)]
              px-5 py-5
            "
                >
                  <span className="inline-flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[var(--color-stone-400)]">
                    <span
                      aria-hidden="true"
                      className="inline-block w-3 h-px bg-gradient-to-r from-accent to-brand"
                    />
                    {dict.villa.checkInOutTitle}
                  </span>

                  <div className="mt-4 flex items-center">
                    <div className="flex flex-1 items-center gap-3 min-w-0">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                        <Clock size={16} strokeWidth={1.8} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-stone-400)]">
                          {dict.villa.checkInLabel}
                        </p>
                        <p className="font-display text-[21px] md:text-[22px] leading-tight text-[var(--color-stone-900)] tabular-nums">
                          16:00
                        </p>
                      </div>
                    </div>

                    <span
                      aria-hidden="true"
                      className="mx-4 h-10 w-px shrink-0 bg-[var(--color-stone-100)]"
                    />

                    <div className="flex flex-1 items-center gap-3 min-w-0">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-ink">
                        <Clock size={16} strokeWidth={1.8} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-stone-400)]">
                          {dict.villa.checkOutLabel}
                        </p>
                        <p className="font-display text-[21px] md:text-[22px] leading-tight text-[var(--color-stone-900)] tabular-nums">
                          10:00
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 🛡️ "Nerede?" — konum kartı (harita modal içinde). */}
                <div
                  className="
              mt-6 rounded-2xl
              border border-[var(--color-stone-100)]
              bg-white
              shadow-[0_10px_28px_-20px_rgba(27,46,94,0.18)]
              px-5 py-5
            "
                >
                  <VillaMapModal
                    mapType={villa.map_type}
                    latitude={villa.latitude}
                    longitude={villa.longitude}
                    mapEmbed={villa.map_embed}
                    villaTitle={villaTitle}
                    locale={locale}
                  />
                </div>
              </aside>
            </div>
          </div>
        </div>

        {/* 🛡️ MOBILE STICKY CTA — yalnız <lg viewport. */}
        <MobileBookingCta
          targetId={bookingSidebarId}
          locale={locale}
          phoneHref={ctaPhoneHref}
          whatsappHref={ctaWhatsappHref}
        />
      </div>

      {/* 🛡️ FULL-WIDTH — Misafir Yorumları'ndan SONRA, Footer'dan ÖNCE. */}
      <SimilarVillasSection
        villaId={villa.id}
        locationId={villa.location_id ?? null}
        locale={locale}
      />
    </>
  );
}
