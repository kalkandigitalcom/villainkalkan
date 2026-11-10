import "server-only";

import { saleListingRepository } from "@/lib/db/sale-listing.repository.server";
import { resolveVillaImageUrl } from "@/lib/storage.helpers";
import { isPublicSaleListingVisible } from "@/lib/sale-listing.helper";
import type { SalePublicCard } from "@/lib/sale-listing-public.helper";
import type {
  PropertyType,
  SaleCurrency,
  SaleStatus,
} from "@/lib/sale-listing.helper";

/* ===============================================================
   🌐 SATILIK İLAN — PUBLIC OKUMA SERVİSİ (Aşama 5)
   ===============================================================
   YALNIZ yayındaki ilanlar: SQL'de is_published + publication_status
   ='published'; JS'te ayrıca `isPublicSaleListingVisible` (aktif,
   silinmemiş, listed_for_sale villa). Taslak / yayından kaldırılmış /
   satılık olmayan / pasif villa ASLA dönmez.
   Kiralık tablolar (fiyat, takvim, rezervasyon) OKUNMAZ.
=============================================================== */

type ImageRow = { image_url: string | null; is_cover: boolean | null; sort_order: number | null };

type CardRow = {
  villa_id: string;
  sale_price: number | string | null;
  sale_currency: SaleCurrency;
  price_on_request: boolean | null;
  sale_status: SaleStatus;
  property_type: PropertyType;
  room_layout: string | null;
  bathrooms: number | null;
  built_area_m2: number | string | null;
  plot_area_m2: number | string | null;
  sale_sort_order: number | null;
  is_featured: boolean | null;
  is_published: boolean | null;
  publication_status: string | null;
  created_at: string | null;
  villa: {
    id: string;
    title: string | null;
    slug: string | null;
    is_active: boolean | null;
    deleted_at: string | null;
    listed_for_sale: boolean | null;
    location_id: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    location: { name: string | null } | null;
    villa_images: ImageRow[] | null;
  } | null;
};

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function coverOf(images: ImageRow[] | null | undefined): string | null {
  const list = Array.isArray(images) ? [...images] : [];
  list.sort((a, b) => {
    if (a?.is_cover && !b?.is_cover) return -1;
    if (b?.is_cover && !a?.is_cover) return 1;
    return (a?.sort_order ?? 0) - (b?.sort_order ?? 0);
  });
  for (const img of list) {
    const url = resolveVillaImageUrl(img?.image_url);
    if (url) return url;
  }
  return null;
}

/** Saf eşleme — testlerde doğrudan kullanılır. Görünmez ilan → null. */
export function mapSaleCardRow(r: CardRow): SalePublicCard | null {
  const v = r.villa;
  if (!v || !v.slug) return null;
  if (!isPublicSaleListingVisible(r, v)) return null;
  return {
    villaId: r.villa_id,
    slug: v.slug,
    title: String(v.title || ""),
    locationId: v.location_id ?? null,
    locationName: v.location?.name ?? null,
    coverImage: coverOf(v.villa_images),
    salePrice: num(r.sale_price),
    saleCurrency: r.sale_currency,
    priceOnRequest: r.price_on_request === true,
    saleStatus: r.sale_status,
    propertyType: r.property_type,
    roomLayout: r.room_layout,
    bedrooms: num(v.bedrooms),
    bathrooms: num(r.bathrooms) ?? num(v.bathrooms),
    builtAreaM2: num(r.built_area_m2),
    plotAreaM2: num(r.plot_area_m2),
    isFeatured: r.is_featured === true,
    sortOrder: num(r.sale_sort_order) ?? 0,
    createdAt: r.created_at,
  };
}

export async function listPublicSaleCards(): Promise<SalePublicCard[]> {
  const { data, error } = await saleListingRepository.findPublishedPublicCards();
  if (error) {
    console.error("[salePublic.list] FAILED", {
      code: (error as { code?: string }).code ?? null,
      message: error.message,
    });
    return [];
  }
  return ((data || []) as unknown as CardRow[])
    .map(mapSaleCardRow)
    .filter((c): c is SalePublicCard => c !== null);
}

/** Public detay: slug → villa id (yayın kontrolü yükleyicide). */
export async function findPublicSaleVillaIdBySlug(slug: string): Promise<string | null> {
  const s = (slug || "").trim();
  if (!s || s.length > 200) return null;
  const { data, error } = await saleListingRepository.findSaleVillaIdBySlug(s);
  if (error) {
    console.error("[salePublic.slug] FAILED", {
      code: (error as { code?: string }).code ?? null,
      message: error.message,
    });
    return null;
  }
  return data?.id ?? null;
}

/** Sitemap: yalnız public görünür ilanların slug'ları. */
export async function listPublicSaleSitemapRows(): Promise<
  { slug: string; lastModified: string | null }[]
> {
  const { data, error } = await saleListingRepository.findPublishedSitemapRows();
  if (error) {
    console.error("[salePublic.sitemap] FAILED", error.message);
    return [];
  }
  type Row = {
    is_published: boolean | null;
    publication_status: string | null;
    published_at: string | null;
    updated_at: string | null;
    villa: { slug: string | null; is_active: boolean | null; deleted_at: string | null; listed_for_sale: boolean | null } | null;
  };
  return ((data || []) as unknown as Row[])
    .filter((r) => !!r.villa?.slug && isPublicSaleListingVisible(r, r.villa))
    .map((r) => ({ slug: r.villa!.slug as string, lastModified: r.updated_at || r.published_at }));
}
