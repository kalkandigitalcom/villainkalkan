"use client";

/* ===============================================================
   🛡️ İNDİRİMLİ VİLLA KARTI — ORTAK VERİ MODELİ (A ve B tasarımları)
   ===============================================================
   Yeni kart tasarımlarının (DiscountVillaCardA / DiscountVillaCardB)
   kullandığı TEK veri katmanı. Hiçbir yeni fiyat/indirim/tarih mantığı
   YAZILMADI:
     - Kur dönüşümü: `convertPrice` + `useCurrency` (VillaCard ile AYNI)
     - İndirim hesabı, geçerlilik etiketi, rozet yüzdesi, gecelik
       tasarruf ve rezervasyon hedefi: `computeDiscountCardPricing`
       (VillaCard discount branch'inden BİREBİR taşınan tek kaynak)
     - Detay bağlantısı: `buildLocaleAlternates("/kiralik-villa/<slug>")`
       (VillaCard ile AYNI; ana sayfada tarih parametresi yoktur)
     - Kapak görseli: ilk geçerli URL (VillaCard ile AYNI seçim kuralı)
   =============================================================== */

import { useState } from "react";

import {
  canConvertForDisplay,
  collectSourceCurrencies,
  convertPrice,
} from "@/lib/currency";
import { useCurrency } from "@/app/context/CurrencyContext";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { buildLocaleAlternates } from "@/lib/i18n/seo-alternates";
import type { Locale } from "@/lib/i18n/config";
import {
  computeDiscountCardPricing,
  type DiscountCardDiscount,
} from "@/app/components/villa/discount-card-pricing";

export type DiscountVillaCardProps = {
  id: string;
  slug: string;
  title: string;
  location: string;
  price: number;
  currency: string;
  images: string[];
  bedrooms: number;
  bathrooms: number;
  guests: number;
  reviewAverage?: number;
  reviewCount?: number;
  discount?: DiscountCardDiscount | null;
  discountAvailable?: boolean;
  locale?: Locale;
};

export function useDiscountCardModel(props: DiscountVillaCardProps) {
  const {
    slug,
    title,
    price,
    currency: villaCurrency = "TRY",
    images,
    discount = null,
    discountAvailable,
    locale,
  } = props;

  const dict = getDictionary(locale);
  const effectiveLocale: Locale = locale ?? "tr";
  const { currency, rates } = useCurrency();

  /* 🛡️ Kur kapısı — yalnız ilgili kaynak para birimleri (TRY → TRY her
     zaman görünür). */
  const basePriceReady = canConvertForDisplay(rates, currency, [villaCurrency]);
  const discountPriceReady = canConvertForDisplay(rates, currency,
    collectSourceCurrencies(villaCurrency, discount ? [discount] : null)
  );

  const convertedPrice = convertPrice(
    Number(price || 0),
    villaCurrency,
    currency,
    rates
  );

  const pricing = computeDiscountCardPricing({
    isDiscountVariant: true,
    slug,
    price,
    villaCurrency,
    convertedPrice,
    currency,
    rates,
    discount,
    discountAvailable,
    privateHref: undefined,
    dict,
    effectiveLocale,
    ratesReady: discountPriceReady,
  });

  const detailHref = buildLocaleAlternates(
    `/kiralik-villa/${slug}`,
    effectiveLocale
  ).canonical;

  /* VillaCard ile AYNI CTA kuralı: fırsat tarihleri geçerli ve pencere
     müsaitse /rezervasyon (ön-seçili tarihlerle); aksi halde detay. */
  const reserveHref = pricing.discountReserveHref ?? detailHref;

  const cover = (images || []).find(
    (u): u is string => typeof u === "string" && u.trim().length > 0
  );
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = !!cover && !imgFailed;
  const initial = (title?.trim()?.[0] || "·").toUpperCase();

  const hasRating =
    typeof props.reviewCount === "number" &&
    props.reviewCount > 0 &&
    typeof props.reviewAverage === "number" &&
    props.reviewAverage > 0;

  return {
    dict,
    effectiveLocale,
    currency,
    basePriceReady,
    discountPriceReady,
    convertedPrice,
    ...pricing,
    detailHref,
    reserveHref,
    cover,
    showImage,
    onImageError: () => setImgFailed(true),
    initial,
    hasRating,
  };
}
