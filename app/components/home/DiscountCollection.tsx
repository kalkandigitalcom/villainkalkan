import { getCachedDiscountCollectionVillas } from "@/lib/cache.helpers";
import HorizontalCarousel from "../villa/HorizontalCarousel";
import VillaCard from "../villa/VillaCard";
/* 🛡️ PHASE 11 — section başlığı dictionary'den; villa ADI ve BÖLGESİ
   CANONICAL kalır. */
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import DiscountVillaCardA from "./discount-cards/DiscountVillaCardA";
import DiscountVillaCardB from "./discount-cards/DiscountVillaCardB";
import {
  DISCOUNT_CARD_DESIGN,
  type DiscountCardDesign,
} from "./discount-cards/discount-card-design";

/* ===============================================================
   🛡️ DISCOUNT COLLECTION — anasayfa "İndirimli Kiralık Villalar"
   ===============================================================
   VERİ AKIŞI (DEĞİŞMEDİ):
     - Veri: getCachedDiscountCollectionVillas (tag "discount") —
       villa_discounts kayıtları, her indirim dönemi AYRI kart
       (`card_key`), pencere müsaitliği (`discount_available`).
     - Görünürlük OTOMATİK: aktif villa yoksa section render edilmez.
     - Carousel: HorizontalCarousel (native scroll-snap, mobil swipe,
       masaüstü oklar) — locale-aware ok etiketleri.

   🎨 KART TASARIMI (bu revizyon):
     Eski `VillaCard variant="discount"` yerine iki yeni yatay kart
     tasarımı hazırlandı; ana sayfada YALNIZ biri görünür:
       - "a" → DiscountVillaCardA (Premium Yatay Kart)
       - "b" → DiscountVillaCardB (Editoryal Lüks Kart)
       - "c" → VillaCard variant="discount" (public kart tasarım sistemi)
     Varsayılan: `DISCOUNT_CARD_DESIGN` (discount-cards/
     discount-card-design.ts). `design` prop'u yalnız geliştirme
     önizleme sayfası (/onizleme/indirimli-villalar) içindir.
     Fiyat/indirim/tarih/CTA hedefi hesapları VillaCard ile AYNI tek
     kaynaktan gelir: app/components/villa/discount-card-pricing.ts.
=============================================================== */

/** Kart genişlikleri + ok adımı — tasarım başına (kart + boşluk). */
const LAYOUT: Record<
  DiscountCardDesign,
  { item: string; gap: string; scrollStep: number }
> = {
  a: {
    /* 2 kart = ortak site genişliği (max-w-site 1210): (1210 − 24) / 2 */
    item: "w-[86vw] max-w-[400px] md:max-w-none md:w-[593px]",
    gap: "gap-4 md:gap-6",
    scrollStep: 617,
  },
  b: {
    item: "w-[84vw] max-w-[400px] md:max-w-none md:w-[720px] lg:w-[780px]",
    gap: "gap-5 md:gap-10",
    scrollStep: 820,
  },
  /* Geniş kart → fiyat paneli referanstaki gibi sağda (@container ≥ 26rem). */
  c: {
    item: "w-[86vw] max-w-[380px] md:max-w-none md:w-[440px]",
    gap: "gap-5 md:gap-6",
    scrollStep: 464,
  },
};

export default async function DiscountCollection({
  locale = DEFAULT_LOCALE,
  design = DISCOUNT_CARD_DESIGN,
}: {
  locale?: Locale;
  /** Yalnız önizleme sayfası geçer; ana sayfa varsayılanı kullanır. */
  design?: DiscountCardDesign;
} = {}) {
  const dict = getDictionary(locale).home.discount;
  const carouselDict = getDictionary(locale).home.carousel;
  const collection = await getCachedDiscountCollectionVillas();

  /* Görünürlük kuralı: küratörlü aktif villa yoksa render edilmez. */
  if (collection.length === 0) return null;

  /* 🛡️ PHASE 11 — TR'de `DISCOUNT_COLLECTION_DEFAULTS.title` ile BİREBİR
     aynı metin (dictionary'ye taşındı); EN'de çevirisi kullanılır. */
  const title = dict.title;

  /* ℹ️ Villa rozeti (badge) bu bölümde GÖSTERİLMEZ — önceki indirim
     kartı (VillaCard discount branch) da rozeti render etmiyordu.
     Bu yüzden, sonucu hiçbir yerde kullanılmayan rozet çevirisi
     sorgusu (getVillaBadgesByLocale) kaldırıldı; indirim verisi
     sorgusu (getCachedDiscountCollectionVillas) AYNEN duruyor. */

  const Card = design === "b" ? DiscountVillaCardB : DiscountVillaCardA;
  const layout = LAYOUT[design];

  /* Prop eşlemesi ve fallback değerleri eski VillaCard çağrısıyla AYNI. */
  const renderCard = (c: (typeof collection)[number]) =>
    design === "c" ? (
      <VillaCard
        variant="discount"
        id={c.id}
        slug={c.slug}
        title={c.display_title}
        location={c.location}
        price={c.price ?? 0}
        currency={c.currency || "TRY"}
        images={c.images}
        bedrooms={c.bedrooms || 1}
        bathrooms={c.bathrooms || 1}
        guests={c.guests || 2}
        reviewAverage={c.review_average}
        reviewCount={c.review_count}
        discount={c.discount}
        discountAvailable={c.discount_available}
        locale={locale}
      />
    ) : (
    <Card
      id={c.id}
      slug={c.slug}
      title={c.display_title}
      location={c.location}
      price={c.price ?? 0}
      currency={c.currency || "TRY"}
      images={c.images}
      bedrooms={c.bedrooms || 1}
      bathrooms={c.bathrooms || 1}
      guests={c.guests || 2}
      reviewAverage={c.review_average}
      reviewCount={c.review_count}
      discount={c.discount}
      /* 🛡️ İndirim penceresinin TAMAMI müsait mi? `false` → CTA villa
         detayına düşer; `undefined` → mevcut davranış. */
      discountAvailable={c.discount_available}
      locale={locale}
    />
    );

  return (
    <section
      data-discount-design={design}
      className="px-5 md:px-10 lg:px-16 py-10 md:py-14"
    >
      {/* 🤍 Beyaz panel — bölümü sayfa zemininden ayırır. Yalnız kapsayıcı;
          başlık, kartlar, kart ölçüleri/aralıkları ve kaydırma AYNEN. */}
      <div
        data-discount-panel
        className="max-w-site mx-auto rounded-[24px] md:rounded-[28px] bg-white border border-[var(--color-stone-100)] shadow-[0_18px_44px_-30px_rgba(36,54,75,0.28)] px-4 py-8 sm:px-6 md:px-8 md:py-12"
      >
        <div className="text-center mb-8 md:mb-12">
          <h2 className="font-display font-medium text-[22px] md:text-[26px] text-[var(--color-stone-900)] leading-tight tracking-[-0.02em]">
            {title}
          </h2>
        </div>

        <HorizontalCarousel
          showArrows
          ariaLabel={dict.carouselAriaLabel}
          prevLabel={carouselDict.previous}
          nextLabel={carouselDict.next}
          scrollStep={layout.scrollStep}
          className="pb-1"
        >
          <ul role="list" className={`flex flex-nowrap min-w-max items-stretch ${layout.gap}`}>
            {collection.map((c) => (
              <li
                /* 🛡️ P3 (MIGRATION 092) — aynı villa, seçilen her indirim
                   dönemi için AYRI bir kart üretir; `card_key` =
                   `${villa_id}|${start_date}|${end_date}`. Alan yoksa
                   MEVCUT davranışa düşer. */
                key={c.card_key || c.slug || c.id}
                className={`snap-start shrink-0 ${layout.item}`}
              >
                {renderCard(c)}
              </li>
            ))}
          </ul>
        </HorizontalCarousel>
      </div>
    </section>
  );
}
