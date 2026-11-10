import "server-only";

import {
  saleListingRepository,
  type SaleListingImageRow,
} from "@/lib/db/sale-listing.repository.server";
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
   🛡️ SATILIK İLAN DETAY — VERİ YÜKLEYİCİ (önizleme + public)
   ===============================================================
   TEK yükleyici, iki mod, iki kaynak (migration 108):
     • "preview" → yayın durumundan BAĞIMSIZ (taslak / yayında /
       kaldırılmış). YALNIZ yetki kontrolünden SONRA çağrılır
       (/maki-admin/sale-listings/[id]/onizleme sayfası).
     • "public"  → `isPublicSaleListingVisible` geçmezse null (taslak,
       kaldırılmış; villa kaynağında satılık olmayan / pasif / silinmiş
       villa ASLA).
     • source="villa"      → başlık, galeri, olanaklar, mesafeler, harita
       villadan OKUNUR (kiralık veri yalnız okunur; fiyat takvimi /
       rezervasyon / iCal hiç okunmaz).
     • source="standalone" → başlık, bölge, koordinat, fotoğraflar
       (sale_listing_images) ve olanaklar (sale_listing_features) ilanın
       kendisinden; villa tablosu hiç okunmaz.
   Dil: İngilizce canonical; TR'de `villa_sale_listing_translations`
   (bağımsız ilanda başlık dahil) ve olanak çevirileri, boş alan
   İngilizceye düşer. Villa ve bölge adı özel isimdir — çevrilmez.
   Önizleme her zaman en güncel çeviriyi okur (cache'siz).
=============================================================== */

export type SaleVillaDetailMode = "preview" | "public";

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

type TrRow = {
  title?: string | null;
  sale_description?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
} | null;

/** İlan id ile (eski bağlantılar için villa id de kabul edilir). */
async function readListing(id: string): Promise<SaleListingRow | null> {
  const byId = await saleListingRepository.findById(id);
  if (byId.error) {
    console.error("[saleVillaDetail] listing read FAILED", {
      code: (byId.error as { code?: string }).code ?? null,
      message: byId.error.message,
      id,
    });
    throw new Error("Satılık ilan okunamadı");
  }
  if (byId.data) return byId.data as unknown as SaleListingRow;
  const byVilla = await saleListingRepository.findByVillaId(id);
  if (byVilla.error) {
    console.error("[saleVillaDetail] listing read FAILED", {
      code: (byVilla.error as { code?: string }).code ?? null,
      message: byVilla.error.message,
      id,
    });
    throw new Error("Satılık ilan okunamadı");
  }
  return (byVilla.data as unknown as SaleListingRow | null) ?? null;
}

export async function loadSaleVillaDetail(
  listingId: string,
  opts: { locale: Locale; mode: SaleVillaDetailMode }
): Promise<SaleVillaDetailData | null> {
  if (!isUuid(listingId)) return null;
  const listing = await readListing(listingId);
  if (!listing) return null;

  const locale = opts.locale;
  const trPromise: Promise<TrRow> =
    locale === DEFAULT_LOCALE
      ? Promise.resolve(null)
      : translationRepository
          .findOne("villa_sale_listing", listing.id, locale)
          .then((r) => (r.data as TrRow) ?? null);

  /* ---------------- Kaynak: villa ya da bağımsız ---------------- */
  let title: string;
  let slug: string | null;
  let locationName: string | null;
  let imageUrls: string[];
  let features: Feature[];
  let distancesRaw: { id: string; title: string; distance: string }[] = [];
  let map: SaleVillaDetailData["map"];
  let villaBedrooms: number | null = null;
  let villaBathrooms: number | null = null;
  let trRow: TrRow;
  const settingsPromise = getCachedSettings().catch(() => null);

  if (listing.source === "standalone") {
    if (opts.mode === "public" && !isPublicSaleListingVisible(listing, null)) return null;
    const [imgs, featureIds, tr] = await Promise.all([
      saleListingRepository.findImages(listing.id),
      saleListingRepository.findFeatureIds(listing.id),
      trPromise,
    ]);
    trRow = tr;
    const ids = (featureIds.data || []).map((f) => f.feature_id);
    const featureRows =
      ids.length > 0 ? await saleListingRepository.findFeaturesByIds(ids) : { data: [] as Feature[] };
    features = (featureRows.data || []) as Feature[];
    const images = ((imgs.data || []) as SaleListingImageRow[])
      .slice()
      .sort((a, b) => (a.is_cover === b.is_cover ? a.sort_order - b.sort_order : a.is_cover ? -1 : 1));
    imageUrls = images
      .map((img) => resolveVillaImageUrl(img.image_url))
      .filter((u): u is string => typeof u === "string" && u.length > 0);
    title = String(resolveTranslatedField(trRow?.title, listing.title) ?? listing.title ?? "");
    slug = listing.slug;
    locationName = listing.location?.name ?? null;
    const lat = num(listing.latitude);
    const lng = num(listing.longitude);
    map = {
      mapType: lat !== null && lng !== null ? "coords" : null,
      latitude: lat,
      longitude: lng,
      mapEmbed: null,
    };
  } else {
    const villaId = listing.villa_id as string;
    const villa = await villaAdminRepository.findById(villaId);
    if (!villa) return null;
    const villaFlags = {
      is_active: villa.is_active as boolean | null,
      deleted_at: villa.deleted_at as string | null,
      listed_for_sale: villa.listed_for_sale as boolean | null,
    };
    if (opts.mode === "public" && !isPublicSaleListingVisible(listing, villaFlags)) {
      return null;
    }
    const [images, villaFeatures, distances, tr] = await Promise.all([
      getVillaImages(villaId),
      getVillaFeaturesByVilla(villaId) as Promise<Feature[]>,
      getVillaDistances(villaId),
      trPromise,
    ]);
    trRow = tr;
    features = villaFeatures;
    distancesRaw = distances || [];
    imageUrls = images
      .map((img) => resolveVillaImageUrl(img.image_url))
      .filter((u): u is string => typeof u === "string" && u.length > 0);
    title = String(villa.title || "");
    slug = (villa.slug as string | null) ?? null;
    const location = villa.location as { name?: string | null } | null;
    locationName = location?.name ?? null;
    villaBedrooms = num(villa.bedrooms);
    villaBathrooms = num(villa.bathrooms);
    map = {
      mapType: (villa.map_type as string | null) ?? null,
      latitude: num(villa.latitude),
      longitude: num(villa.longitude),
      mapEmbed: (villa.map_embed as string | null) ?? null,
    };
  }

  const [settings, featureTranslations] = await Promise.all([
    settingsPromise,
    getTranslationsForParents(
      "villa_feature",
      features.map((f) => f.id),
      locale
    ),
  ]);

  const description = resolveTranslatedField(
    trRow?.sale_description,
    listing.sale_description
  );

  return {
    listingId: listing.id,
    source: listing.source === "standalone" ? "standalone" : "villa",
    title,
    slug,
    locationName,
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
      salePrice: num(listing.sale_price),
      saleCurrency: listing.sale_currency,
      priceOnRequest: listing.price_on_request === true,
      saleStatus: listing.sale_status,
      propertyType: listing.property_type,
      roomLayout: listing.room_layout,
      bedrooms: num(listing.bedrooms) ?? villaBedrooms,
      bathrooms: num(listing.bathrooms) ?? villaBathrooms,
      builtAreaM2: num(listing.built_area_m2),
      plotAreaM2: num(listing.plot_area_m2),
      floors: num(listing.floors),
      yearBuilt: num(listing.year_built),
      titleDeedType: listing.title_deed_type,
      hasGarden: listing.has_garden === true,
      gardenAreaM2: num(listing.garden_area_m2),
      description: (description as string | null) || null,
      publicationStatus: listing.publication_status,
    },
    features: features.map((f) => ({
      id: f.id,
      displayName: String(
        resolveTranslatedField(featureTranslations.get(f.id)?.name, f.name) ?? ""
      ),
    })),
    distances: distancesRaw.map((d) => ({
      id: d.id,
      displayTitle: getTranslatedDistanceLabel(d.title, locale),
      displayDistance: d.distance,
      iconKey: getDistanceIconKey(d.title),
    })),
    map,
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
