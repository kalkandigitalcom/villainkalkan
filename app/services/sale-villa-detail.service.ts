import "server-only";

import { saleListingRepository } from "@/lib/db/sale-listing.repository.server";
import { translationRepository } from "@/lib/db/translation.repository.server";
import { villaAdminRepository } from "@/lib/db/villa.repository.server";
import { getVillaImages } from "@/app/services/villa-image/villa-image.read";
import { getVillaDistances } from "@/app/services/villa-distance.service";
import {
  getVillaFeaturesByVilla,
  type Feature,
} from "@/app/services/villa-feature.service";
import {
  getTranslationsForParents,
  resolveTranslatedField,
} from "@/lib/i18n/get-translation.server";
import { getCachedSettings } from "@/lib/cache.helpers";
import { getDistanceIconKey } from "@/lib/distance.helper";
import { getTranslatedDistanceLabel } from "@/lib/distance-label.helper";
import {
  resolveAssetUrlVersioned,
  resolveVillaImageUrl,
} from "@/lib/storage.helpers";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import {
  isPublicSaleListingVisible,
  isUuid,
} from "@/lib/sale-listing.helper";
import type { SaleListingRow } from "@/app/services/sale-listing.service";
import type { SaleVillaDetailData } from "@/app/components/sale/sale-villa-detail.types";

/* ===============================================================
   🛡️ SATILIK VİLLA DETAY — VERİ YÜKLEYİCİ (önizleme + Aşama 5 public)
   ===============================================================
   TEK yükleyici, iki mod:
     • "preview" → yayın durumundan BAĞIMSIZ (taslak / yayında /
       kaldırılmış). YALNIZ yetki kontrolünden SONRA çağrılır
       (/maki-admin/sale-listings/[villaId]/onizleme sayfası).
     • "public"  → `isPublicSaleListingVisible` geçmezse null (taslak,
       kaldırılmış, satılık olmayan / pasif / silinmiş villa ASLA).
   Kiralık veri yalnız OKUNUR (görseller, olanaklar, mesafeler, harita);
   fiyat takvimi / rezervasyon / iCal hiç okunmaz.
   Dil: İngilizce canonical; TR'de `villa_sale_listing_translations` ve
   olanak çevirileri, boş alan İngilizceye düşer. Villa ve bölge adı
   özel isimdir — çevrilmez. Önizleme her zaman en güncel çeviriyi
   okur (cache'siz).
=============================================================== */

export type SaleVillaDetailMode = "preview" | "public";

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function loadSaleVillaDetail(
  villaId: string,
  opts: { locale: Locale; mode: SaleVillaDetailMode }
): Promise<SaleVillaDetailData | null> {
  if (!isUuid(villaId)) return null;

  const [listingRes, villa] = await Promise.all([
    saleListingRepository.findByVillaId(villaId),
    villaAdminRepository.findById(villaId),
  ]);
  if (listingRes.error) {
    console.error("[saleVillaDetail] listing read FAILED", {
      code: (listingRes.error as { code?: string }).code ?? null,
      message: listingRes.error.message,
      villaId,
    });
    throw new Error("Satılık ilan okunamadı");
  }
  const listing = listingRes.data as unknown as SaleListingRow | null;
  if (!listing || !villa) return null;

  const villaFlags = {
    is_active: villa.is_active as boolean | null,
    deleted_at: villa.deleted_at as string | null,
    listed_for_sale: villa.listed_for_sale as boolean | null,
  };
  if (opts.mode === "public" && !isPublicSaleListingVisible(listing, villaFlags)) {
    return null;
  }

  const locale = opts.locale;
  const [images, features, distances, settings, trRow] = await Promise.all([
    getVillaImages(villaId),
    getVillaFeaturesByVilla(villaId) as Promise<Feature[]>,
    getVillaDistances(villaId),
    getCachedSettings().catch(() => null),
    locale === DEFAULT_LOCALE
      ? Promise.resolve(null)
      : translationRepository
          .findOne("villa_sale_listing", villaId, locale)
          .then((r) => r.data ?? null),
  ]);
  const featureTranslations = await getTranslationsForParents(
    "villa_feature",
    features.map((f) => f.id),
    locale
  );

  const imageUrls = images
    .map((img) => resolveVillaImageUrl(img.image_url))
    .filter((u): u is string => typeof u === "string" && u.length > 0);

  const description = resolveTranslatedField(
    trRow?.sale_description,
    listing.sale_description
  );

  const location = villa.location as { name?: string | null } | null;

  return {
    villaId,
    title: String(villa.title || ""),
    slug: (villa.slug as string | null) ?? null,
    locationName: location?.name ?? null,
    imageUrls,
    watermark: {
      logo:
        resolveAssetUrlVersioned(settings?.watermark_logo, settings?.updated_at) ?? null,
      enabled: settings?.watermark_enabled ?? false,
      opacity: settings?.watermark_opacity ?? 0.15,
      position: (settings?.watermark_position ?? "center") as SaleVillaDetailData["watermark"]["position"],
      size: settings?.watermark_size ?? 25,
    },
    listing: {
      referenceCode: listing.reference_code,
      salePrice: num(listing.sale_price),
      saleCurrency: listing.sale_currency,
      priceOnRequest: listing.price_on_request === true,
      saleStatus: listing.sale_status,
      propertyType: listing.property_type,
      roomLayout: listing.room_layout,
      bedrooms: num(villa.bedrooms),
      bathrooms: num(listing.bathrooms) ?? num(villa.bathrooms),
      builtAreaM2: num(listing.built_area_m2),
      plotAreaM2: num(listing.plot_area_m2),
      floors: num(listing.floors),
      yearBuilt: num(listing.year_built),
      titleDeedType: listing.title_deed_type,
      hasGarden: listing.has_garden === true,
      gardenAreaM2: num(listing.garden_area_m2),
      description: (description as string | null) || null,
      agentWhatsapp: listing.agent_whatsapp,
      agentPhone: listing.agent_phone,
      publicationStatus: listing.publication_status,
    },
    features: features.map((f) => ({
      id: f.id,
      displayName: String(
        resolveTranslatedField(featureTranslations.get(f.id)?.name, f.name) ?? ""
      ),
    })),
    distances: (distances || []).map((d: { id: string; title: string; distance: string }) => ({
      id: d.id,
      displayTitle: getTranslatedDistanceLabel(d.title, locale),
      displayDistance: d.distance,
      iconKey: getDistanceIconKey(d.title),
    })),
    map: {
      mapType: (villa.map_type as string | null) ?? null,
      latitude: num(villa.latitude),
      longitude: num(villa.longitude),
      mapEmbed: (villa.map_embed as string | null) ?? null,
    },
    siteWhatsappLink: settings?.whatsapp_link ?? null,
    sitePhone: settings?.phone ?? null,
    seo: {
      title:
        ((resolveTranslatedField(trRow?.seo_title, listing.seo_title) as string | null) || "").trim() || null,
      description:
        ((resolveTranslatedField(trRow?.seo_description, listing.seo_description) as string | null) || "").trim() || null,
    },
  };
}
