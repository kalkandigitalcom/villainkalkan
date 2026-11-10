import "server-only";

import { dbAdminNative as dbAdmin } from "./native";

/* ===============================================================
   🛡️ SATILIK İLAN REPOSITORY (migration 104 + 106) — server-only
   ===============================================================
   YALNIZ `villa_sale_listings` tablosuna ve `villa` tablosundan
   satılık ilan bağlamı için gereken SLIM projeksiyona dokunur. Kiralık
   fiyat (villa_prices), takvim, rezervasyon tablolarına ERİŞİM YOK.

   ⚠️ İş kuralı doğrulaması BURADA yapılmaz (bkz.
   app/services/sale-listing.service.ts); bu dosya DB primitive'idir.
   Tüm değerler parametreli query builder üzerinden gider (SQL
   injection yüzeyi yok; tablo/kolon adları sabit).
   Çeviriler generic `translationRepository` ("villa_sale_listing").
=============================================================== */

/** Liste + detay için kolon kümesi (tek kaynak). */
export const SALE_LISTING_COLUMNS = `
  villa_id, sale_price, sale_currency, price_on_request,
  sale_status, property_type, plot_area_m2, built_area_m2, room_layout,
  bathrooms, floors, year_built, title_deed_type, has_garden,
  garden_area_m2, sale_description, seo_title, seo_description,
  sale_sort_order, is_featured,
  is_published, publication_status, published_at, created_at, updated_at
`;

const VILLA_EMBED = `villa:villa_id (
  id, title, slug, is_active, deleted_at, listed_for_rent, listed_for_sale
)`;

export const saleListingRepository = {
  /** Admin liste — tüm ilanlar + slim villa embed; sıralama
   *  sale_sort_order ASC, created_at DESC. Filtre/arama/sayfalama
   *  admin listesinde (client) — kayıt sayısı villa sayısıyla sınırlı. */
  async findAllForAdmin() {
    return await dbAdmin
      .from("villa_sale_listings")
      .select(`${SALE_LISTING_COLUMNS}, ${VILLA_EMBED}`)
      .order("sale_sort_order", { ascending: true })
      .order("created_at", { ascending: false });
  },

  async findByVillaId(villaId: string) {
    return await dbAdmin
      .from("villa_sale_listings")
      .select(`${SALE_LISTING_COLUMNS}, ${VILLA_EMBED}`)
      .eq("villa_id", villaId)
      .maybeSingle();
  },

  async insert(payload: Record<string, unknown>) {
    return await dbAdmin
      .from("villa_sale_listings")
      .insert(payload)
      .select(SALE_LISTING_COLUMNS)
      .single();
  },

  async updateByVillaId(villaId: string, payload: Record<string, unknown>) {
    return await dbAdmin
      .from("villa_sale_listings")
      .update(payload)
      .eq("villa_id", villaId)
      .select(SALE_LISTING_COLUMNS)
      .maybeSingle();
  },

  /** Yalnız satılık ilan satırını siler (çevirisi FK CASCADE ile).
   *  Villa kaydına / kiralık verisine DOKUNMAZ. */
  async deleteByVillaId(villaId: string) {
    return await dbAdmin
      .from("villa_sale_listings")
      .delete()
      .eq("villa_id", villaId);
  },

  /** İlan bağlanabilecek villa bağlamı (slim). Silinmiş villa da okunur;
   *  kural servis katmanında. */
  async findVillaContext(villaId: string) {
    return await dbAdmin
      .from<{
        id: string;
        title: string | null;
        slug: string | null;
        is_active: boolean | null;
        deleted_at: string | null;
        listed_for_rent: boolean | null;
        listed_for_sale: boolean | null;
      }>("villa")
      .select("id, title, slug, is_active, deleted_at, listed_for_rent, listed_for_sale")
      .eq("id", villaId)
      .maybeSingle();
  },

  /** Form "Bağlı villa" seçenekleri: satılık işaretli, silinmemiş villalar. */
  async findSaleVillaOptions() {
    return await dbAdmin
      .from<{
        id: string;
        title: string | null;
        slug: string | null;
        is_active: boolean | null;
        listed_for_rent: boolean | null;
      }>("villa")
      .select("id, title, slug, is_active, listed_for_rent")
      .eq("listed_for_sale", true)
      .is("deleted_at", null)
      .order("title", { ascending: true });
  },

  /* ===============================================================
     🌐 PUBLIC OKUMALAR (Aşama 5) — yalnız YAYINDAKİ ilanlar
     ===============================================================
     SQL seviyesinde: is_published = true AND publication_status =
     'published'. Villa koşulları (aktif, silinmemiş, listed_for_sale)
     embed üzerinden gelir ve servis katmanında
     `isPublicSaleListingVisible` ile AYRICA uygulanır (çift kapı). */

  /** Public liste kartları (villa + bölge + görseller embed). */
  async findPublishedPublicCards() {
    return await dbAdmin
      .from("villa_sale_listings")
      .select(
        `
        villa_id, sale_price, sale_currency, price_on_request,
        sale_status, property_type, room_layout, bathrooms, built_area_m2,
        plot_area_m2, sale_sort_order, is_featured, is_published,
        publication_status, published_at, created_at,
        villa:villa_id (
          id, title, slug, is_active, deleted_at, listed_for_sale,
          location_id, bedrooms, bathrooms,
          location:villa_locations(name),
          villa_images ( image_url, is_cover, sort_order )
        )
      `
      )
      .eq("is_published", true)
      .eq("publication_status", "published")
      .order("sale_sort_order", { ascending: true })
      .order("created_at", { ascending: false });
  },

  /** Sitemap — yayındaki ilanların slug + tarih bilgisi. */
  async findPublishedSitemapRows() {
    return await dbAdmin
      .from("villa_sale_listings")
      .select(
        `
        villa_id, is_published, publication_status, published_at, updated_at,
        villa:villa_id ( slug, is_active, deleted_at, listed_for_sale )
      `
      )
      .eq("is_published", true)
      .eq("publication_status", "published");
  },

  /** Public detay — slug → villa id (yalnız satılık, aktif, silinmemiş
   *  villa). İlanın yayın kontrolü yükleyicide (`mode: "public"`). */
  async findSaleVillaIdBySlug(slug: string) {
    return await dbAdmin
      .from<{ id: string }>("villa")
      .select("id")
      .eq("slug", slug)
      .eq("listed_for_sale", true)
      .eq("is_active", true)
      .is("deleted_at", null)
      .maybeSingle();
  },

  /** Seçenek listesinden düşülecek: zaten ilanı olan villa id'leri. */
  async findAllVillaIds() {
    return await dbAdmin
      .from<{ villa_id: string }>("villa_sale_listings")
      .select("villa_id");
  },
};
