import "server-only";

import { dbAdminNative as dbAdmin } from "./native";

/* ===============================================================
   🛡️ SATILIK İLAN REPOSITORY (migration 104 + 106 + 108) — server-only
   ===============================================================
   YALNIZ satılık ilan tablolarına (`villa_sale_listings`,
   `sale_listing_images`, `sale_listing_features`) ve `villa` /
   `villa_locations` / `villa_features` tablolarından satılık ilan
   bağlamı için gereken SLIM projeksiyonlara dokunur. Kiralık fiyat
   (villa_prices), takvim, rezervasyon, iCal tablolarına ERİŞİM YOK;
   `villa` tablosuna YAZMA YOK.

   108: ilan kimliği `id` (PK). `villa_id` yalnız mevcut villadan
   oluşturulan ilanlarda dolu (UNIQUE); bağımsız gayrimenkulde NULL.

   ⚠️ İş kuralı doğrulaması BURADA yapılmaz (bkz.
   app/services/sale-listing.service.ts); bu dosya DB primitive'idir.
   Tüm değerler parametreli query builder üzerinden gider (SQL
   injection yüzeyi yok; tablo/kolon adları sabit).
   Çeviriler generic `translationRepository` ("villa_sale_listing",
   parent = ilan id).
=============================================================== */

/** Liste + detay için kolon kümesi (tek kaynak). */
export const SALE_LISTING_COLUMNS = `
  id, villa_id, source, title, slug, location_id, bedrooms, latitude, longitude,
  sale_price, sale_currency, price_on_request,
  sale_status, property_type, plot_area_m2, built_area_m2, room_layout,
  bathrooms, floors, year_built, title_deed_type, has_garden,
  garden_area_m2, sale_description, seo_title, seo_description,
  sale_sort_order, is_featured,
  is_published, publication_status, published_at, created_at, updated_at
`;

const VILLA_EMBED = `villa:villa_id (
  id, title, slug, is_active, deleted_at, listed_for_rent, listed_for_sale
)`;

const LOCATION_EMBED = `location:villa_locations ( id, name )`;

const ADMIN_SELECT = `${SALE_LISTING_COLUMNS}, ${VILLA_EMBED}, ${LOCATION_EMBED}`;

export type SaleListingImageRow = {
  id: string;
  listing_id: string;
  image_url: string;
  sort_order: number;
  is_cover: boolean;
  created_at: string;
};

export const saleListingRepository = {
  /** Admin liste — tüm ilanlar (iki kaynak) + slim villa / bölge embed;
   *  sıralama sale_sort_order ASC, created_at DESC. Filtre/arama/
   *  sayfalama admin listesinde (client). */
  async findAllForAdmin() {
    return await dbAdmin
      .from("villa_sale_listings")
      .select(ADMIN_SELECT)
      .order("sale_sort_order", { ascending: true })
      .order("created_at", { ascending: false });
  },

  async findById(id: string) {
    return await dbAdmin
      .from("villa_sale_listings")
      .select(ADMIN_SELECT)
      .eq("id", id)
      .maybeSingle();
  },

  async findByVillaId(villaId: string) {
    return await dbAdmin
      .from("villa_sale_listings")
      .select(ADMIN_SELECT)
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

  async updateById(id: string, payload: Record<string, unknown>) {
    return await dbAdmin
      .from("villa_sale_listings")
      .update(payload)
      .eq("id", id)
      .select(SALE_LISTING_COLUMNS)
      .maybeSingle();
  },

  /** Yalnız satılık ilan satırını siler (çeviri, fotoğraf satırları ve
   *  olanak bağları FK CASCADE ile). Villa kaydına / kiralık verisine
   *  DOKUNMAZ. */
  async deleteById(id: string) {
    return await dbAdmin
      .from("villa_sale_listings")
      .delete()
      .eq("id", id);
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

  /** Form "Bağlı villa" seçenekleri: satılık işaretli, silinmemiş villalar
   *  (+ yatak odası / banyo — yeni ilanda başlangıç değeri). */
  async findSaleVillaOptions() {
    return await dbAdmin
      .from<{
        id: string;
        title: string | null;
        slug: string | null;
        is_active: boolean | null;
        listed_for_rent: boolean | null;
        bedrooms: number | null;
        bathrooms: number | null;
      }>("villa")
      .select("id, title, slug, is_active, listed_for_rent, bedrooms, bathrooms")
      .eq("listed_for_sale", true)
      .is("deleted_at", null)
      .order("title", { ascending: true });
  },

  /** Seçenek listesinden düşülecek: zaten ilanı olan villa id'leri
   *  (bağımsız ilanlar villa_id NULL → hariç). */
  async findAllVillaIds() {
    return await dbAdmin
      .from<{ villa_id: string }>("villa_sale_listings")
      .select("villa_id")
      .not("villa_id", "is", null);
  },

  /* ---------------- SLUG (108 — bağımsız ilan) */

  /** Aynı slug'ı kullanan bağımsız ilan (varsa). */
  async findListingIdBySlug(slug: string) {
    return await dbAdmin
      .from<{ id: string }>("villa_sale_listings")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
  },

  /** Aynı slug'ı kullanan HERHANGİ bir villa (kiralık/satılık/pasif/
   *  silinmiş fark etmez) — public /satilik-villa/<slug> çakışmasın. */
  async findVillaIdBySlug(slug: string) {
    return await dbAdmin
      .from<{ id: string }>("villa")
      .select("id")
      .eq("slug", slug)
      .limit(1)
      .maybeSingle();
  },

  /* ---------------- FORM SEÇENEKLERİ (108) */

  async findLocationOptions() {
    return await dbAdmin
      .from<{ id: string; name: string | null }>("villa_locations")
      .select("id, name")
      .order("name", { ascending: true });
  },

  async findFeatureOptions() {
    return await dbAdmin
      .from<{ id: string; name: string | null }>("villa_features")
      .select("id, name")
      .order("name", { ascending: true });
  },

  /* ---------------- OLANAKLAR (108 — bağımsız ilan) */

  async findFeatureIds(listingId: string) {
    return await dbAdmin
      .from<{ feature_id: string }>("sale_listing_features")
      .select("feature_id")
      .eq("listing_id", listingId);
  },

  async findFeaturesByIds(ids: string[]) {
    return await dbAdmin
      .from<{ id: string; name: string }>("villa_features")
      .select("id, name")
      .in("id", ids)
      .order("name", { ascending: true });
  },

  async deleteFeatures(listingId: string) {
    return await dbAdmin
      .from("sale_listing_features")
      .delete()
      .eq("listing_id", listingId);
  },

  async insertFeatures(rows: { listing_id: string; feature_id: string }[]) {
    return await dbAdmin.from("sale_listing_features").insert(rows);
  },

  /* ---------------- FOTOĞRAFLAR (108 — bağımsız ilan) */

  async findImages(listingId: string) {
    return await dbAdmin
      .from<SaleListingImageRow>("sale_listing_images")
      .select("id, listing_id, image_url, sort_order, is_cover, created_at")
      .eq("listing_id", listingId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
  },

  async insertImage(payload: {
    listing_id: string;
    image_url: string;
    sort_order: number;
    is_cover: boolean;
  }) {
    return await dbAdmin
      .from<SaleListingImageRow>("sale_listing_images")
      .insert(payload)
      .select("id, listing_id, image_url, sort_order, is_cover, created_at")
      .single();
  },

  async deleteImage(listingId: string, imageId: string) {
    return await dbAdmin
      .from("sale_listing_images")
      .delete()
      .eq("id", imageId)
      .eq("listing_id", listingId);
  },

  async clearCover(listingId: string) {
    return await dbAdmin
      .from("sale_listing_images")
      .update({ is_cover: false })
      .eq("listing_id", listingId)
      .eq("is_cover", true);
  },

  async updateImage(
    listingId: string,
    imageId: string,
    payload: { sort_order?: number; is_cover?: boolean }
  ) {
    return await dbAdmin
      .from("sale_listing_images")
      .update(payload)
      .eq("id", imageId)
      .eq("listing_id", listingId);
  },

  /* ===============================================================
     🌐 PUBLIC OKUMALAR — yalnız YAYINDAKİ ilanlar (iki kaynak)
     ===============================================================
     SQL seviyesinde: is_published = true AND publication_status =
     'published'. Villa kaynaklı ilanda villa koşulları (aktif,
     silinmemiş, listed_for_sale) embed üzerinden gelir ve servis
     katmanında `isPublicSaleListingVisible` ile AYRICA uygulanır. */

  /** Public liste kartları (villa veya bağımsız ilanın kendi bölge +
   *  fotoğraf embed'i). */
  async findPublishedPublicCards() {
    return await dbAdmin
      .from("villa_sale_listings")
      .select(
        `
        id, villa_id, source, title, slug, location_id, bedrooms,
        sale_price, sale_currency, price_on_request,
        sale_status, property_type, room_layout, bathrooms, built_area_m2,
        plot_area_m2, sale_sort_order, is_featured, is_published,
        publication_status, published_at, created_at,
        location:villa_locations ( name ),
        sale_listing_images ( image_url, is_cover, sort_order ),
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
        id, villa_id, source, slug, is_published, publication_status,
        published_at, updated_at,
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

  /** Public detay — villa id → ilan id. */
  async findListingIdByVillaId(villaId: string) {
    return await dbAdmin
      .from<{ id: string }>("villa_sale_listings")
      .select("id")
      .eq("villa_id", villaId)
      .maybeSingle();
  },

  /** Public detay — bağımsız ilan slug → ilan id (yayın kontrolü
   *  yükleyicide). */
  async findStandaloneIdBySlug(slug: string) {
    return await dbAdmin
      .from<{ id: string }>("villa_sale_listings")
      .select("id")
      .eq("slug", slug)
      .eq("source", "standalone")
      .maybeSingle();
  },
};
