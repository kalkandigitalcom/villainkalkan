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
   🌐 SATILIK İLAN — PUBLIC OKUMA SERVİSİ (Aşama 5 + 108)
   ===============================================================
   YALNIZ yayındaki ilanlar: SQL'de is_published + publication_status
   ='published'; JS'te ayrıca `isPublicSaleListingVisible`:
     • villa kaynaklı → aktif, silinmemiş, listed_for_sale villa;
     • bağımsız (standalone) → kendi slug'ı (villa tablosu yok).
   Taslak / yayından kaldırılmış ilan ASLA dönmez. İki kaynak aynı kart
   modeline (SalePublicCard) eşlenir → aynı liste, filtre ve sıralama.
   Kiralık tablolar (fiyat, takvim, rezervasyon) OKUNMAZ.
=============================================================== */

type ImageRow = { image_url: string | null; is_cover: boolean | null; sort_order: number | null };

type CardRow = {
  id: string;
  villa_id: string | null;
  source?: string | null;
  title?: string | null;
  slug?: string | null;
  location_id?: string | null;
  bedrooms?: number | string | null;
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
  location?: { name: string | null } | null;
  sale_listing_images?: ImageRow[] | null;
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
  const common = {
    listingId: r.id,
    salePrice: num(r.sale_price),
    saleCurrency: r.sale_currency,
    priceOnRequest: r.price_on_request === true,
    saleStatus: r.sale_status,
    propertyType: r.property_type,
    roomLayout: r.room_layout,
    builtAreaM2: num(r.built_area_m2),
    plotAreaM2: num(r.plot_area_m2),
    isFeatured: r.is_featured === true,
    sortOrder: num(r.sale_sort_order) ?? 0,
    createdAt: r.created_at,
  };

  if (r.source === "standalone") {
    if (!r.slug || !r.title) return null;
    if (!isPublicSaleListingVisible(r, null)) return null;
    return {
      ...common,
      source: "standalone",
      slug: r.slug,
      title: String(r.title),
      locationId: r.location_id ?? null,
      locationName: r.location?.name ?? null,
      coverImage: coverOf(r.sale_listing_images),
      bedrooms: num(r.bedrooms),
      bathrooms: num(r.bathrooms),
    };
  }

  const v = r.villa;
  if (!v || !v.slug) return null;
  if (!isPublicSaleListingVisible(r, v)) return null;
  return {
    ...common,
    source: "villa",
    slug: v.slug,
    title: String(v.title || ""),
    locationId: v.location_id ?? null,
    locationName: v.location?.name ?? null,
    coverImage: coverOf(v.villa_images),
    bedrooms: num(r.bedrooms) ?? num(v.bedrooms),
    bathrooms: num(r.bathrooms) ?? num(v.bathrooms),
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
  /* Aynı slug iki kaynakta (beklenmez; servis engeller) → villa kaynaklı
     kart tutulur — detay çözümlemesiyle tutarlı. */
  const seen = new Set<string>();
  const cards = ((data || []) as unknown as CardRow[])
    .map(mapSaleCardRow)
    .filter((c): c is SalePublicCard => c !== null);
  const ordered = [...cards.filter((c) => c.source === "villa"), ...cards.filter((c) => c.source !== "villa")];
  const keep = new Set<string>();
  for (const c of ordered) {
    if (seen.has(c.slug)) continue;
    seen.add(c.slug);
    keep.add(c.listingId);
  }
  return cards.filter((c) => keep.has(c.listingId));
}

function logSlugError(error: { message: string; code?: string }) {
  console.error("[salePublic.slug] FAILED", {
    code: error.code ?? null,
    message: error.message,
  });
}

/** Public detay: slug → aday ilan id'leri, öncelik sırasıyla (yayın
 *  kontrolü yükleyicide; ilk görünür aday kullanılır):
 *    1) satılık + aktif + silinmemiş villanın ilanı (mevcut URL'ler
 *       aynen çalışır),
 *    2) bağımsız gayrimenkul ilanı (108).
 *  Liste kartlarındaki tekilleştirme ile aynı öncelik. */
export async function findPublicSaleListingIdsBySlug(slug: string): Promise<string[]> {
  const s = (slug || "").trim();
  if (!s || s.length > 200) return [];
  const ids: string[] = [];

  const villa = await saleListingRepository.findSaleVillaIdBySlug(s);
  if (villa.error) {
    logSlugError(villa.error);
    return [];
  }
  if (villa.data?.id) {
    const listing = await saleListingRepository.findListingIdByVillaId(villa.data.id);
    if (listing.error) {
      logSlugError(listing.error);
      return [];
    }
    if (listing.data?.id) ids.push(listing.data.id);
  }

  const standalone = await saleListingRepository.findStandaloneIdBySlug(s);
  if (standalone.error) {
    logSlugError(standalone.error);
    return ids;
  }
  if (standalone.data?.id) ids.push(standalone.data.id);
  return ids;
}

/** Sitemap: yalnız public görünür ilanların slug'ları (iki kaynak). */
export async function listPublicSaleSitemapRows(): Promise<
  { slug: string; lastModified: string | null }[]
> {
  const { data, error } = await saleListingRepository.findPublishedSitemapRows();
  if (error) {
    console.error("[salePublic.sitemap] FAILED", error.message);
    return [];
  }
  type Row = {
    source?: string | null;
    slug?: string | null;
    is_published: boolean | null;
    publication_status: string | null;
    published_at: string | null;
    updated_at: string | null;
    villa: { slug: string | null; is_active: boolean | null; deleted_at: string | null; listed_for_sale: boolean | null } | null;
  };
  const out: { slug: string; lastModified: string | null }[] = [];
  const seen = new Set<string>();
  const rows = (data || []) as unknown as Row[];
  /* Villa kaynaklı önce (slug çakışmasında detay çözümlemesiyle aynı öncelik). */
  const ordered = [...rows.filter((r) => r.source !== "standalone"), ...rows.filter((r) => r.source === "standalone")];
  for (const r of ordered) {
    const slug = r.source === "standalone" ? r.slug : r.villa?.slug;
    if (!slug || seen.has(slug)) continue;
    const visible =
      r.source === "standalone"
        ? isPublicSaleListingVisible(r, null)
        : !!r.villa && isPublicSaleListingVisible(r, r.villa);
    if (!visible) continue;
    seen.add(slug);
    out.push({ slug, lastModified: r.updated_at || r.published_at });
  }
  return out;
}
