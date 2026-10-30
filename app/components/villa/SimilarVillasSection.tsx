import VillaCard from "@/app/components/villa/VillaCard";
/* 🛡️ Villa Migration S5D — findSimilarCards native embed'e taşındı. Bu
   server component villaRepository'yi YALNIZ findSimilarCards için
   kullanıyor → server-only native repo import'u güvenli, tek call-site. */
import { villaAdminRepository } from "@/lib/db/villa.repository.server";
import { resolveVillaImageUrl } from "@/lib/storage.helpers";
import { getStartingPrice } from "@/lib/price.engine";
/* 🛡️ PHASE 10G — locale-aware bölüm başlığı. `locale` OPSİYONEL,
   default "tr".
   🛡️ PHASE 10I — ÇEVRİLMEYEN ÖZEL İSİMLER: villa ADI (`villa.title`) ve
   BÖLGE ADI (`villa_locations.name`) her locale'de canonical gösterilir. */
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/config";

/* ===============================================================
   🛡️ BENZER VİLLALAR — full-width section (kompakt)
   ===============================================================
   Villa detayında, Misafir Yorumları'ndan SONRA, footer'dan ÖNCE.
   Tamamen additive; mevcut VillaCard olduğu gibi kullanılır.

   VERİ KURALLARI (DEĞİŞMEDİ):
     1) Aynı location_id öncelikli · 2) Mevcut villa hariç ·
     3) Aktif + silinmemiş · 4) <3 ise diğer aktiflerle 3'e tamamla.
   QUERY: MAX 2 (location_id prop'tan; lookup query YOK).

   💰 FİYAT: Normal listeleme (mapVilla) gibi `villa_prices`'tan üretilir
   → getStartingPrice (price.engine, min pozitif gecelik). villa.price
   kolonu boş olsa bile gerçek fiyat gösterilir; gereksiz "Fiyat sorunuz"
   önlenir. (mapVilla `villa_prices[0]` kullanır; burada min-pozitif daha
   sağlam ama AYNI veri kaynağı + AYNI engine.)
   =============================================================== */

type VillaImageEmbed = {
  image_url: string | null;
  is_cover: boolean | null;
  sort_order: number | null;
};
type VillaPriceEmbed = {
  price: number | null;
  currency: string | null;
  start_date: string | null;
  end_date: string | null;
};
type SimilarRow = {
  id: string;
  slug: string | null;
  title: string | null;
  currency: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  guests: number | null;
  location: { name: string } | null;
  villa_images: VillaImageEmbed[] | null;
  villa_prices: VillaPriceEmbed[] | null;
};

type Props = {
  villaId: string;
  locationId: string | null;
  /** 🛡️ PHASE 10G — opsiyonel; verilmezse "tr" (eski davranış). */
  locale?: Locale;
};

async function fetchCardVillas(
  opts: { locationId: string | null; excludeIds: string[]; limit: number }
): Promise<SimilarRow[]> {
  if (opts.limit <= 0) return [];
  const { data } = await villaAdminRepository.findSimilarCards(opts);
  return Array.isArray(data) ? (data as SimilarRow[]) : [];
}

export default async function SimilarVillasSection({
  villaId,
  locationId,
  locale,
}: Props) {
  const dict = getDictionary(locale);
  /* Query 1 — aynı bölge (location_id varsa). */
  const primary = locationId
    ? await fetchCardVillas({
        locationId,
        excludeIds: [villaId],
        limit: 3,
      })
    : [];

  let rows: SimilarRow[] = primary;

  /* Query 2 — yalnız 3'e ulaşılmadıysa fallback dolum. */
  if (rows.length < 3) {
    const exclude = [villaId, ...rows.map((r) => r.id)];
    const fill = await fetchCardVillas({
      locationId: null,
      excludeIds: exclude,
      limit: 3 - rows.length,
    });
    rows = [...rows, ...fill];
  }

  if (rows.length === 0) return null;

  const villas = rows.map((v) => {
    let images: string[] = [];
    const raw: VillaImageEmbed[] = Array.isArray(v.villa_images)
      ? v.villa_images
      : [];
    if (raw.length > 0) {
      const sorted = [...raw].sort((a, b) => {
        if (a?.is_cover) return -1;
        if (b?.is_cover) return 1;
        return (a?.sort_order ?? 0) - (b?.sort_order ?? 0);
      });
      images = sorted
        .map((i) => resolveVillaImageUrl(i?.image_url))
        .filter(
          (u): u is string => typeof u === "string" && u.trim().length > 0
        );
    }
    /* Fiyat — listeleme ile aynı kaynak (villa_prices) + aynı engine. */
    const sp = getStartingPrice(v.villa_prices ?? []);
    return {
      id: v.id,
      slug: v.slug ?? "",
      /* 🛡️ Villa ADI ÇEVRİLMEZ — özel isim, canonical `villa.title`. */
      title: v.title ?? "",
      /* 🛡️ PHASE 10I — BÖLGE ADI ÇEVRİLMEZ (özel isim) — canonical. */
      location: v.location?.name ?? "",
      price: sp?.price,
      currency: sp?.currency || v.currency || "TRY",
      images,
      bedrooms: v.bedrooms || 1,
      bathrooms: v.bathrooms || 1,
      guests: v.guests || 2,
    };
  });

  return (
    <section className="w-full -mt-10 md:-mt-14">
      <div className="max-w-site mx-auto px-5 md:px-10 lg:px-16 pt-2 md:pt-4 pb-10 md:pb-14">
        <h2 className="font-display font-medium text-[19px] md:text-[22px] text-[var(--color-stone-900)] tracking-[-0.02em] mb-6 md:mb-8">
          {dict.villa.similarVillasTitle}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
          {villas.map((villa) => (
            <VillaCard
              key={villa.id}
              id={villa.id}
              slug={villa.slug}
              title={villa.title}
              location={villa.location}
              price={villa.price}
              currency={villa.currency}
              images={villa.images}
              bedrooms={villa.bedrooms}
              bathrooms={villa.bathrooms}
              guests={villa.guests}
              locale={locale}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
