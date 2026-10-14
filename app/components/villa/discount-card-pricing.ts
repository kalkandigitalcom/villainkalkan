/* ===============================================================
   🛡️ İNDİRİM KARTI FİYAT/HEDEF MODELİ — TEK KAYNAK
   ===============================================================
   Bu dosyadaki gövde `VillaCard.tsx` (variant="discount") içinden
   SATIR SATIR TAŞINDI — hesaplama mantığı DEĞİŞTİRİLMEDİ. Amaç: ana
   sayfa "İndirimli Kiralık Villalar" bölümünün yeni kart tasarımları
   (DiscountVillaCardA / DiscountVillaCardB) ile `VillaCard`'ın
   discount branch'i AYNI hesaplamayı kullansın (kopya/drift YOK).

   Girdi: kartın zaten sahip olduğu değerler (villa fiyatı, villa para
   birimi, kullanıcı para birimi + kurlar, ham `villa_discounts`
   kaydı, müsaitlik bayrağı, slug, locale sözlüğü).
   Çıktı: aktif indirim, indirimli fiyat, geçerlilik etiketi, rozet
   yüzdesi, gecelik tasarruf etiketi ve rezervasyon hedef URL'i.

   Saf (pure) fonksiyon: React/hook bağımlılığı YOK, side-effect YOK.
   =============================================================== */

import { formatCurrency } from "@/lib/currency";
import {
  applyDiscountToDailyPrice,
  type DiscountRange,
} from "@/lib/price.engine";
import type { MonthNumber } from "@/lib/i18n/dictionaries/types";
import {
  formatDiscountDateRange,
  formatLocalDate,
  parseLocalDate,
} from "@/lib/date-format";
import type { getDictionary } from "@/lib/i18n/get-dictionary";
import { formatDictionaryString } from "@/lib/i18n/format-dictionary-string";
import { buildLocaleAlternates } from "@/lib/i18n/seo-alternates";
import type { Locale } from "@/lib/i18n/config";

/** `HomepageCollectionVilla.discount` ile AYNI şekil (ham kayıt). */
export type DiscountCardDiscount = {
  start_date: string;
  end_date: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  currency: string | null;
};

export type DiscountCardPricingInput = {
  /** `variant === "discount"` — false ise tüm çıktılar boş/null. */
  isDiscountVariant: boolean;
  slug: string;
  /** Villa ham gecelik fiyatı (villa para biriminde). */
  price: number | undefined;
  villaCurrency: string;
  /** `convertPrice(price, villaCurrency, currency, rates)` sonucu. */
  convertedPrice: number;
  /** Kullanıcının seçili para birimi (useCurrency). */
  currency: string;
  rates: Record<string, number>;
  discount: DiscountCardDiscount | null | undefined;
  discountAvailable: boolean | undefined;
  privateHref: string | undefined;
  dict: ReturnType<typeof getDictionary>;
  effectiveLocale: Locale;
};

export type DiscountCardPricing = {
  activeDiscount: DiscountRange | null;
  discountedPrice: ReturnType<typeof applyDiscountToDailyPrice> | null;
  discountDateRangeLabel: string;
  showDiscountPricing: boolean;
  discountBadgePercent: number | null;
  nightlySavingsLabel: string | null;
  discountReserveHref: string | null;
};

export function computeDiscountCardPricing(
  input: DiscountCardPricingInput
): DiscountCardPricing {
  const {
    isDiscountVariant,
    slug,
    price,
    villaCurrency,
    convertedPrice,
    currency,
    rates,
    discount,
    discountAvailable,
    privateHref,
    dict,
    effectiveLocale,
  } = input;

  const activeDiscount: DiscountRange | null =
    isDiscountVariant && discount && Number(price) > 0
      ? {
          start_date: discount.start_date,
          end_date: discount.end_date,
          discount_type: discount.discount_type,
          discount_value: discount.discount_value,
          currency: discount.currency,
        }
      : null;

  const discountedPrice = activeDiscount
    ? applyDiscountToDailyPrice(
        {
          converted: convertedPrice,
          original: Number(price || 0),
          original_currency: villaCurrency,
        },
        activeDiscount,
        currency,
        rates
      )
    : null;

  /* 🛡️ PUBLIC ÇOKLU DİL — indirim geçerlilik metni artık locale-aware.
     MEVCUT `formatDiscountDateRange` çekirdeği + MEVCUT `home.months`
     sözlüğü + `card.discountValid*` şablonları kullanılır; tarih
     matematiği, dal koşulları ve indirim/fiyat hesabı DEĞİŞMEDİ.
     TR şablonları `formatDiscountDateRangeTr` metniyle BİREBİR aynı →
     TR çıktısı korunur. */
  const discountDateRangeLabel = activeDiscount
    ? formatDiscountDateRange(
        activeDiscount.start_date,
        activeDiscount.end_date,
        (month) => dict.home.months[month as MonthNumber] ?? "",
        {
          sameMonth: dict.card.discountValidSameMonth,
          sameYear: dict.card.discountValidSameYear,
          full: dict.card.discountValidFull,
        }
      )
    : "";

  const showDiscountPricing =
    !!activeDiscount && !!discountedPrice && !!discountDateRangeLabel;

  /* 🏷️ İNDİRİM ROZETİ YÜZDESİ (bu tur) — sağ üst köşedeki "%NN İNDİRİM"
     rozetinin göstereceği değer. SABIT bir yüzde YAZILMADI:
     - discount_type === "percent" ise `discount_value` DOĞRUDAN kullanılır
       (örn. 20 → %20).
     - discount_type === "fixed" ise gerçek yüzde, normal (convertedPrice)
       ile indirimli (discountedPrice.converted) fiyat arasındaki farktan
       hesaplanır — yeni bir fiyat mantığı YOK, yalnızca mevcut iki
       değerin oranı alınıyor.
     Hesaplanamıyorsa (fiyat sıfır/negatif, indirim yoksa vb.) badge HİÇ
     render edilmez — uydurma yüzde YOK. */
  const discountBadgePercent: number | null = (() => {
    if (!showDiscountPricing || !activeDiscount || !discountedPrice) return null;
    if (activeDiscount.discount_type === "percent") {
      const pct = Math.round(Number(activeDiscount.discount_value) || 0);
      return pct > 0 ? pct : null;
    }
    if (convertedPrice > 0 && discountedPrice.converted < convertedPrice) {
      const pct = Math.round(
        ((convertedPrice - discountedPrice.converted) / convertedPrice) * 100
      );
      return pct > 0 ? pct : null;
    }
    return null;
  })();

  /* 💰 GECELİK TASARRUF ETİKETİ (bu tur) — fiyat satırının hemen altında
     gösterilen "Gecelik NNN₺ indirimli" metni. SABİT tutar YAZILMADI:
     mevcut convertedPrice (normal, zaten hesaplanmış) ile
     discountedPrice.converted (indirimli, zaten hesaplanmış) arasındaki
     farktan TÜRETİLİR — yeni bir fiyat/indirim hesaplama mantığı YOK,
     yalnızca iki mevcut değerin farkı görsel amaçla alınıyor. Fark
     pozitif değilse (indirimli fiyat normal fiyattan düşük değilse)
     veya showDiscountPricing/discountedPrice yoksa bu satır HİÇ
     render edilmez. Para birimi mevcut formatCurrency() ile AYNI
     mantıkla gösterilir — yeni bir currency formatlama YOK. */
  const nightlySavingsLabel: string | null = (() => {
    if (!showDiscountPricing || !discountedPrice) return null;
    const savings = convertedPrice - discountedPrice.converted;
    if (!(savings > 0)) return null;
    return formatDictionaryString(dict.card.nightlySavings, {
      amount: formatCurrency(savings, currency, effectiveLocale),
    });
  })();

  /* 🛡️ İNDİRİM KARTI CTA — FIRSAT TARİHLERİNİ REZERVASYONA TAŞI
     ===============================================================
     Yalnız `variant === "discount"` (ana sayfa "İndirimli Kiralık
     Villalar") için türetilir. Kaynak: `discount` prop'u — yani
     `villa_discounts` kaydının KENDİSİ (lib/cache.helpers >
     getCachedDiscountCollectionVillas, RSC + unstable_cache). YENİ DB
     SORGUSU YOK, yeni veri modeli YOK, tarih TAHMİN EDİLMEZ.

     URL STANDARDI — projede ZATEN kullanılan desen (yeni sözleşme
     İCAT EDİLMEDİ):
       ShortGapsPageBody.tsx:466 →
         `${localePrefix}/rezervasyon/${slug}?start=...&end=...`
       useBookingEngine.ts:995   → aynı `start`/`end` param adları
     Locale öneki `buildLocaleAlternates` ile üretilir (detailHref ile
     AYNI helper; "tr" → öneksiz, "en"/"de" → /en, /de — üç route da
     mevcut).

     ⚠️ TARİH SEMANTİĞİ — GÜN EKLEME/ÇIKARMA YOK (İŞ KURALI, ürün
     sahibi tarafından doğrulandı):
       `discount.end_date` bu üründe kullanıcıya gösterilen ÇIKIŞ
       tarihidir. Kart üzerindeki "İndirim geçerli: …" etiketi
       (discountDateRangeLabel) start_date/end_date'i AYNEN basar;
       /rezervasyon özet paneli de `start`/`end` param'larını AYNEN
       basar (ReservationPageBody → ReservationForm). Dolayısıyla iki
       ekranın BİREBİR aynı tarihleri göstermesi için değerler
       DEĞİŞTİRİLMEDEN taşınır.
       ⛔ `+ 1 gün` UYGULANMAZ. Gece sayısı burada YENİDEN
          HESAPLANMAZ — rezervasyon sayfası kendi mevcut mantığıyla
          (ReservationForm > getNights / price.engine) hesaplar; o
          mantığa DOKUNULMADI.

     Geçersiz/eksik veri (slug yok, tarih parse edilemiyor, ters
     aralık) → `null` → CTA MEVCUT davranışına (detailHref) düşer.
     Buton JSX'i, className, metin ve tasarımı DEĞİŞMEDİ. */
  const discountReserveHref: string | null = (() => {
    if (!isDiscountVariant) return null;
    /* Pasif villa (özel link) → rezervasyon sayfasına yönlendirme YOK. */
    if (privateHref) return null;
    /* 🛡️ TAM ARALIK MÜSAİTLİK KAPISI — indirim penceresinde TEK BİR
       GECE bile doluysa rezervasyon sayfasına YÖNLENDİRME YOK; CTA
       aşağıdaki mevcut `detailHref` fallback'ine düşer.
       `undefined` (kontrol yapılmamış / fail-soft) → eski davranış. */
    if (discountAvailable === false) return null;
    const startRaw = discount?.start_date;
    const endRaw = discount?.end_date;
    if (!startRaw || !endRaw) return null;

    const cleanSlug = String(slug || "").trim();
    if (!cleanSlug) return null;

    const s = parseLocalDate(startRaw);
    const e = parseLocalDate(endRaw);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
    if (e.getTime() < s.getTime()) return null;

    const base = buildLocaleAlternates(
      `/rezervasyon/${cleanSlug}`,
      effectiveLocale
    ).canonical;

    const qs = new URLSearchParams();
    qs.set("start", formatLocalDate(s));
    /* Normalize ("YYYY-MM-DDT…" → "YYYY-MM-DD"); gün DEĞİŞMEZ. */
    qs.set("end", formatLocalDate(e));
    return `${base}?${qs.toString()}`;
  })();


  return {
    activeDiscount,
    discountedPrice,
    discountDateRangeLabel,
    showDiscountPricing,
    discountBadgePercent,
    nightlySavingsLabel,
    discountReserveHref,
  };
}
